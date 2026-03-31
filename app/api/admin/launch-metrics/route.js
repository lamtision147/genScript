import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync, isAdminEmail } from "@/lib/server/auth-service";
import { getLaunchMetricsSummary } from "@/lib/server/telemetry-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function ensureAdmin(user) {
  if (!user || !isAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
}

export async function GET(request) {
  const ctx = createRequestContext(request, "/api/admin/launch-metrics");
  try {
    const actor = await getCurrentUserFromCookiesAsync();
    ensureAdmin(actor);

    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days") || 14);
    const summary = getLaunchMetricsSummary({ days });

    logInfo(ctx, "admin.launch-metrics", {
      actorId: actor.id,
      days: summary.days,
      telemetryEvents: summary?.totals?.telemetryEvents || 0,
      generateSubmit: summary?.totals?.generateSubmit || 0,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json(summary), ctx);
  } catch (error) {
    const status = error.message === "Forbidden" ? 403 : 400;
    logError(ctx, "admin.launch-metrics.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error.message || "Unable to fetch launch metrics" }, { status }), ctx);
  }
}
