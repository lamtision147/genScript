import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { generateVideoReviewScript, getVideoVariantStyleLabel } from "@/lib/server/video-script-service";
import { buildImprovedVariantGroupId, createHistoryItemAsync } from "@/lib/server/history-service";
import { buildQuotaExceededMessage, consumeGenerationQuotaAsync } from "@/lib/server/generation-quota-service";
import { ensurePlanInfoForUserAsync } from "@/lib/server/billing-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/generate-video-script");
  try {
    const body = await request.json().catch(() => ({}));
    const user = await getCurrentUserFromCookiesAsync();
    const planInfo = user?.id
      ? await ensurePlanInfoForUserAsync(user).catch(() => ({ plan: String(user?.plan || "free") }))
      : null;
    const isPro = String(planInfo?.plan || "free") === "pro";

    const requestedVariantCount = Math.max(1, Math.min(5, Number(body?.variantCount || 1)));
    body.variantCount = isPro ? requestedVariantCount : 1;
    if (Boolean(body?.improved)) {
      body.variantCount = 1;
    }

    if (user?.id) {
      const quota = await consumeGenerationQuotaAsync({
        userId: user.id,
        scope: "video_script"
      });

      if (!quota.allowed) {
        const errorMessage = buildQuotaExceededMessage("video_script", body?.lang || "vi");
        return withRequestId(NextResponse.json({
          error: errorMessage,
          code: "FREE_DAILY_QUOTA_EXCEEDED",
          quota
        }, { status: 429 }), ctx);
      }
    }

    const generated = await generateVideoReviewScript(body);
    const variants = Array.isArray(generated?.variants) && generated.variants.length
      ? generated.variants
      : [generated];
    const selectedVariant = Number.isFinite(Number(generated?.selectedVariant))
      ? Math.max(0, Math.min(variants.length - 1, Number(generated.selectedVariant)))
      : 0;

    const preferredVariantIndex = (() => {
      const fromBody = Number(body?.previousResult?.variantIndex);
      if (Number.isFinite(fromBody) && fromBody >= 0) return Math.floor(fromBody);
      return null;
    })();

    const variantGroupId = body?.improved
      ? buildImprovedVariantGroupId(body?.previousResult?.variantGroupId || body?.variantGroupId || "")
      : `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const entries = [];
    const titleBase = body?.productName || "Video Script";
    const isVi = String(body?.lang || "vi").toLowerCase().startsWith("vi");
    const baseVariantLabel = isVi ? (body?.improved ? "Kịch bản cải tiến" : "Kịch bản review video") : (body?.improved ? "Improved video script" : "Video review script");

    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index] || generated;
      const openingStyle = Number.isFinite(Number(variant?.openingStyle)) ? Number(variant.openingStyle) : Number(body?.openingStyle || 0);
      const styleLabel = String(variant?.variantStyleLabel || variant?.styleLabel || getVideoVariantStyleLabel(openingStyle, body?.lang || "vi")).trim();
      const variantLabel = `${baseVariantLabel} · ${styleLabel || `V${index + 1}`}`;
      const title = body?.improved
        ? `${titleBase} · ${isVi ? "Bản cải tiến" : "Improved"} · ${styleLabel || `V${index + 1}`}`
        : titleBase;
      const variantIndex = body?.improved && preferredVariantIndex !== null
        ? preferredVariantIndex + index
        : index;

      const entry = await createHistoryItemAsync({
        userId: user?.id || null,
        title,
        variantLabel,
        formData: {
          ...body,
          contentType: "video_script",
          variantGroupId
        },
        resultData: {
          ...variant,
          variants,
          selectedVariant,
          variantIndex,
          openingStyle,
          variantStyleLabel: styleLabel || `V${index + 1}`
        },
        images: Array.isArray(body?.images) ? body.images : []
      });
      entries.push(entry);
    }

    const responseVariants = variants.map((variant, index) => {
      const openingStyle = Number.isFinite(Number(variant?.openingStyle))
        ? Number(variant.openingStyle)
        : Number(body?.openingStyle || 0);
      const styleLabel = String(variant?.variantStyleLabel || variant?.styleLabel || getVideoVariantStyleLabel(openingStyle, body?.lang || "vi")).trim();
      return {
        ...variant,
        openingStyle,
        variantStyleLabel: styleLabel,
        styleLabel,
        historyId: entries[index]?.id || null,
        variantIndex: Number.isFinite(Number(variant?.variantIndex)) ? Number(variant.variantIndex) : index,
        variantGroupId
      };
    });

    const primaryEntry = entries[selectedVariant] || entries[0] || null;
    const primaryScript = responseVariants[selectedVariant] || responseVariants[0] || generated;

    logInfo(ctx, "generate.video-script.success", {
      userId: user?.id || null,
      channel: body?.channel ?? null,
      source: primaryScript?.source || "unknown",
      hasHook: Boolean(primaryScript?.hook),
      sceneCount: Array.isArray(primaryScript?.scenes) ? primaryScript.scenes.length : 0,
      variantCount: variants.length,
      selectedVariant,
      historyId: primaryEntry?.id || null,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({
      script: {
        ...primaryScript,
        variants: responseVariants,
        selectedVariant,
        variantStyleLabel: primaryScript?.variantStyleLabel || primaryScript?.styleLabel || getVideoVariantStyleLabel(primaryScript?.openingStyle ?? body?.openingStyle, body?.lang || "vi")
      },
      variants: responseVariants,
      selectedVariant,
      historyId: primaryEntry?.id || null,
      historyIds: entries.map((item) => item.id),
      variantGroupId: primaryEntry?.form?.variantGroupId || variantGroupId
    }), ctx);
  } catch (error) {
    logError(ctx, "generate.video-script.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(
      NextResponse.json({ error: error.message || "Không thể tạo kịch bản video lúc này." }, { status: 400 }),
      ctx
    );
  }
}
