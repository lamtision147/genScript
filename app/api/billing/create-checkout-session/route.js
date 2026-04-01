import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { createStripeCheckoutSession } from "@/lib/server/stripe-service";
import { appEnv } from "@/lib/env";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function buildUrls(request, language = "vi") {
  const origin = String(appEnv.publicBaseUrl || new URL(request.url).origin).trim();
  const successUrl = `${origin}/upgrade?checkout=success&lang=${encodeURIComponent(language)}&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl = `${origin}/upgrade?checkout=cancel&lang=${encodeURIComponent(language)}`;
  return { successUrl, cancelUrl };
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/billing/create-checkout-session");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) {
      return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    }

    const payload = await request.json().catch(() => ({}));
    const language = String(payload?.language || "vi").toLowerCase();
    const { successUrl, cancelUrl } = buildUrls(request, language);

    const session = await createStripeCheckoutSession({
      userId: user.id,
      email: user.email,
      successUrl,
      cancelUrl,
      amount: 299000,
      currency: "vnd"
    });

    logInfo(ctx, "billing.stripe.checkout_session.created", {
      userId: user.id,
      checkoutSessionId: session?.id || null,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({
      ok: true,
      provider: "stripe",
      checkoutUrl: session?.url || "",
      checkoutSessionId: session?.id || ""
    }), ctx);
  } catch (error) {
    logError(ctx, "billing.stripe.checkout_session.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to create checkout session" }, { status: 400 }), ctx);
  }
}
