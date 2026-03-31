import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { createFeedbackEntry } from "@/lib/server/feedback-service";
import { trackTelemetryEvent } from "@/lib/server/telemetry-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/feedback");
  try {
    const body = await request.json().catch(() => ({}));
    const user = await getCurrentUserFromCookiesAsync();

    const entry = createFeedbackEntry({
      ...body,
      userId: user?.id || null,
      requestId: ctx.requestId,
      sessionId: body?.sessionId || null
    });

    trackTelemetryEvent({
      type: "feedback.submit",
      requestId: ctx.requestId,
      userId: user?.id || null,
      sessionId: body?.sessionId || null,
      payload: {
        type: entry.type,
        rating: entry.rating,
        page: entry.page,
        category: entry.category
      }
    });

    logInfo(ctx, "feedback.submit", {
      userId: user?.id || null,
      type: entry.type,
      rating: entry.rating,
      page: entry.page,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({ ok: true, id: entry.id }), ctx);
  } catch (error) {
    logError(ctx, "feedback.submit.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error.message || "Unable to save feedback" }, { status: 400 }), ctx);
  }
}
