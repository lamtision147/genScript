import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { buildUpgradeTransferNote, buildVietQrImageUrl, MANUAL_PRO_PAYMENT, sanitizeTransferRef } from "@/lib/manual-payment-config";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function defaultTransferRef(userId = "") {
  const compactUser = String(userId || "").replace(/[^a-zA-Z0-9]/g, "").slice(-8).toUpperCase() || "USER";
  return sanitizeTransferRef(`${compactUser}${Date.now().toString().slice(-6)}`);
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/billing/manual-intent");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) {
      return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    }

    const payload = await request.json().catch(() => ({}));
    const transferRef = sanitizeTransferRef(payload?.transferRef || defaultTransferRef(user.id));
    if (!transferRef || transferRef.length < 6) {
      return withRequestId(NextResponse.json({ error: "Invalid transfer reference" }, { status: 400 }), ctx);
    }

    const amount = Number(MANUAL_PRO_PAYMENT.amount || 129000);

    const result = {
      method: String(payload?.method || "bank_transfer").trim().toLowerCase(),
      bankCode: MANUAL_PRO_PAYMENT.bankCode,
      bankName: MANUAL_PRO_PAYMENT.bankName,
      accountNumber: MANUAL_PRO_PAYMENT.accountNumber,
      accountName: MANUAL_PRO_PAYMENT.accountName,
      amount,
      currency: MANUAL_PRO_PAYMENT.currency,
      transferRef,
      transferNote: buildUpgradeTransferNote(transferRef),
      qrImageUrl: buildVietQrImageUrl({ amount, transferRef })
    };

    logInfo(ctx, "billing.manual_intent.created", {
      userId: user.id,
      method: result.method,
      transferRef: result.transferRef,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({ ok: true, payment: result }), ctx);
  } catch (error) {
    logError(ctx, "billing.manual_intent.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to create manual payment intent" }, { status: 400 }), ctx);
  }
}
