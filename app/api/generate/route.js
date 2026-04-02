import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { buildImprovedVariantGroupId, createHistoryItemAsync } from "@/lib/server/history-service";
import { generateProductCopyVariants, getLocalizedVariantLabel, getVariantStyleLabel } from "@/lib/server/ai-service";
import { normalizeGeneratePayload, RequestValidationError } from "@/lib/server/generate-payload";
import { buildQuotaExceededMessage, consumeGenerationQuotaAsync } from "@/lib/server/generation-quota-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";
import { ensurePlanInfoForUserAsync } from "@/lib/server/billing-service";

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/generate");
  try {
    const body = await request.json().catch(() => {
      throw new RequestValidationError("Dữ liệu gửi lên không hợp lệ.");
    });
    const payload = normalizeGeneratePayload(body);
    const user = await getCurrentUserFromCookiesAsync();
    const planInfo = user?.id ? await ensurePlanInfoForUserAsync(user) : null;
    const isPro = String(planInfo?.plan || "free") === "pro";
    payload.variantCount = isPro ? Math.max(1, Math.min(5, Number(payload.variantCount || 1))) : 1;
    if (payload.improved) {
      payload.variantCount = 1;
    }

    if (user?.id) {
      const quota = await consumeGenerationQuotaAsync({
        userId: user.id,
        scope: "product_copy"
      });

      if (!quota.allowed) {
        const errorMessage = buildQuotaExceededMessage("product_copy", payload.lang);
        return withRequestId(NextResponse.json({
          error: errorMessage,
          code: "FREE_DAILY_QUOTA_EXCEEDED",
          quota
        }, { status: 429 }), ctx);
      }
    }

    const generated = await generateProductCopyVariants(payload);
    const result = generated.primary;
    const { previousResult, ...historyFormData } = payload;
    const variants = Array.isArray(generated.variants) && generated.variants.length
      ? generated.variants
      : [result];
    const preferredVariantIndex = (() => {
      const fromPayload = Number(payload?.previousResult?.variantIndex);
      if (Number.isFinite(fromPayload) && fromPayload >= 0) return Math.floor(fromPayload);
      const fromBody = Number(body?.previousResult?.variantIndex);
      if (Number.isFinite(fromBody) && fromBody >= 0) return Math.floor(fromBody);
      return null;
    })();
    const variantGroupId = payload.improved
      ? buildImprovedVariantGroupId(payload?.previousResult?.variantGroupId || body?.variantGroupId || "")
      : `group_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const entries = [];
    for (let index = 0; index < variants.length; index += 1) {
      const variant = variants[index] || result;
      const fallbackStyle = getVariantStyleLabel(variant?.stylePreset || payload.stylePreset || "balanced", payload.lang);
      const styleLabel = String(variant?.variantStyleLabel || fallbackStyle).trim();
      const baseVariantLabel = getLocalizedVariantLabel(payload.lang, payload.improved);
      const variantLabel = `${baseVariantLabel} · ${styleLabel || `V${index + 1}`}`;
      const titleBase = payload.productName || "Untitled Product";
      const title = payload.improved
        ? `${titleBase} · ${payload.lang === "en" ? "Improved" : "Bản cải tiến"} · ${styleLabel || `V${index + 1}`}`
        : titleBase;
      const variantIndex = payload.improved && preferredVariantIndex !== null
        ? preferredVariantIndex + index
        : index;

      const entry = await createHistoryItemAsync({
        userId: user?.id || null,
        title,
        variantLabel,
        formData: {
          ...historyFormData,
          variantGroupId
        },
        resultData: {
          ...variant,
          variants,
          selectedVariant: generated.selectedVariant,
          variantIndex,
          variantStyleLabel: styleLabel || `V${index + 1}`,
          stylePreset: variant?.stylePreset || payload.stylePreset || "balanced"
        },
        images: payload.images || []
      });
      entries.push(entry);
    }

    const primaryEntry = entries[generated.selectedVariant] || entries[0] || null;
    logInfo(ctx, "generate.success", {
      userId: user?.id || null,
      category: payload.category,
      source: result?.source || "unknown",
      qualityScore: result?.quality?.score ?? null,
      variantCount: generated?.variants?.length || 1,
      selectedVariant: generated?.selectedVariant ?? 0,
      historyId: primaryEntry?.id || null,
      ms: elapsedMs(ctx)
    });
    return withRequestId(NextResponse.json({
      ...result,
      historyId: primaryEntry?.id,
      title: primaryEntry?.title || result?.title,
      variantLabel: primaryEntry?.variantLabel || result?.variantLabel,
      variants,
      selectedVariant: generated.selectedVariant,
      historyIds: entries.map((item) => item.id),
      variantGroupId: primaryEntry?.form?.variantGroupId || variantGroupId
    }), ctx);
  } catch (error) {
    logError(ctx, "generate.failed", error, { ms: elapsedMs(ctx) });
    if (error instanceof RequestValidationError) {
      return withRequestId(NextResponse.json({ error: error.message }, { status: error.status || 400 }), ctx);
    }
    return withRequestId(NextResponse.json({ error: "Không thể tạo nội dung lúc này. Vui lòng thử lại." }, { status: 500 }), ctx);
  }
}
