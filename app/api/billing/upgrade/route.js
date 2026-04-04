import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { registerManualPaymentIntentAsync, upgradeUserToProAsync } from "@/lib/server/billing-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";
import { buildUpgradeTransferNote, MANUAL_PRO_PAYMENT } from "@/lib/manual-payment-config";

const SUPPORTED_METHODS = new Set(["card", "bank_transfer", "momo", "zalopay"]);

function sanitizeCardLast4(value) {
  const digits = String(value || "").replace(/\D+/g, "");
  if (digits.length < 4) return "";
  return digits.slice(-4);
}

function sanitizeTransferRef(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32).toUpperCase();
}

function normalizePaymentMethod(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  return SUPPORTED_METHODS.has(raw) ? raw : "card";
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/billing/upgrade");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) {
      return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    }

    const payload = await request.json().catch(() => ({}));
    const method = normalizePaymentMethod(payload?.method || "card");
    const cardHolder = String(payload?.cardHolder || "").trim();
    const cardNumber = String(payload?.cardNumber || "").trim();
    const expiry = String(payload?.expiry || "").trim();
    const cvc = String(payload?.cvc || "").trim();
    const payerName = String(payload?.payerName || "").trim();
    const transferRef = sanitizeTransferRef(payload?.transferRef || "");

    if (method === "card") {
      if (!cardHolder || !cardNumber || !expiry || !cvc) {
        return withRequestId(NextResponse.json({ error: "Missing payment fields" }, { status: 400 }), ctx);
      }
    } else if (!payerName || transferRef.length < 6) {
      return withRequestId(NextResponse.json({ error: "Missing transfer fields" }, { status: 400 }), ctx);
    }

    const transactionRef = method === "card"
      ? `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      : `${method}_${transferRef || Math.random().toString(36).slice(2, 8)}_${Date.now()}`;

    const cardLast4 = method === "card" ? sanitizeCardLast4(cardNumber) : "";

    const amount = Number(MANUAL_PRO_PAYMENT.amount || 129000);
    const isManualMethod = method !== "card";
    const planInfo = isManualMethod
      ? await registerManualPaymentIntentAsync(user.id, {
        method,
        transferRef,
        amount,
        currency: MANUAL_PRO_PAYMENT.currency || "VND"
      })
      : await upgradeUserToProAsync(user.id, {
        provider: `mock_${method}`,
        transactionRef,
        amount,
        currency: MANUAL_PRO_PAYMENT.currency || "VND",
        cardLast4
      });

    logInfo(ctx, "billing.upgrade.success", {
      userId: user.id,
      plan: planInfo.plan,
      method,
      transactionRef,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({
      ok: true,
      pendingManualVerification: isManualMethod,
      planInfo,
      receipt: {
        method,
        transactionRef: isManualMethod ? `manual_${transferRef}` : transactionRef,
        amount,
        currency: MANUAL_PRO_PAYMENT.currency || "VND",
        cardLast4,
        payerName: method === "card" ? cardHolder : payerName,
        transferRef: method === "card" ? "" : transferRef,
        transferNote: method === "card" ? "" : buildUpgradeTransferNote(transferRef)
      }
    }), ctx);
  } catch (error) {
    logError(ctx, "billing.upgrade.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to process upgrade" }, { status: 400 }), ctx);
  }
}
