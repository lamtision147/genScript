import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { getUserSupportChatThreadAsync, sendUserSupportMessageAsync } from "@/lib/server/support-chat-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function GET(request) {
  const ctx = createRequestContext(request, "/api/support/chat");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) {
      return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    }

    const thread = await getUserSupportChatThreadAsync(user);
    logInfo(ctx, "support.chat.thread", {
      userId: user.id,
      conversationId: thread.conversation.id,
      messageCount: thread.messages.length,
      ms: elapsedMs(ctx)
    });
    return withRequestId(NextResponse.json(thread), ctx);
  } catch (error) {
    logError(ctx, "support.chat.thread.failed", error, { ms: elapsedMs(ctx) });
    const status = String(error?.message || "").includes("chưa được migrate") ? 400 : 500;
    return withRequestId(NextResponse.json({ error: error.message || "Unable to load support chat" }, { status }), ctx);
  }
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/support/chat");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) {
      return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    }

    const body = await request.json().catch(() => ({}));
    const result = await sendUserSupportMessageAsync(user, {
      message: body?.message
    });

    logInfo(ctx, "support.chat.message", {
      userId: user.id,
      conversationId: result.conversation.id,
      status: result.conversation.status,
      ms: elapsedMs(ctx)
    });
    return withRequestId(NextResponse.json(result), ctx);
  } catch (error) {
    logError(ctx, "support.chat.message.failed", error, { ms: elapsedMs(ctx) });
    const status = String(error?.message || "").includes("chưa được migrate") ? 400 : 500;
    return withRequestId(NextResponse.json({ error: error.message || "Unable to send support message" }, { status }), ctx);
  }
}
