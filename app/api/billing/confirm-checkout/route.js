import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { retrieveStripeCheckoutSession } from "@/lib/server/stripe-service";
import { upgradeUserToProAsync } from "@/lib/server/billing-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/billing/confirm-checkout");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) {
      return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    }

    const payload = await request.json().catch(() => ({}));
    const sessionId = String(payload?.sessionId || "").trim();
    if (!sessionId) {
      return withRequestId(NextResponse.json({ error: "sessionId is required" }, { status: 400 }), ctx);
    }

    const checkoutSession = await retrieveStripeCheckoutSession(sessionId);
    const metadataUserId = String(checkoutSession?.metadata?.user_id || "").trim();
    if (metadataUserId && metadataUserId !== String(user.id)) {
      return withRequestId(NextResponse.json({ error: "Checkout session does not belong to current user" }, { status: 403 }), ctx);
    }

    if (String(checkoutSession?.payment_status || "").toLowerCase() !== "paid") {
      return withRequestId(NextResponse.json({ error: "Payment is not completed" }, { status: 400 }), ctx);
    }

    const amountTotal = Number(checkoutSession?.amount_total || 299000);
    const currency = String(checkoutSession?.currency || "vnd").toUpperCase();
    const planInfo = await upgradeUserToProAsync(user.id, {
      provider: "stripe",
      transactionRef: String(checkoutSession?.payment_intent?.id || checkoutSession?.id || "stripe_checkout"),
      amount: Number.isFinite(amountTotal) ? amountTotal : 299000,
      currency
    });

    logInfo(ctx, "billing.stripe.checkout_confirmed", {
      userId: user.id,
      checkoutSessionId: checkoutSession?.id || null,
      paymentStatus: checkoutSession?.payment_status || null,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({ ok: true, planInfo }), ctx);
  } catch (error) {
    logError(ctx, "billing.stripe.checkout_confirm_failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to confirm checkout" }, { status: 400 }), ctx);
  }
}
