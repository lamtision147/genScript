import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { createHistoryItemAsync } from "@/lib/server/history-service";
import { generateProductCopyVariants, getLocalizedVariantLabel } from "@/lib/server/ai-service";
import { normalizeGeneratePayload, RequestValidationError } from "@/lib/server/generate-payload";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/generate");
  try {
    const body = await request.json().catch(() => {
      throw new RequestValidationError("Dữ liệu gửi lên không hợp lệ.");
    });
    const payload = normalizeGeneratePayload(body);
    const user = await getCurrentUserFromCookiesAsync();
    const generated = await generateProductCopyVariants(payload);
    const result = generated.primary;
    const { previousResult, ...historyFormData } = payload;
    const entry = await createHistoryItemAsync({
      userId: user?.id || null,
      title: payload.productName || "Untitled Product",
      variantLabel: getLocalizedVariantLabel(payload.lang, payload.improved),
      formData: historyFormData,
      resultData: result,
      images: payload.images || []
    });
    logInfo(ctx, "generate.success", {
      userId: user?.id || null,
      category: payload.category,
      source: result?.source || "unknown",
      qualityScore: result?.quality?.score ?? null,
      variantCount: generated?.variants?.length || 1,
      selectedVariant: generated?.selectedVariant ?? 0,
      historyId: entry?.id || null,
      ms: elapsedMs(ctx)
    });
    return withRequestId(NextResponse.json({
      ...result,
      historyId: entry.id,
      title: entry.title,
      variantLabel: entry.variantLabel,
      variants: generated.variants,
      selectedVariant: generated.selectedVariant
    }), ctx);
  } catch (error) {
    logError(ctx, "generate.failed", error, { ms: elapsedMs(ctx) });
    if (error instanceof RequestValidationError) {
      return withRequestId(NextResponse.json({ error: error.message }, { status: error.status || 400 }), ctx);
    }
    return withRequestId(NextResponse.json({ error: "Không thể tạo nội dung lúc này. Vui lòng thử lại." }, { status: 500 }), ctx);
  }
}
