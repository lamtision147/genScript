import { NextResponse } from "next/server";
import { verifyStripeWebhookSignature } from "@/lib/server/stripe-service";
import { upgradeUserToProAsync } from "@/lib/server/billing-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function getHeader(request, name) {
  try {
    return request.headers.get(name) || "";
  } catch {
    return "";
  }
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/billing/stripe-webhook");
  try {
    const rawBody = await request.text();
    const signatureHeader = getHeader(request, "stripe-signature");

    verifyStripeWebhookSignature({
      payload: rawBody,
      signatureHeader
    });

    const event = JSON.parse(rawBody || "{}");
    if (event?.type === "checkout.session.completed") {
      const session = event?.data?.object || {};
      const userId = String(session?.metadata?.user_id || "").trim();
      if (userId) {
        await upgradeUserToProAsync(userId, {
          provider: "stripe",
          transactionRef: String(session?.payment_intent || session?.id || "stripe_webhook"),
          amount: Number(session?.amount_total || 299000),
          currency: String(session?.currency || "vnd").toUpperCase()
        });
      }

      logInfo(ctx, "billing.stripe.webhook.checkout_completed", {
        userId: userId || null,
        checkoutSessionId: session?.id || null,
        ms: elapsedMs(ctx)
      });
    }

    return withRequestId(NextResponse.json({ received: true }), ctx);
  } catch (error) {
    logError(ctx, "billing.stripe.webhook.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Webhook verification failed" }, { status: 400 }), ctx);
  }
}
