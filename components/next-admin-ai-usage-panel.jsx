"use client";

function fmtNumber(value) {
  return Number(value || 0).toLocaleString();
}

function fmtPercent(value) {
  const num = Number(value || 0);
  return `${num.toFixed(2)}%`;
}

function getBadgeTone(rate) {
  if (rate >= 90) return "ok";
  if (rate >= 70) return "warn";
  return "bad";
}

export default function NextAdminAiUsagePanel({
  loading,
  usageSummary,
  usageDays,
  onUsageDaysChange,
  language = "vi"
}) {
  const isVi = language === "vi";
  const totals = usageSummary?.totals || {};
  const daily = Array.isArray(usageSummary?.daily) ? usageSummary.daily : [];

  return (
    <section className="admin-ai-panel">
      <div className="panel-head">
        <h2 className="section-title">{isVi ? "Thống kê AI" : "AI Usage"}</h2>
        <span className="inline-note">{isVi ? `Ngày gần nhất: ${usageSummary?.latestDay || "-"}` : `Latest day: ${usageSummary?.latestDay || "-"}`}</span>
      </div>

      <div className="admin-toolbar">
        <div className="admin-toolbar-right">
          <label className="admin-page-size" htmlFor="ai-usage-days">
            <span>{isVi ? "Khoảng thời gian" : "Window"}</span>
            <select
              id="ai-usage-days"
              value={usageDays}
              onChange={(event) => onUsageDaysChange(Number(event.target.value))}
            >
              {[7, 14, 30, 60, 90].map((days) => <option key={days} value={days}>{isVi ? `${days} ngày` : `${days} days`}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="admin-ai-kpi-grid">
        <article className="admin-ai-kpi-card">
          <span>{isVi ? "Tổng lượt generate" : "Total generate requests"}</span>
          <strong>{fmtNumber(totals.requestCount)}</strong>
        </article>
        <article className="admin-ai-kpi-card">
          <span>{isVi ? "Generate thành công" : "Generate success"}</span>
          <strong>{fmtNumber(totals.successCount)}</strong>
        </article>
        <article className="admin-ai-kpi-card">
          <span>{isVi ? "Generate fallback" : "Generate fallback"}</span>
          <strong>{fmtNumber(totals.fallbackCount)}</strong>
        </article>
        <article className={`admin-ai-kpi-card tone-${getBadgeTone(Number(totals.successRate || 0))}`}>
          <span>{isVi ? "Tỉ lệ generate thành công" : "Generate success rate"}</span>
          <strong>{fmtPercent(totals.successRate)}</strong>
        </article>
      </div>

      <div className="admin-ai-kpi-grid">
        <article className="admin-ai-kpi-card">
          <span>{isVi ? "Tổng lượt suggest" : "Total suggest requests"}</span>
          <strong>{fmtNumber(totals.suggestCount)}</strong>
        </article>
        <article className="admin-ai-kpi-card">
          <span>{isVi ? "Suggest thành công" : "Suggest success"}</span>
          <strong>{fmtNumber(totals.suggestSuccessCount)}</strong>
        </article>
        <article className="admin-ai-kpi-card">
          <span>{isVi ? "Suggest fallback" : "Suggest fallback"}</span>
          <strong>{fmtNumber(totals.suggestFallbackCount)}</strong>
        </article>
        <article className={`admin-ai-kpi-card tone-${getBadgeTone(Number(totals.suggestSuccessRate || 0))}`}>
          <span>{isVi ? "Tỉ lệ suggest thành công" : "Suggest success rate"}</span>
          <strong>{fmtPercent(totals.suggestSuccessRate)}</strong>
        </article>
      </div>

      {loading ? <div className="history-empty">{isVi ? "Đang tải thống kê AI..." : "Loading AI usage..."}</div> : null}

      {!loading ? (
        <div className="admin-users-table-wrap">
          <table className="admin-users-table admin-ai-table">
            <thead>
                <tr>
                  <th>{isVi ? "Ngày" : "Date"}</th>
                  <th>{isVi ? "Generate Req" : "Generate Req"}</th>
                  <th>{isVi ? "Generate OK" : "Generate OK"}</th>
                  <th>{isVi ? "Generate Fallback" : "Generate Fallback"}</th>
                  <th>{isVi ? "Tỉ lệ Generate" : "Generate Rate"}</th>
                  <th>{isVi ? "Suggest Req" : "Suggest Req"}</th>
                  <th>{isVi ? "Suggest OK" : "Suggest OK"}</th>
                  <th>{isVi ? "Suggest Fallback" : "Suggest Fallback"}</th>
                  <th>{isVi ? "Tỉ lệ Suggest" : "Suggest Rate"}</th>
                </tr>
              </thead>
            <tbody>
              {daily.length ? daily.slice().reverse().map((row) => (
                <tr key={row.day}>
                  <td>{row.day}</td>
                  <td>{fmtNumber(row.requestCount)}</td>
                  <td>{fmtNumber(row.successCount)}</td>
                  <td>{fmtNumber(row.fallbackCount)}</td>
                  <td>{fmtPercent(row.successRate)}</td>
                  <td>{fmtNumber(row.suggestCount)}</td>
                  <td>{fmtNumber(row.suggestSuccessCount)}</td>
                  <td>{fmtNumber(row.suggestFallbackCount)}</td>
                  <td>{fmtPercent(row.suggestSuccessRate)}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={9}>{isVi ? "Chưa có dữ liệu AI usage." : "No AI usage data yet."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
