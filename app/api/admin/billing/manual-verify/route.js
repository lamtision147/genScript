import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync, isAdminEmail } from "@/lib/server/auth-service";
import { upgradeUserToProAsync } from "@/lib/server/billing-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function ensureAdmin(user) {
  if (!user || !isAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
}

function sanitizeTransferRef(value = "") {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32).toUpperCase();
}

function sanitizeAmount(value, fallback = 129000) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/admin/billing/manual-verify");
  try {
    const actor = await getCurrentUserFromCookiesAsync();
    ensureAdmin(actor);

    const payload = await request.json().catch(() => ({}));
    const userId = String(payload?.userId || "").trim();
    const method = String(payload?.method || "bank_transfer").trim().toLowerCase();
    const transferRef = sanitizeTransferRef(payload?.transferRef || "");
    const amount = sanitizeAmount(payload?.amount, 129000);

    if (!userId) {
      return withRequestId(NextResponse.json({ error: "userId is required" }, { status: 400 }), ctx);
    }

    if (!transferRef) {
      return withRequestId(NextResponse.json({ error: "transferRef is required" }, { status: 400 }), ctx);
    }

    const planInfo = await upgradeUserToProAsync(userId, {
      provider: `manual_${method}`,
      transactionRef: `manual_${transferRef}`,
      amount,
      currency: "VND"
    });

    logInfo(ctx, "admin.billing.manual_verify.success", {
      actorId: actor.id,
      userId,
      method,
      transferRef,
      amount,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({ ok: true, planInfo }), ctx);
  } catch (error) {
    const status = error?.message === "Forbidden" ? 403 : 400;
    logError(ctx, "admin.billing.manual_verify.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to verify manual payment" }, { status }), ctx);
  }
}
