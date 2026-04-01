import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync, isAdminEmail } from "@/lib/server/auth-service";
import {
  listAdminSupportConversationsAsync,
  getAdminSupportConversationThreadAsync,
  sendAdminSupportMessageAsync
} from "@/lib/server/support-chat-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function ensureAdmin(user) {
  if (!user || !isAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
}

export async function GET(request) {
  const ctx = createRequestContext(request, "/api/admin/support/chat");
  try {
    const actor = await getCurrentUserFromCookiesAsync();
    ensureAdmin(actor);

    const { searchParams } = new URL(request.url);
    const conversationId = String(searchParams.get("conversationId") || "").trim();

    if (conversationId) {
      const thread = await getAdminSupportConversationThreadAsync(conversationId);
      logInfo(ctx, "admin.support.chat.thread", {
        actorId: actor.id,
        conversationId,
        messageCount: thread.messages.length,
        ms: elapsedMs(ctx)
      });
      return withRequestId(NextResponse.json(thread), ctx);
    }

    const status = searchParams.get("status") || "";
    const query = searchParams.get("q") || "";
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 20);
    const list = await listAdminSupportConversationsAsync({ status, query, page, pageSize });

    logInfo(ctx, "admin.support.chat.list", {
      actorId: actor.id,
      count: list.items.length,
      total: list.meta.total,
      ms: elapsedMs(ctx)
    });
    return withRequestId(NextResponse.json(list), ctx);
  } catch (error) {
    const status = error.message === "Forbidden"
      ? 403
      : (String(error?.message || "").includes("chưa được migrate") ? 400 : 500);
    logError(ctx, "admin.support.chat.get.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error.message || "Unable to load support chat" }, { status }), ctx);
  }
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/admin/support/chat");
  try {
    const actor = await getCurrentUserFromCookiesAsync();
    ensureAdmin(actor);

    const body = await request.json().catch(() => ({}));
    const conversationId = String(body?.conversationId || "").trim();
    if (!conversationId) {
      return withRequestId(NextResponse.json({ error: "conversationId is required" }, { status: 400 }), ctx);
    }

    const thread = await sendAdminSupportMessageAsync(actor, conversationId, {
      message: body?.message,
      status: body?.status
    });

    logInfo(ctx, "admin.support.chat.post", {
      actorId: actor.id,
      conversationId,
      status: thread.conversation.status,
      ms: elapsedMs(ctx)
    });
    return withRequestId(NextResponse.json(thread), ctx);
  } catch (error) {
    const status = error.message === "Forbidden"
      ? 403
      : (String(error?.message || "").includes("chưa được migrate") ? 400 : 500);
    logError(ctx, "admin.support.chat.post.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error.message || "Unable to send admin message" }, { status }), ctx);
  }
}
