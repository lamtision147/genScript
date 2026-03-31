import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { trackTelemetryEvent } from "@/lib/server/telemetry-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/telemetry");
  try {
    const payload = await request.json().catch(() => ({}));
    const user = await getCurrentUserFromCookiesAsync();

    trackTelemetryEvent({
      type: payload.type,
      requestId: ctx.requestId,
      userId: user?.id || null,
      sessionId: payload.sessionId || null,
      payload: payload.payload || {}
    });

    logInfo(ctx, "telemetry.track", { type: payload.type || "unknown", userId: user?.id || null, ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ ok: true }), ctx);
  } catch (error) {
    logError(ctx, "telemetry.track.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ ok: false }, { status: 400 }), ctx);
  }
}
