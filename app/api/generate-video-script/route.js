import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { generateVideoReviewScript } from "@/lib/server/video-script-service";
import { buildImprovedVariantGroupId, createHistoryItemAsync } from "@/lib/server/history-service";
import { buildQuotaExceededMessage, consumeGenerationQuotaAsync, ensureGuestQuotaCookie, ensureGuestQuotaUsageCookie } from "@/lib/server/generation-quota-service";
import { ensurePlanInfoForUserAsync } from "@/lib/server/billing-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";
import {
  coerceVideoStylePresetForPlan,
  coerceVideoStylePresetListForPlan,
  getVideoStylePresetLabel,
  normalizeVideoStylePreset,
  videoOpeningStyleToPreset,
  videoStylePresetToOpeningStyle
} from "@/lib/video-style-presets";

export const preferredRegion = ["sin1"];

function normalizeOpeningStyle(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(4, Math.floor(parsed)));
}

function deriveVariantStylePresets(body = {}, isPro = false, variantCount = 1) {
  const requestedStyle = normalizeVideoStylePreset(
    body?.stylePreset || body?.variantStylePresets?.[0] || videoOpeningStyleToPreset(body?.openingStyle),
    "balanced"
  );
  const stylePreset = coerceVideoStylePresetForPlan(requestedStyle, isPro, "balanced");
  const normalizedList = coerceVideoStylePresetListForPlan(
    Array.isArray(body?.variantStylePresets) && body.variantStylePresets.length
      ? body.variantStylePresets
      : [stylePreset],
    isPro,
    stylePreset
  );

  const next = [];
  for (let index = 0; index < variantCount; index += 1) {
    next.push(normalizedList[index] || normalizedList[0] || stylePreset);
  }
  return {
    stylePreset,
    variantStylePresets: next
  };
}

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

    const coercedStyles = deriveVariantStylePresets(body, isPro, body.variantCount);
    body.stylePreset = coercedStyles.stylePreset;
    body.variantStylePresets = coercedStyles.variantStylePresets;
    body.openingStyle = normalizeOpeningStyle(
      videoStylePresetToOpeningStyle(body.stylePreset, body?.openingStyle),
      0
    );
    body.variantOpeningStyles = body.variantStylePresets.map((stylePreset) =>
      normalizeOpeningStyle(videoStylePresetToOpeningStyle(stylePreset, body.openingStyle), body.openingStyle)
    );

    if (Boolean(body?.improved)) {
      body.variantCount = 1;
      body.variantStylePresets = [body.variantStylePresets[0] || body.stylePreset || "balanced"];
      body.variantOpeningStyles = [body.variantOpeningStyles[0] ?? body.openingStyle];
    }

    const quota = await consumeGenerationQuotaAsync({
      userId: user?.id || "",
      scope: "video_script",
      request
    });

    if (!quota.allowed) {
      const errorMessage = buildQuotaExceededMessage("video_script", body?.lang || "vi", quota);
      const deniedResponse = withRequestId(NextResponse.json({
        error: errorMessage,
        code: "FREE_DAILY_QUOTA_EXCEEDED",
        quota
      }, { status: 429 }), ctx);
      if (!user?.id) {
        ensureGuestQuotaCookie(deniedResponse, request);
        ensureGuestQuotaUsageCookie(deniedResponse, request, {
          userId: "",
          scope: "video_script",
          used: quota?.used || 0
        });
      }
      return deniedResponse;
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
      const openingStyle = normalizeOpeningStyle(
        Number.isFinite(Number(variant?.openingStyle))
          ? Number(variant.openingStyle)
          : Number(body?.variantOpeningStyles?.[index] ?? body?.openingStyle ?? 0),
        0
      );
      const stylePreset = coerceVideoStylePresetForPlan(
        normalizeVideoStylePreset(
          variant?.stylePreset || variant?.variantStylePreset || body?.variantStylePresets?.[index] || body?.stylePreset || "",
          videoOpeningStyleToPreset(openingStyle)
        ),
        isPro,
        videoOpeningStyleToPreset(openingStyle)
      );
      const styleLabel = String(variant?.variantStyleLabel || variant?.styleLabel || getVideoStylePresetLabel(stylePreset, body?.lang || "vi")).trim();
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
          stylePreset,
          variantStylePreset: stylePreset,
          variantStyleLabel: styleLabel || `V${index + 1}`
        },
        images: Array.isArray(body?.images) ? body.images : []
      });
      entries.push(entry);
    }

    const responseVariants = variants.map((variant, index) => {
      const openingStyle = normalizeOpeningStyle(
        Number.isFinite(Number(variant?.openingStyle))
          ? Number(variant.openingStyle)
          : Number(body?.variantOpeningStyles?.[index] ?? body?.openingStyle ?? 0),
        0
      );
      const stylePreset = coerceVideoStylePresetForPlan(
        normalizeVideoStylePreset(
          variant?.stylePreset || variant?.variantStylePreset || body?.variantStylePresets?.[index] || body?.stylePreset || "",
          videoOpeningStyleToPreset(openingStyle)
        ),
        isPro,
        videoOpeningStyleToPreset(openingStyle)
      );
      const styleLabel = String(variant?.variantStyleLabel || variant?.styleLabel || getVideoStylePresetLabel(stylePreset, body?.lang || "vi")).trim();
      return {
        ...variant,
        openingStyle,
        stylePreset,
        variantStylePreset: stylePreset,
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

    const response = withRequestId(NextResponse.json({
      script: {
        ...primaryScript,
        variants: responseVariants,
        selectedVariant,
        variantStyleLabel:
          primaryScript?.variantStyleLabel
          || primaryScript?.styleLabel
          || getVideoStylePresetLabel(
            primaryScript?.stylePreset
              || primaryScript?.variantStylePreset
              || body?.variantStylePresets?.[selectedVariant]
              || body?.stylePreset
              || videoOpeningStyleToPreset(primaryScript?.openingStyle ?? body?.openingStyle),
            body?.lang || "vi"
          )
      },
      variants: responseVariants,
      selectedVariant,
      historyId: primaryEntry?.id || null,
      historyIds: entries.map((item) => item.id),
      variantGroupId: primaryEntry?.form?.variantGroupId || variantGroupId
    }), ctx);
    if (!user?.id) {
      ensureGuestQuotaCookie(response, request);
      ensureGuestQuotaUsageCookie(response, request, {
        userId: "",
        scope: "video_script",
        used: quota?.used || 0
      });
    }
    return response;
  } catch (error) {
    logError(ctx, "generate.video-script.failed", error, { ms: elapsedMs(ctx) });

    const errorMessage = String(error?.message || "").toLowerCase();
    if (/ai service is not configured|ai returned empty output|ai model unavailable|ai request timeout|responses_http_|chat_empty_output|responses_empty_output|http\s*4\d\d|http\s*5\d\d/.test(errorMessage)) {
      return withRequestId(
        NextResponse.json({
          error: "Dịch vụ tạo nội dung đang tạm bận hoặc trả kết quả chưa hợp lệ. Vui lòng thử lại.",
          code: "AI_UNAVAILABLE"
        }, { status: 502 }),
        ctx
      );
    }

    return withRequestId(
      NextResponse.json({ error: error.message || "Không thể tạo kịch bản video lúc này." }, { status: 400 }),
      ctx
    );
  }
}
