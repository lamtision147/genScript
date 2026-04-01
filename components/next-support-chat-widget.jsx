"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { routes } from "@/lib/routes";
import { trackEvent } from "@/lib/client/telemetry";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

function compact(value = "", max = 2000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function toTimestamp(value) {
  const ms = new Date(value || 0).getTime();
  return Number.isFinite(ms) ? ms : 0;
}

function seenStorageKey(conversationId = "") {
  return `support-chat-seen-at:${conversationId}`;
}

function readSeenAt(conversationId = "") {
  if (!conversationId || typeof window === "undefined") return 0;
  try {
    return toTimestamp(window.localStorage.getItem(seenStorageKey(conversationId)) || 0);
  } catch {
    return 0;
  }
}

function writeSeenAt(conversationId = "", iso = "") {
  if (!conversationId || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(seenStorageKey(conversationId), iso);
  } catch {
    // noop
  }
}

function calculateUnread(messages = [], seenAtMs = 0) {
  return (Array.isArray(messages) ? messages : []).filter((item) => {
    if (item?.role !== "admin") return false;
    return toTimestamp(item?.createdAt) > seenAtMs;
  }).length;
}

function normalizeErrorMessage(message = "", language = "vi") {
  const text = String(message || "").toLowerCase();
  if (text.includes("support chat database") || text.includes("support_chat_")) {
    return language === "vi"
      ? "Support chat chưa sẵn sàng. Vui lòng kiểm tra migration trong Supabase rồi thử lại."
      : "Support chat is not ready yet. Please check Supabase migration and try again.";
  }
  return message;
}

export default function NextSupportChatWidget({
  language = "vi",
  page = "unknown",
  user = null,
  context = {},
  isAuthenticated = false
}) {
  const facebookChatUrl = String(process.env.NEXT_PUBLIC_FACEBOOK_CHAT_URL || "https://www.facebook.com/phuong.vu.19029/").trim();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [messageDraft, setMessageDraft] = useState("");
  const [error, setError] = useState("");
  const [thread, setThread] = useState({ conversation: null, messages: [] });
  const [realtimeReady, setRealtimeReady] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const scrollRef = useRef(null);
  const channelRef = useRef(null);
  const supabaseRef = useRef(null);

  const text = useMemo(() => {
    const isVi = language === "vi";
    return {
      openLabel: isVi ? "Chat hỗ trợ" : "Support chat",
      closeLabel: isVi ? "Đóng" : "Close",
      title: isVi ? "Chat trực tiếp với admin" : "Live chat with admin",
      subtitle: isVi ? "Nhắn ngay trong web, admin phản hồi ở tab Trò chuyện" : "Chat in web, admin replies from Chat tab",
      loginRequired: isVi ? "Vui lòng đăng nhập để chat với admin." : "Please log in to chat with admin.",
      noMessage: isVi ? "Hãy nhập nội dung trước khi gửi." : "Please type a message before sending.",
      send: isVi ? "Gửi" : "Send",
      sending: isVi ? "Đang gửi..." : "Sending...",
      loading: isVi ? "Đang tải cuộc trò chuyện..." : "Loading conversation...",
      placeholder: isVi ? "Nhập nội dung bạn cần hỗ trợ..." : "Type your support message...",
      chatOutside: isVi ? "Mở Messenger" : "Open Messenger",
      empty: isVi ? "Chưa có tin nhắn. Hãy bắt đầu cuộc trò chuyện với admin." : "No messages yet. Start chatting with admin.",
      adminTag: isVi ? "Admin" : "Admin",
      userTag: isVi ? "Bạn" : "You",
      refresh: isVi ? "Làm mới" : "Refresh",
      unread: isVi ? "Tin nhắn mới" : "Unread messages"
    };
  }, [language]);

  useEffect(() => {
    const nextClient = createBrowserSupabaseClient();
    supabaseRef.current = nextClient;
    setMounted(true);

    return () => {
      setMounted(false);
    };
  }, []);

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    scroller.scrollTop = scroller.scrollHeight;
  }, [thread.messages, open, isAuthenticated]);

  const syncUnread = useCallback((conversation, messages, { markSeen = false } = {}) => {
    const conversationId = conversation?.id;
    if (!conversationId) {
      setUnreadCount(0);
      return;
    }

    if (markSeen) {
      const latestMessageMs = (Array.isArray(messages) ? messages : []).reduce((max, item) => Math.max(max, toTimestamp(item?.createdAt)), 0);
      const marker = latestMessageMs ? new Date(latestMessageMs).toISOString() : new Date().toISOString();
      writeSeenAt(conversationId, marker);
      setUnreadCount(0);
      return;
    }

    const seenAtMs = readSeenAt(conversationId);
    setUnreadCount(calculateUnread(messages, seenAtMs));
  }, []);

  const loadThread = useCallback(async ({ silent = false, markSeen = false } = {}) => {
    if (!isAuthenticated) return;
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const cacheBust = Date.now();
      const response = await fetch(`${routes.api.supportChat}?t=${cacheBust}`, {
        method: "GET",
        cache: "no-store"
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(normalizeErrorMessage(data?.error || "Unable to load chat", language));
      }
      const nextConversation = data?.conversation || null;
      const nextMessages = Array.isArray(data?.messages) ? data.messages : [];
      setThread({
        conversation: nextConversation,
        messages: nextMessages
      });
      syncUnread(nextConversation, nextMessages, { markSeen });
      return nextConversation || null;
    } catch (err) {
      if (!silent) {
        setError(normalizeErrorMessage(err?.message || "Unable to load chat", language));
      }
      return null;
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [isAuthenticated, language, syncUnread]);

  const subscribeRealtime = useCallback(async (conversationId) => {
    if (!conversationId) return;
    const supabase = supabaseRef.current;
    if (!supabase) {
      setRealtimeReady(false);
      return;
    }

    if (channelRef.current) {
      try { await supabase.removeChannel(channelRef.current); } catch {}
      channelRef.current = null;
    }

    const channel = supabase
      .channel(`support-chat-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_chat_messages",
          filter: `conversation_id=eq.${conversationId}`
        },
        () => {
          loadThread({ silent: true, markSeen: open });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_chat_conversations",
          filter: `id=eq.${conversationId}`
        },
        () => {
          loadThread({ silent: true, markSeen: open });
        }
      );

    channelRef.current = channel;
    channel.subscribe((status) => {
      setRealtimeReady(status === "SUBSCRIBED");
    });
  }, [loadThread, open]);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      if (!open || !isAuthenticated) return;
      const conversation = await loadThread({ markSeen: open });
      if (cancelled) return;
      if (conversation?.id) {
        await subscribeRealtime(conversation.id);
      }
    }

    if (open && isAuthenticated) {
      init();
    }

    return () => {
      cancelled = true;
      const supabase = supabaseRef.current;
      if (supabase && channelRef.current) {
        supabase.removeChannel(channelRef.current).catch(() => {});
      }
      channelRef.current = null;
      setRealtimeReady(false);
    };
  }, [open, isAuthenticated, loadThread, subscribeRealtime]);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (open) return;

    loadThread({ silent: true, markSeen: false });
    const timer = setInterval(() => {
      loadThread({ silent: true, markSeen: false });
    }, 25000);

    return () => clearInterval(timer);
  }, [isAuthenticated, open, loadThread]);

  useEffect(() => {
    if (!isAuthenticated || !open) return;

    const timer = setInterval(() => {
      loadThread({ silent: true, markSeen: true });
    }, 3000);

    return () => clearInterval(timer);
  }, [isAuthenticated, open, loadThread]);

  async function handleSend(event) {
    event.preventDefault();
    if (!isAuthenticated) {
      setError(text.loginRequired);
      return;
    }
    if (sending) return;

    const safeMessage = compact(messageDraft, 2000);
    if (!safeMessage) {
      setError(text.noMessage);
      return;
    }

    setSending(true);
    setError("");
    try {
      const response = await fetch(routes.api.supportChat, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: safeMessage, page, context })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(normalizeErrorMessage(data?.error || "Unable to send message", language));
      }

      const nextConversation = data?.conversation || null;
      const nextMessages = Array.isArray(data?.messages) ? data.messages : [];
      setThread({ conversation: nextConversation, messages: nextMessages });
      syncUnread(nextConversation, nextMessages, { markSeen: true });
      setMessageDraft("");
      trackEvent("support_chat.user_send", {
        page,
        conversationId: data?.conversation?.id || null
      });

      if (nextConversation?.id) {
        await subscribeRealtime(nextConversation.id);
      }
    } catch (err) {
      setError(normalizeErrorMessage(err?.message || "Unable to send message", language));
    } finally {
      setSending(false);
    }
  }

  function openFacebookChat() {
    if (!facebookChatUrl) return;
    window.open(facebookChatUrl, "_blank", "noopener,noreferrer");
  }

  const widget = (
    <div className="support-chat-root">
      <button
        type="button"
        className="support-chat-toggle"
        aria-label={open ? text.closeLabel : text.openLabel}
        onClick={() => {
          const next = !open;
          setOpen(next);
          trackEvent("support_chat.toggle", { page, open: next });
        }}
      >
        <span aria-hidden="true">{open ? "✕" : "💬"}</span>
        {!open && unreadCount > 0 ? <span className="support-chat-unread-badge" title={text.unread}>{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
      </button>

      {open ? (
        <section className="support-chat-panel" aria-label={text.title}>
          <header className="support-chat-head">
            <strong>{text.title}</strong>
            <span>{text.subtitle}</span>
          </header>

          {!isAuthenticated ? (
            <div className="support-chat-login-gate">
              <div className="history-empty error-state">{text.loginRequired}</div>
            </div>
          ) : (
            <>
              <div className="support-chat-body">
                {loading ? <div className="history-empty">{text.loading}</div> : null}
                {error ? <div className="history-empty error-state">{error}</div> : null}

                {!loading ? (
                  <div className="support-chat-messages" ref={scrollRef}>
                    {!thread.messages.length ? <div className="history-empty">{text.empty}</div> : null}
                    {thread.messages.map((item) => {
                      const isAdmin = item.role === "admin";
                      return (
                        <article key={item.id} className={`support-chat-bubble ${isAdmin ? "admin" : "user"}`}>
                          <div className="support-chat-bubble-head">
                            <span className={`support-chat-role-badge ${isAdmin ? "admin" : "user"}`}>
                              {isAdmin ? text.adminTag : text.userTag}
                            </span>
                            <time>{item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}</time>
                          </div>
                          <p>{item.message}</p>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              <form className="support-chat-input" onSubmit={handleSend}>
                <textarea
                  rows={3}
                  value={messageDraft}
                  onChange={(e) => setMessageDraft(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handleSend(event);
                    }
                  }}
                  placeholder={text.placeholder}
                />
                <div className="support-chat-input-actions">
                  <button type="button" className="ghost-button" onClick={() => loadThread({ markSeen: open })}>
                    {text.refresh}
                  </button>
                  <button type="button" className="ghost-button" onClick={openFacebookChat}>
                    {text.chatOutside}
                  </button>
                  <button type="submit" className="primary-button" disabled={sending}>
                    {sending ? text.sending : text.send}
                  </button>
                </div>
              </form>
            </>
          )}
        </section>
      ) : null}
    </div>
  );

  if (!mounted) {
    return null;
  }

  return createPortal(widget, document.body);
}
