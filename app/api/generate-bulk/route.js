import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { createHistoryItemAsync } from "@/lib/server/history-service";
import { generateProductCopyVariants, getLocalizedVariantLabel } from "@/lib/server/ai-service";
import { normalizeGeneratePayload } from "@/lib/server/generate-payload";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/generate-bulk");
  try {
    const body = await request.json().catch(() => ({}));
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 20) : [];
    const user = await getCurrentUserFromCookiesAsync();

    if (!rows.length) {
      return withRequestId(NextResponse.json({ error: "No rows provided" }, { status: 400 }), ctx);
    }

    const outputs = [];
    for (const row of rows) {
      const payload = normalizeGeneratePayload({
        ...row,
        variantCount: 1,
        brandPreset: body.brandPreset || "minimalist"
      });
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

      outputs.push({
        productName: payload.productName,
        source: result.source,
        quality: result?.quality?.score ?? null,
        title: entry.title,
        historyId: entry.id,
        paragraph1: result.paragraphs?.[0] || "",
        hashtags: result.hashtags || []
      });
    }

    logInfo(ctx, "generate.bulk.success", { count: outputs.length, userId: user?.id || null, ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ items: outputs }), ctx);
  } catch (error) {
    logError(ctx, "generate.bulk.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: "Bulk generation failed" }, { status: 400 }), ctx);
  }
}
