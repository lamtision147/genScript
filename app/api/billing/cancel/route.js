import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { downgradeUserToFreeAsync } from "@/lib/server/billing-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/billing/cancel");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) {
      return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    }

    const planInfo = await downgradeUserToFreeAsync(user.id, {
      provider: "manual",
      transactionRef: `cancel_${Date.now()}`
    });

    logInfo(ctx, "billing.cancel.success", {
      userId: user.id,
      plan: planInfo.plan,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({ ok: true, planInfo }), ctx);
  } catch (error) {
    logError(ctx, "billing.cancel.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to cancel plan" }, { status: 400 }), ctx);
  }
}
