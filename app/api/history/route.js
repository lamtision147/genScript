import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { listHistoryByUserAsync, listHistoryByVariantGroupAsync } from "@/lib/server/history-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function GET(request) {
  const ctx = createRequestContext(request, "/api/history");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) return withRequestId(NextResponse.json({ items: [] }), ctx);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "";
    const limit = searchParams.get("limit") || "";
    const variantGroupId = searchParams.get("variantGroupId") || "";
    const items = variantGroupId
      ? await listHistoryByVariantGroupAsync(user.id, variantGroupId, { type, limit })
      : await listHistoryByUserAsync(user.id, { type, limit });
    logInfo(ctx, "history.list", { userId: user.id, type: type || null, count: items.length, ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ items }), ctx);
  } catch (error) {
    logError(ctx, "history.list.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ items: [] }), ctx);
  }
}
