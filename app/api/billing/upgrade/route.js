import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { registerManualPaymentIntentAsync } from "@/lib/server/billing-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";
import { buildUpgradeTransferNote, MANUAL_PRO_PAYMENT } from "@/lib/manual-payment-config";

const SUPPORTED_METHODS = new Set(["card", "bank_transfer", "momo", "zalopay"]);

function sanitizeTransferRef(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32).toUpperCase();
}

function normalizePaymentMethod(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "card") return "bank_transfer";
  return SUPPORTED_METHODS.has(raw) ? raw : "bank_transfer";
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/billing/upgrade");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) {
      return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    }

    const payload = await request.json().catch(() => ({}));
    const method = normalizePaymentMethod(payload?.method || "bank_transfer");
    const transferRef = sanitizeTransferRef(payload?.transferRef || "");

    if (transferRef.length < 6) {
      return withRequestId(NextResponse.json({ error: "Missing transfer fields" }, { status: 400 }), ctx);
    }

    const transactionRef = `${method}_${transferRef || Math.random().toString(36).slice(2, 8)}_${Date.now()}`;

    const amount = Number(MANUAL_PRO_PAYMENT.amount || 129000);
    const planInfo = await registerManualPaymentIntentAsync(user.id, {
      method,
      transferRef,
      amount,
      currency: MANUAL_PRO_PAYMENT.currency || "VND"
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
      pendingManualVerification: true,
      planInfo,
      receipt: {
        method,
        transactionRef: `manual_${transferRef}`,
        amount,
        currency: MANUAL_PRO_PAYMENT.currency || "VND",
        cardLast4: "",
        payerName: "",
        transferRef,
        transferNote: buildUpgradeTransferNote(transferRef)
      }
    }), ctx);
  } catch (error) {
    logError(ctx, "billing.upgrade.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to process upgrade" }, { status: 400 }), ctx);
  }
}
