import { NextResponse } from "next/server";
import { verifyStripeWebhookSignature } from "@/lib/server/stripe-service";
import { upgradeUserToProAsync } from "@/lib/server/billing-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { readJsonArray, writeJsonArray, paths } from "@/lib/server/local-store";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function getHeader(request, name) {
  try {
    return request.headers.get(name) || "";
  } catch {
    return "";
  }
}

async function hasProcessedWebhookEvent(eventId) {
  const normalized = String(eventId || "").trim();
  if (!normalized) return false;

  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("billing_webhook_events")
      .select("event_id")
      .eq("event_id", normalized)
      .maybeSingle();
    if (error) {
      throw new Error(error.message || "Unable to check webhook event idempotency");
    }
    return Boolean(data?.event_id);
  }

  const rows = readJsonArray(paths.billingWebhookEvents);
  return rows.some((row) => row?.kind === "billing_webhook_event" && row?.eventId === normalized);
}

async function markWebhookEventProcessed({ eventId, eventType, payload }) {
  const normalized = String(eventId || "").trim();
  if (!normalized) return;

  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { error } = await supabase.from("billing_webhook_events").insert({
      event_id: normalized,
      event_type: String(eventType || "unknown"),
      payload: payload || {}
    });
    if (error && !/duplicate|unique/i.test(String(error.message || ""))) {
      throw new Error(error.message || "Unable to persist webhook event idempotency");
    }
    return;
  }

  const rows = readJsonArray(paths.billingWebhookEvents);
  const exists = rows.some((row) => row?.kind === "billing_webhook_event" && row?.eventId === normalized);
  if (!exists) {
    rows.unshift({
      kind: "billing_webhook_event",
      eventId: normalized,
      eventType: String(eventType || "unknown"),
      createdAt: new Date().toISOString()
    });
    writeJsonArray(paths.billingWebhookEvents, rows.slice(0, 5000));
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
    const eventId = String(event?.id || "").trim();
    const eventType = String(event?.type || "unknown");

    if (eventId) {
      const alreadyProcessed = await hasProcessedWebhookEvent(eventId);
      if (alreadyProcessed) {
        logInfo(ctx, "billing.stripe.webhook.duplicate_ignored", {
          eventId,
          eventType,
          ms: elapsedMs(ctx)
        });
        return withRequestId(NextResponse.json({ received: true, duplicate: true }), ctx);
      }
    }

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
        eventId: eventId || null,
        ms: elapsedMs(ctx)
      });
    }

    if (eventId) {
      await markWebhookEventProcessed({
        eventId,
        eventType,
        payload: event
      });
    }

    return withRequestId(NextResponse.json({ received: true }), ctx);
  } catch (error) {
    logError(ctx, "billing.stripe.webhook.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Webhook verification failed" }, { status: 400 }), ctx);
  }
}
