import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync, isAdminEmail } from "@/lib/server/auth-service";
import { adminResetUserPasswordAsync } from "@/lib/server/admin-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function ensureAdmin(user) {
  if (!user || !isAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/admin/users/reset-password");
  try {
    const actor = await getCurrentUserFromCookiesAsync();
    ensureAdmin(actor);

    const payload = await request.json();
    await adminResetUserPasswordAsync(payload.userId, payload.newPassword);

    logInfo(ctx, "admin.users.reset-password", { actorId: actor.id, targetUserId: payload.userId, ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ ok: true }), ctx);
  } catch (error) {
    const status = error.message === "Forbidden" ? 403 : 400;
    logError(ctx, "admin.users.reset-password.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error.message || "Unable to reset password" }, { status }), ctx);
  }
}
