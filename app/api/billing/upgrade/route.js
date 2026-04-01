import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { upgradeUserToProAsync } from "@/lib/server/billing-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function sanitizeCardLast4(value) {
  const digits = String(value || "").replace(/\D+/g, "");
  if (digits.length < 4) return "";
  return digits.slice(-4);
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/billing/upgrade");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) {
      return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    }

    const payload = await request.json().catch(() => ({}));
    const cardHolder = String(payload?.cardHolder || "").trim();
    const cardNumber = String(payload?.cardNumber || "").trim();
    const expiry = String(payload?.expiry || "").trim();
    const cvc = String(payload?.cvc || "").trim();

    if (!cardHolder || !cardNumber || !expiry || !cvc) {
      return withRequestId(NextResponse.json({ error: "Missing payment fields" }, { status: 400 }), ctx);
    }

    const transactionRef = `mock_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const planInfo = await upgradeUserToProAsync(user.id, {
      provider: "mock",
      transactionRef,
      amount: 299000,
      currency: "VND",
      cardLast4: sanitizeCardLast4(cardNumber)
    });

    logInfo(ctx, "billing.upgrade.success", {
      userId: user.id,
      plan: planInfo.plan,
      transactionRef,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({
      ok: true,
      planInfo,
      receipt: {
        transactionRef,
        amount: 299000,
        currency: "VND",
        cardLast4: sanitizeCardLast4(cardNumber)
      }
    }), ctx);
  } catch (error) {
    logError(ctx, "billing.upgrade.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to process upgrade" }, { status: 400 }), ctx);
  }
}
