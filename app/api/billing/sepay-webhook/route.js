import crypto from "crypto";
import { NextResponse } from "next/server";
import { activatePendingManualPaymentAsync } from "@/lib/server/billing-service";
import { sanitizeTransferRef } from "@/lib/manual-payment-config";
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

function parseJsonSafe(text) {
  try {
    return JSON.parse(String(text || "{}"));
  } catch {
    return {};
  }
}

function pickFirst(payload, keys = []) {
  for (const key of keys) {
    const value = payload?.[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
}

function parseAmount(value) {
  const raw = String(value || "").replace(/[^\d.-]/g, "");
  const amount = Number(raw);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(0, Math.floor(amount));
}

function extractTransferRef(payload) {
  const direct = sanitizeTransferRef(pickFirst(payload, ["transferRef", "reference", "orderCode", "code"]));
  if (direct.length >= 6) return direct;

  const content = pickFirst(payload, ["content", "description", "transferContent", "transactionContent", "addInfo", "message"]);
  if (!content) return "";

  const prefixed = String(content).toUpperCase().match(/\bPRO[\s:_-]*([A-Z0-9_-]{6,32})\b/i);
  if (prefixed?.[1]) {
    return sanitizeTransferRef(prefixed[1]);
  }

  return "";
}

function extractTransactionId(payload, rawBody) {
  const tx = pickFirst(payload, [
    "gatewayTransactionId",
    "transactionId",
    "id",
    "referenceCode",
    "sepayTransactionId",
    "txnId"
  ]);
  if (tx) return `sepay_${tx}`;
  const hash = crypto.createHash("sha256").update(String(rawBody || "")).digest("hex").slice(0, 24);
  return `sepay_body_${hash}`;
}

function extractWebhookToken(request, payload = {}) {
  const authHeader = getHeader(request, "authorization");
  const authToken = authHeader.replace(/^(bearer|token|apikey)\s+/i, "").trim();
  return pickFirst({
    authToken,
    xSepaySignature: getHeader(request, "x-sepay-signature"),
    xSepayToken: getHeader(request, "x-sepay-token"),
    xApiKey: getHeader(request, "x-api-key"),
    token: payload?.token,
    apiKey: payload?.apiKey,
    secret: payload?.secret
  }, ["xSepaySignature", "xSepayToken", "xApiKey", "authToken", "token", "apiKey", "secret"]);
}

function verifySepayWebhookToken(request, payload = {}) {
  const configured = String(process.env.SEPAY_WEBHOOK_SECRET || "").trim();
  if (!configured) return true;
  const provided = extractWebhookToken(request, payload);
  if (!provided || provided !== configured) {
    throw new Error("Invalid SePay webhook token");
  }
  return true;
}

function isMissingWebhookTableError(error) {
  const message = String(error?.message || "");
  return /billing_webhook_events|relation.+does not exist|schema cache/i.test(message);
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
      if (isMissingWebhookTableError(error)) {
        const localRows = readJsonArray(paths.billingWebhookEvents);
        return localRows.some((row) => row?.kind === "billing_webhook_event" && row?.eventId === normalized);
      }
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
      event_type: String(eventType || "sepay.transfer"),
      payload: payload || {}
    });

    if (error) {
      if (/duplicate|unique/i.test(String(error.message || ""))) {
        return;
      }
      if (isMissingWebhookTableError(error)) {
        const rows = readJsonArray(paths.billingWebhookEvents);
        if (!rows.some((row) => row?.kind === "billing_webhook_event" && row?.eventId === normalized)) {
          rows.unshift({
            kind: "billing_webhook_event",
            eventId: normalized,
            eventType: String(eventType || "sepay.transfer"),
            createdAt: new Date().toISOString()
          });
          writeJsonArray(paths.billingWebhookEvents, rows.slice(0, 5000));
        }
        return;
      }
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
      eventType: String(eventType || "sepay.transfer"),
      createdAt: new Date().toISOString()
    });
    writeJsonArray(paths.billingWebhookEvents, rows.slice(0, 5000));
  }
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/billing/sepay-webhook");
  try {
    const rawBody = await request.text();
    const payload = parseJsonSafe(rawBody);

    verifySepayWebhookToken(request, payload);

    const eventId = extractTransactionId(payload, rawBody);
    const eventType = String(payload?.type || payload?.status || "sepay.transfer").toLowerCase();

    const alreadyProcessed = await hasProcessedWebhookEvent(eventId);
    if (alreadyProcessed) {
      logInfo(ctx, "billing.sepay.webhook.duplicate_ignored", {
        eventId,
        eventType,
        ms: elapsedMs(ctx)
      });
      return withRequestId(NextResponse.json({ received: true, duplicate: true }), ctx);
    }

    const transferRef = extractTransferRef(payload);
    const amount = parseAmount(pickFirst(payload, ["transferAmount", "amount", "creditAmount", "transactionAmount"]));

    let activationResult = null;
    if (transferRef) {
      activationResult = await activatePendingManualPaymentAsync({
        transferRef,
        paidAmount: amount,
        provider: "sepay",
        transactionRef: eventId
      });
    }

    await markWebhookEventProcessed({
      eventId,
      eventType,
      payload
    });

    logInfo(ctx, "billing.sepay.webhook.processed", {
      eventId,
      transferRef: transferRef || null,
      amount,
      activation: activationResult?.reason || "ignored",
      userId: activationResult?.userId || null,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({
      received: true,
      transferRef: transferRef || null,
      amount,
      activation: activationResult || {
        ok: false,
        reason: transferRef ? "not_found" : "transfer_ref_not_found"
      }
    }), ctx);
  } catch (error) {
    const status = /invalid sepay webhook token/i.test(String(error?.message || "")) ? 401 : 400;
    logError(ctx, "billing.sepay.webhook.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "SePay webhook failed" }, { status }), ctx);
  }
}
