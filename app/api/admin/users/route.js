import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync, isAdminEmail } from "@/lib/server/auth-service";
import { listAdminUsersAsync } from "@/lib/server/admin-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function ensureAdmin(user) {
  if (!user || !isAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
}

export async function GET(request) {
  const ctx = createRequestContext(request, "/api/admin/users");
  try {
    const actor = await getCurrentUserFromCookiesAsync();
    ensureAdmin(actor);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 20);

    const result = await listAdminUsersAsync({ query, page, pageSize });
    logInfo(ctx, "admin.users.list", {
      actorId: actor.id,
      count: result.items.length,
      total: result.meta.total,
      page: result.meta.page,
      pageSize: result.meta.pageSize,
      query,
      ms: elapsedMs(ctx)
    });
    return withRequestId(NextResponse.json(result), ctx);
  } catch (error) {
    const status = error.message === "Forbidden" ? 403 : 400;
    logError(ctx, "admin.users.list.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error.message || "Unable to fetch users" }, { status }), ctx);
  }
}
