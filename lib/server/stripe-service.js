import crypto from "crypto";

const STRIPE_API_BASE = "https://api.stripe.com/v1";

function getStripeSecretKey() {
  return String(process.env.STRIPE_SECRET_KEY || "").trim();
}

function normalizeCurrency(value) {
  const raw = String(value || "vnd").trim().toLowerCase();
  return raw || "vnd";
}

function toFormBody(payload = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    if (value === null || value === undefined) continue;
    params.set(key, String(value));
  }
  return params.toString();
}

async function stripeRequest(path, { method = "GET", form = null } = {}) {
  const secret = getStripeSecretKey();
  if (!secret) {
    throw new Error("Stripe secret key is not configured.");
  }

  const response = await fetch(`${STRIPE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {})
    },
    body: form ? toFormBody(form) : undefined,
    cache: "no-store"
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = data?.error?.message || `Stripe request failed (${response.status})`;
    throw new Error(errorMessage);
  }
  return data;
}

export async function createStripeCheckoutSession({ userId, email, successUrl, cancelUrl, amount = 299000, currency = "vnd" }) {
  const unitAmount = Math.max(1000, Math.floor(Number(amount) || 299000));
  const safeCurrency = normalizeCurrency(currency);

  return stripeRequest("/checkout/sessions", {
    method: "POST",
    form: {
      mode: "payment",
      success_url: successUrl,
      cancel_url: cancelUrl,
      "line_items[0][price_data][currency]": safeCurrency,
      "line_items[0][price_data][unit_amount]": unitAmount,
      "line_items[0][price_data][product_data][name]": "Seller Studio Pro (30 days)",
      "line_items[0][price_data][product_data][description]": "Unlock unlimited history and favorites for Seller Studio.",
      "line_items[0][quantity]": 1,
      "metadata[user_id]": String(userId || ""),
      "metadata[plan]": "pro",
      ...(email ? { customer_email: String(email) } : {})
    }
  });
}

export async function retrieveStripeCheckoutSession(sessionId) {
  const normalized = String(sessionId || "").trim();
  if (!normalized) throw new Error("sessionId is required");
  return stripeRequest(`/checkout/sessions/${encodeURIComponent(normalized)}?expand[]=payment_intent`);
}

function parseStripeSignatureHeader(headerValue) {
  const parts = String(headerValue || "")
    .split(",")
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  const parsed = {};
  for (const part of parts) {
    const [k, v] = part.split("=");
    if (!k || !v) continue;
    parsed[k] = v;
  }
  return {
    timestamp: parsed.t || "",
    signatureV1: parsed.v1 || ""
  };
}

function safeEqualHex(hexA, hexB) {
  const a = Buffer.from(String(hexA || ""), "hex");
  const b = Buffer.from(String(hexB || ""), "hex");
  if (a.length !== b.length || !a.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function verifyStripeWebhookSignature({ payload, signatureHeader, toleranceSec = 300 }) {
  const secret = String(process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  if (!secret) {
    throw new Error("Stripe webhook secret is not configured.");
  }

  const { timestamp, signatureV1 } = parseStripeSignatureHeader(signatureHeader);
  if (!timestamp || !signatureV1) {
    throw new Error("Invalid Stripe signature header.");
  }

  const now = Math.floor(Date.now() / 1000);
  const tsNumber = Number(timestamp);
  if (!Number.isFinite(tsNumber) || Math.abs(now - tsNumber) > toleranceSec) {
    throw new Error("Stripe webhook timestamp is out of tolerance.");
  }

  const signedPayload = `${timestamp}.${String(payload || "")}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload, "utf8").digest("hex");

  if (!safeEqualHex(expected, signatureV1)) {
    throw new Error("Invalid Stripe webhook signature.");
  }

  return true;
}
