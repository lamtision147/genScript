import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { toggleFavoriteAsync } from "@/lib/server/history-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function POST(request) {
  const ctx = createRequestContext({ method: "POST", headers: new Headers() }, "/api/favorites/toggle");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    const payload = await request.json();
    const historyId = String(payload.historyId || "").trim();
    if (!historyId) return withRequestId(NextResponse.json({ error: "historyId is required" }, { status: 400 }), ctx);
    const favorites = await toggleFavoriteAsync(user.id, historyId);
    logInfo(ctx, "favorites.toggle", { userId: user.id, historyId, count: favorites.length, ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ favorites }), ctx);
  } catch (error) {
    logError(ctx, "favorites.toggle.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Failed to toggle favorite" }, { status: 500 }), ctx);
  }
}
