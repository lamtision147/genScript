"use client";

import { useMemo, useState } from "react";
import NextAdminAiUsagePanel from "@/components/next-admin-ai-usage-panel";
import NextAdminLaunchMetricsPanel from "@/components/next-admin-launch-metrics-panel";
import { buildAdminUsersCsv } from "@/lib/client/admin-export";
import { downloadText } from "@/lib/client/download-utils";
import { getCopy } from "@/lib/i18n";

export default function NextAdminUsersTable({
  users,
  allUsers,
  loading,
  message,
  messageCode,
  query,
  page,
  pageSize,
  pagination,
  usageSummary,
  usageDays,
  launchMetrics,
  launchMetricsDays,
  onResetPassword,
  onDeleteUser,
  onQueryChange,
  onPageChange,
  onPageSizeChange,
  onUsageDaysChange,
  onLaunchMetricsDaysChange,
  language = "vi"
}) {
  const copy = getCopy(language);
  const isVi = language === "vi";
  const [passwordDrafts, setPasswordDrafts] = useState({});
  const [actionState, setActionState] = useState({ userId: "", action: "" });
  const [activeTab, setActiveTab] = useState("users");

  const localizedMessage = messageCode === "reset_success"
    ? (isVi ? "Đặt lại mật khẩu thành công." : "Password reset successful.")
    : messageCode === "delete_success"
      ? (isVi ? "Xóa người dùng thành công." : "User deleted successfully.")
      : message;

  const canPrev = page > 1;
  const canNext = page < (pagination?.totalPages || 1);

  function gotoPrev() {
    if (!canPrev) return;
    onPageChange(page - 1);
  }

  function gotoNext() {
    if (!canNext) return;
    onPageChange(page + 1);
  }

  const safeUsers = useMemo(() => (Array.isArray(users) ? users : []), [users]);
  const exportUsers = useMemo(() => (Array.isArray(allUsers) && allUsers.length ? allUsers : safeUsers), [allUsers, safeUsers]);

  async function handleResetPassword(userId) {
    const password = String(passwordDrafts[userId] || "").trim();
    if (password.length < 6) {
      return;
    }
    setActionState({ userId, action: "reset" });
    try {
      await onResetPassword(userId, password);
      setPasswordDrafts((prev) => ({ ...prev, [userId]: "" }));
    } finally {
      setActionState({ userId: "", action: "" });
    }
  }

  async function handleDeleteUser(user) {
    if (user.isAdmin) return;
    const confirmed = window.confirm(
      isVi
        ? `Xóa tài khoản ${user.email}? Toàn bộ lịch sử và yêu thích liên quan cũng sẽ bị xóa.`
        : `Delete user ${user.email}? This will remove related history and favorites.`
    );
    if (!confirmed) return;
    setActionState({ userId: user.id, action: "delete" });
    try {
      await onDeleteUser(user.id);
    } finally {
      setActionState({ userId: "", action: "" });
    }
  }

  function handleExportCsv() {
    const csv = buildAdminUsersCsv(exportUsers);
    downloadText(`admin-users-${Date.now()}.csv`, csv, "text/csv");
  }

  return (
    <section className="admin-users-panel">
      <div className="admin-tabs" role="tablist" aria-label={isVi ? "Mục quản trị" : "Admin sections"}>
        <button
          type="button"
          className={`ghost-button admin-tab-button ${activeTab === "users" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "users"}
          onClick={() => setActiveTab("users")}
        >
          {isVi ? "Người dùng" : "Users"}
        </button>
        <button
          type="button"
          className={`ghost-button admin-tab-button ${activeTab === "ai" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "ai"}
          onClick={() => setActiveTab("ai")}
        >
          {isVi ? "Thống kê AI" : "AI Usage"}
        </button>
        <button
          type="button"
          className={`ghost-button admin-tab-button ${activeTab === "launch" ? "active" : ""}`}
          role="tab"
          aria-selected={activeTab === "launch"}
          onClick={() => setActiveTab("launch")}
        >
          {isVi ? "Launch metrics" : "Launch metrics"}
        </button>
      </div>

      {activeTab === "ai" ? (
        <NextAdminAiUsagePanel
          loading={loading}
          usageSummary={usageSummary}
          usageDays={usageDays}
          onUsageDaysChange={onUsageDaysChange}
          language={language}
        />
      ) : null}

      {activeTab === "users" ? (
        <>
          <div className="panel-head">
            <h2 className="section-title">{isVi ? "Quản lý người dùng" : "User Management"}</h2>
            <span className="inline-note">{isVi ? `Tổng: ${pagination?.total ?? safeUsers.length}` : `Total: ${pagination?.total ?? safeUsers.length}`}</span>
          </div>

          <div className="admin-toolbar">
            <input
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={isVi ? "Tìm theo email hoặc tên" : "Search by email or name"}
            />
            <div className="admin-toolbar-right">
              <label className="admin-page-size">
                <span>{isVi ? "Dòng" : "Rows"}</span>
                <select value={pageSize} onChange={(event) => onPageSizeChange(Number(event.target.value))}>
                  {[10, 20, 50].map((size) => <option key={size} value={size}>{size}</option>)}
                </select>
              </label>
              <button type="button" className="ghost-button" onClick={handleExportCsv}>{isVi ? "Xuất CSV" : "Export CSV"}</button>
            </div>
          </div>

          {localizedMessage ? <div className="history-empty error-state">{localizedMessage}</div> : null}
          {loading ? <div className="history-empty">{isVi ? "Đang tải danh sách người dùng..." : "Loading users..."}</div> : null}

          {!loading ? (
            <div className="admin-users-table-wrap">
              <table className="admin-users-table">
                <thead>
                  <tr>
                    <th>{isVi ? "Email" : "Email"}</th>
                    <th>{isVi ? "Tên" : "Name"}</th>
                    <th>{isVi ? "Vai trò" : "Role"}</th>
                    <th>{isVi ? "Lịch sử" : "History"}</th>
                    <th>{isVi ? "Yêu thích" : "Favorites"}</th>
                    <th>{isVi ? "Hoạt động gần nhất" : "Last Activity"}</th>
                    <th>{isVi ? "Thao tác" : "Actions"}</th>
                  </tr>
                </thead>
                <tbody>
                  {safeUsers.map((user) => {
                    const busyReset = actionState.userId === user.id && actionState.action === "reset";
                    const busyDelete = actionState.userId === user.id && actionState.action === "delete";
                    return (
                      <tr key={user.id}>
                        <td>{user.email}</td>
                        <td>{user.name || "-"}</td>
                        <td>{user.isAdmin ? (isVi ? "Quản trị" : "Admin") : (isVi ? "Người dùng" : "User")}</td>
                        <td>{user.historyCount ?? 0}</td>
                        <td>{user.favoriteCount ?? 0}</td>
                        <td>{user.lastActivity ? new Date(user.lastActivity).toLocaleString() : "-"}</td>
                        <td>
                          <div className="admin-user-actions">
                            <input
                              type="password"
                              placeholder={isVi ? "Mật khẩu mới" : "New password"}
                              value={passwordDrafts[user.id] || ""}
                              onChange={(event) => setPasswordDrafts((prev) => ({ ...prev, [user.id]: event.target.value }))}
                            />
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={busyReset || String(passwordDrafts[user.id] || "").trim().length < 6}
                              onClick={() => handleResetPassword(user.id)}
                            >
                              {busyReset ? (isVi ? "Đang đặt lại..." : "Resetting...") : (isVi ? "Đặt lại mật khẩu" : "Reset Password")}
                            </button>
                            <button
                              type="button"
                              className="ghost-button"
                              disabled={user.isAdmin || busyDelete}
                              onClick={() => handleDeleteUser(user)}
                            >
                              {busyDelete ? (isVi ? "Đang xóa..." : "Deleting...") : (isVi ? "Xóa" : "Delete")}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="admin-pagination">
            <button type="button" className="ghost-button" disabled={!canPrev} onClick={gotoPrev}>{isVi ? "Trang trước" : "Previous"}</button>
            <span className="inline-note">{isVi ? `Trang ${pagination?.page || page} / ${pagination?.totalPages || 1}` : `Page ${pagination?.page || page} / ${pagination?.totalPages || 1}`}</span>
            <button type="button" className="ghost-button" disabled={!canNext} onClick={gotoNext}>{isVi ? "Trang sau" : "Next"}</button>
          </div>
        </>
      ) : null}

      {activeTab === "launch" ? (
        <NextAdminLaunchMetricsPanel
          loading={loading}
          metrics={launchMetrics}
          metricsDays={launchMetricsDays}
          onMetricsDaysChange={onLaunchMetricsDaysChange}
          language={language}
        />
      ) : null}
    </section>
  );
}
