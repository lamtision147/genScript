import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync, isAdminEmail } from "@/lib/server/auth-service";
import { getAiUsageSummary } from "@/lib/server/ai-usage-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function ensureAdmin(user) {
  if (!user || !isAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
}

export async function GET(request) {
  const ctx = createRequestContext(request, "/api/admin/ai-usage");
  try {
    const actor = await getCurrentUserFromCookiesAsync();
    ensureAdmin(actor);

    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("days") || 30);
    const summary = getAiUsageSummary({ days });

    logInfo(ctx, "admin.ai-usage", {
      actorId: actor.id,
      days,
      requestCount: summary?.totals?.requestCount || 0,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json(summary), ctx);
  } catch (error) {
    const status = error.message === "Forbidden" ? 403 : 400;
    logError(ctx, "admin.ai-usage.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error.message || "Unable to fetch AI usage" }, { status }), ctx);
  }
}
