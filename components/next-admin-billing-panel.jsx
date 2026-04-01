"use client";

export default function NextAdminBillingPanel({
  loading,
  subscriptions,
  query,
  page,
  meta,
  changing,
  language = "vi",
  onQueryChange,
  onPageChange,
  onExport,
  onUpgrade,
  onDowngrade
}) {
  const isVi = language === "vi";
  const list = Array.isArray(subscriptions) ? subscriptions : [];
  const canPrev = Number(page || 1) > 1;
  const canNext = Number(page || 1) < Number(meta?.totalPages || 1);

  return (
    <section className="admin-users-panel">
      <div className="panel-head">
        <h2 className="section-title">{isVi ? "Subscription" : "Subscriptions"}</h2>
        <span className="inline-note">{isVi ? `Tổng: ${meta?.total ?? list.length}` : `Total: ${meta?.total ?? list.length}`}</span>
      </div>

      <div className="admin-toolbar">
        <input
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={isVi ? "Tìm theo email hoặc plan" : "Search by email or plan"}
        />
        <button type="button" className="ghost-button" onClick={onExport}>{isVi ? "Xuất CSV" : "Export CSV"}</button>
      </div>

      {loading ? <div className="history-empty">{isVi ? "Đang tải subscriptions..." : "Loading subscriptions..."}</div> : null}

      {!loading ? (
        <div className="admin-users-table-wrap">
          <table className="admin-users-table">
            <thead>
              <tr>
                <th>{isVi ? "Email" : "Email"}</th>
                <th>{isVi ? "Tên" : "Name"}</th>
                <th>{isVi ? "Gói" : "Plan"}</th>
                <th>{isVi ? "Provider" : "Provider"}</th>
                <th>{isVi ? "Amount" : "Amount"}</th>
                <th>{isVi ? "Ngày nâng cấp" : "Upgraded at"}</th>
                <th>{isVi ? "Thao tác" : "Actions"}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((row) => {
                const busy = changing.userId === row.userId;
                const isPro = String(row.plan || "free") === "pro";
                return (
                  <tr key={`${row.userId}_${row.plan}_${row.updatedAt || ""}`}>
                    <td>{row.email || "-"}</td>
                    <td>{row.name || "-"}</td>
                    <td>{isPro ? "PRO" : "FREE"}</td>
                    <td>{row.provider || "-"}</td>
                    <td>{`${Number(row.amount || 0).toLocaleString()} ${row.currency || "VND"}`}</td>
                    <td>{row.upgradedAt ? new Date(row.upgradedAt).toLocaleString() : "-"}</td>
                    <td>
                      {isPro ? (
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={busy}
                          onClick={() => onDowngrade(row.userId)}
                        >
                          {busy ? (isVi ? "Đang xử lý..." : "Processing...") : (isVi ? "Hạ về Free" : "Downgrade to Free")}
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="ghost-button"
                          disabled={busy}
                          onClick={() => onUpgrade(row.userId)}
                        >
                          {busy ? (isVi ? "Đang xử lý..." : "Processing...") : (isVi ? "Nâng lên Pro" : "Upgrade to Pro")}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}

      <div className="admin-pagination">
        <button type="button" className="ghost-button" disabled={!canPrev} onClick={() => onPageChange(page - 1)}>{isVi ? "Trang trước" : "Previous"}</button>
        <span className="inline-note">{isVi ? `Trang ${meta?.page || page} / ${meta?.totalPages || 1}` : `Page ${meta?.page || page} / ${meta?.totalPages || 1}`}</span>
        <button type="button" className="ghost-button" disabled={!canNext} onClick={() => onPageChange(page + 1)}>{isVi ? "Trang sau" : "Next"}</button>
      </div>
    </section>
  );
}
