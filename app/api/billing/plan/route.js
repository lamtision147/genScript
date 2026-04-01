import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { ensurePlanInfoForUserAsync, getPaymentProviderStatus } from "@/lib/server/billing-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function GET(request) {
  const ctx = createRequestContext(request, "/api/billing/plan");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) {
      return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    }

    const planInfo = await ensurePlanInfoForUserAsync(user);
    const payment = getPaymentProviderStatus();
    logInfo(ctx, "billing.plan.get", {
      userId: user.id,
      plan: planInfo.plan,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({ planInfo, payment }), ctx);
  } catch (error) {
    logError(ctx, "billing.plan.get.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to load billing plan" }, { status: 400 }), ctx);
  }
}
