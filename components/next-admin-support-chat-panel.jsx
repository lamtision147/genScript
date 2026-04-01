"use client";

import { useMemo, useState } from "react";

const STATUS_OPTIONS = [
  { value: "open", labelVi: "Mới", labelEn: "Open" },
  { value: "in_progress", labelVi: "Đang xử lý", labelEn: "In progress" },
  { value: "resolved", labelVi: "Đã xử lý", labelEn: "Resolved" },
  { value: "closed", labelVi: "Đóng", labelEn: "Closed" }
];

function localizeStatus(value, isVi) {
  const row = STATUS_OPTIONS.find((item) => item.value === value);
  if (!row) return value;
  return isVi ? row.labelVi : row.labelEn;
}

export default function NextAdminSupportChatPanel({
  conversations = [],
  conversationStatus = "",
  conversationQuery = "",
  conversationPage = 1,
  conversationMeta = {},
  activeConversation,
  activeMessages = [],
  adminDraft = "",
  loading = false,
  loadingThread = false,
  sending = false,
  realtimeOn = false,
  language = "vi",
  onConversationStatusChange,
  onConversationQueryChange,
  onConversationPageChange,
  onSelectConversation,
  onAdminDraftChange,
  onSendAdminMessage,
  onUpdateConversationStatus
}) {
  const isVi = language === "vi";
  const [statusDraft, setStatusDraft] = useState("");

  const canPrev = conversationPage > 1;
  const canNext = conversationPage < (conversationMeta?.totalPages || 1);
  const total = Number(conversationMeta?.total || conversations.length || 0);

  const list = useMemo(() => (Array.isArray(conversations) ? conversations : []), [conversations]);
  const messages = useMemo(() => (Array.isArray(activeMessages) ? activeMessages : []), [activeMessages]);
  const currentStatus = statusDraft || activeConversation?.status || "open";

  return (
    <section className="admin-support-chat-panel">
      <div className="panel-head">
        <h2 className="section-title">{isVi ? "Trò chuyện hỗ trợ" : "Support chats"}</h2>
        <span className="inline-note">{isVi ? `Tổng hội thoại: ${total}` : `Total chats: ${total}`}</span>
      </div>

      <div className="admin-toolbar">
        <input
          type="search"
          value={conversationQuery}
          onChange={(event) => onConversationQueryChange?.(event.target.value)}
          placeholder={isVi ? "Tìm theo email, tên, nội dung" : "Search by email, name, message"}
        />
        <div className="admin-toolbar-right">
          <label className="admin-page-size">
            <span>{isVi ? "Trạng thái" : "Status"}</span>
            <select value={conversationStatus} onChange={(event) => onConversationStatusChange?.(event.target.value)}>
              <option value="">{isVi ? "Tất cả" : "All"}</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{isVi ? option.labelVi : option.labelEn}</option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {loading ? <div className="history-empty">{isVi ? "Đang tải hội thoại..." : "Loading conversations..."}</div> : null}

      {!loading ? (
        <div className="admin-chat-grid">
          <aside className="admin-chat-list">
            {!list.length ? <div className="history-empty">{isVi ? "Chưa có hội thoại" : "No conversations yet"}</div> : null}
            {list.map((item) => (
              <button
                type="button"
                key={item.id}
                className={`admin-chat-list-item ${activeConversation?.id === item.id ? "active" : ""}`}
                onClick={() => {
                  setStatusDraft("");
                  onSelectConversation?.(item.id);
                }}
              >
                <div className="admin-chat-list-head">
                  <strong>{item.user?.name || item.user?.email || "Unknown"}</strong>
                  <span className="tag">{localizeStatus(item.status, isVi)}</span>
                </div>
                <div className="admin-chat-list-meta">
                  <span>{item.user?.email || "-"}</span>
                  {item.unreadForAdmin ? <span>{isVi ? "Có tin nhắn mới" : "New message"}</span> : null}
                </div>
                <p className="admin-chat-list-preview">{item.preview?.message || (isVi ? "Chưa có tin nhắn" : "No messages yet")}</p>
              </button>
            ))}

            <div className="admin-pagination">
              <button type="button" className="ghost-button" disabled={!canPrev} onClick={() => onConversationPageChange?.(conversationPage - 1)}>
                {isVi ? "Trang trước" : "Previous"}
              </button>
              <span className="inline-note">{isVi ? `Trang ${conversationMeta?.page || conversationPage} / ${conversationMeta?.totalPages || 1}` : `Page ${conversationMeta?.page || conversationPage} / ${conversationMeta?.totalPages || 1}`}</span>
              <button type="button" className="ghost-button" disabled={!canNext} onClick={() => onConversationPageChange?.(conversationPage + 1)}>
                {isVi ? "Trang sau" : "Next"}
              </button>
            </div>
          </aside>

          <section className="admin-chat-thread">
            {!activeConversation ? <div className="history-empty">{isVi ? "Chọn một hội thoại để trả lời" : "Select a conversation to reply"}</div> : null}

            {activeConversation ? (
              <>
                <div className="admin-chat-thread-head">
                  <div>
                    <strong>{activeConversation.user?.name || activeConversation.user?.email || "Unknown"}</strong>
                    <div className="admin-chat-thread-meta">
                      <span>{activeConversation.user?.email || "-"}</span>
                      <span className={`admin-chat-live-pill ${realtimeOn ? "on" : ""}`}>{realtimeOn ? (isVi ? "Realtime bật" : "Realtime on") : (isVi ? "Realtime tắt" : "Realtime off")}</span>
                    </div>
                  </div>
                  <div className="admin-chat-thread-status">
                    <select value={currentStatus} onChange={(event) => setStatusDraft(event.target.value)}>
                      {STATUS_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{isVi ? option.labelVi : option.labelEn}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => onUpdateConversationStatus?.(activeConversation.id, { status: currentStatus })}
                    >
                      {isVi ? "Cập nhật trạng thái" : "Update status"}
                    </button>
                  </div>
                </div>

                <div className="admin-chat-thread-messages">
                  {loadingThread ? <div className="history-empty">{isVi ? "Đang tải tin nhắn..." : "Loading messages..."}</div> : null}
                  {!loadingThread && !messages.length ? <div className="history-empty">{isVi ? "Chưa có tin nhắn" : "No messages"}</div> : null}
                  {!loadingThread ? messages.map((msg) => (
                    <article key={msg.id} className={`admin-chat-bubble ${msg.role === "admin" ? "admin" : "user"}`}>
                      <div className="admin-chat-bubble-head">
                        <span className={`admin-chat-role-badge ${msg.role === "admin" ? "admin" : "user"}`}>
                          {msg.role === "admin" ? (isVi ? "Admin" : "Admin") : (isVi ? "Người dùng" : "User")}
                        </span>
                        <time>{msg.createdAt ? new Date(msg.createdAt).toLocaleString() : ""}</time>
                      </div>
                      <p>{msg.message}</p>
                    </article>
                  )) : null}
                </div>

                <form className="admin-chat-reply" onSubmit={(event) => {
                  event.preventDefault();
                  onSendAdminMessage?.(activeConversation.id, adminDraft, currentStatus);
                }}>
                  <textarea
                    rows={3}
                    value={adminDraft}
                    onChange={(event) => onAdminDraftChange?.(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && !event.shiftKey) {
                        event.preventDefault();
                        onSendAdminMessage?.(activeConversation.id, adminDraft, currentStatus);
                      }
                    }}
                    placeholder={isVi ? "Nhập nội dung trả lời người dùng..." : "Type your reply..."}
                  />
                  <button type="submit" className="primary-button" disabled={sending}>
                    {sending ? (isVi ? "Đang gửi..." : "Sending...") : (isVi ? "Gửi trả lời" : "Send reply")}
                  </button>
                </form>
              </>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
