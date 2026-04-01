import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { listFavoritesByUserAsync } from "@/lib/server/history-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function GET(request) {
  const ctx = createRequestContext(request, "/api/favorites");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "";
    const limit = searchParams.get("limit") || "";
    const items = await listFavoritesByUserAsync(user.id, { type, limit });
    logInfo(ctx, "favorites.list", { userId: user.id, type: type || null, count: items.length, ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ items }), ctx);
  } catch (error) {
    logError(ctx, "favorites.list.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Failed to load favorites" }, { status: 500 }), ctx);
  }
}
