"use client";

function fmtNumber(value) {
  return Number(value || 0).toLocaleString();
}

function fmtPercent(value) {
  return `${Number(value || 0).toFixed(2)}%`;
}

function fmtMs(value, language = "vi") {
  const ms = Number(value || 0);
  if (!ms) return language === "vi" ? "-" : "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function toneByRate(rate) {
  const value = Number(rate || 0);
  if (value >= 90) return "ok";
  if (value >= 70) return "warn";
  return "bad";
}

export default function NextAdminLaunchMetricsPanel({
  loading,
  metrics,
  metricsDays,
  onMetricsDaysChange,
  language = "vi"
}) {
  const isVi = language === "vi";
  const totals = metrics?.totals || {};
  const firstRun = metrics?.firstRun || {};
  const funnel = metrics?.funnel || {};
  const daily = Array.isArray(metrics?.daily) ? metrics.daily : [];
  const topErrors = Array.isArray(metrics?.topErrors) ? metrics.topErrors : [];
  const promptVersions = Array.isArray(metrics?.promptVersions) ? metrics.promptVersions : [];

  return (
    <section className="admin-launch-panel">
      <div className="panel-head">
        <h2 className="section-title">{isVi ? "Launch metrics" : "Launch metrics"}</h2>
        <span className="inline-note">{isVi ? "Theo dõi readiness trước khi scale traffic" : "Track launch readiness before scaling traffic"}</span>
      </div>

      <div className="admin-toolbar">
        <div className="admin-toolbar-right">
          <label className="admin-page-size" htmlFor="launch-metrics-days">
            <span>{isVi ? "Khoảng thời gian" : "Window"}</span>
            <select
              id="launch-metrics-days"
              value={metricsDays}
              onChange={(event) => onMetricsDaysChange(Number(event.target.value))}
            >
              {[7, 14, 30, 45, 60].map((days) => <option key={days} value={days}>{isVi ? `${days} ngày` : `${days} days`}</option>)}
            </select>
          </label>
        </div>
      </div>

      <div className="admin-ai-kpi-grid">
        <article className="admin-ai-kpi-card">
          <span>{isVi ? "Generate submit" : "Generate submit"}</span>
          <strong>{fmtNumber(totals.generateSubmit)}</strong>
        </article>
        <article className="admin-ai-kpi-card">
          <span>{isVi ? "Generate success" : "Generate success"}</span>
          <strong>{fmtNumber(totals.generateSuccess)}</strong>
        </article>
        <article className={`admin-ai-kpi-card tone-${toneByRate(totals.generateSuccessRate)}`}>
          <span>{isVi ? "Tỉ lệ generate thành công" : "Generate success rate"}</span>
          <strong>{fmtPercent(totals.generateSuccessRate)}</strong>
        </article>
        <article className="admin-ai-kpi-card">
          <span>{isVi ? "Suggest thành công" : "Suggest success"}</span>
          <strong>{fmtNumber(totals.suggestSuccess)}</strong>
        </article>
      </div>

      <div className="admin-ai-kpi-grid">
        <article className={`admin-ai-kpi-card tone-${toneByRate(firstRun.firstOutputCompletionRate)}`}>
          <span>{isVi ? "Tỉ lệ hoàn thành output đầu" : "First output completion"}</span>
          <strong>{fmtPercent(firstRun.firstOutputCompletionRate)}</strong>
        </article>
        <article className="admin-ai-kpi-card">
          <span>{isVi ? "Thời gian output đầu (avg)" : "First output latency (avg)"}</span>
          <strong>{fmtMs(firstRun.averageFirstOutputMs, language)}</strong>
        </article>
        <article className="admin-ai-kpi-card">
          <span>{isVi ? "Thời gian output đầu (p95)" : "First output latency (p95)"}</span>
          <strong>{fmtMs(firstRun.p95FirstOutputMs, language)}</strong>
        </article>
        <article className={`admin-ai-kpi-card tone-${toneByRate(firstRun.onboardingCompletionRate30m)}`}>
          <span>{isVi ? "Tỉ lệ hoàn tất onboarding 30m" : "Onboarding completed in 30m"}</span>
          <strong>{fmtPercent(firstRun.onboardingCompletionRate30m)}</strong>
        </article>
      </div>

      <div className="admin-launch-funnel-grid">
        <article className="admin-launch-funnel-card">
          <h3>{isVi ? "Funnel nhanh" : "Quick funnel"}</h3>
          <ul>
            <li>{isVi ? "Mở workspace" : "Workspace opened"}: <strong>{fmtNumber(funnel.openedWorkspace)}</strong></li>
            <li>{isVi ? "Thấy onboarding" : "Onboarding seen"}: <strong>{fmtNumber(funnel.onboardingSeen)}</strong></li>
            <li>{isVi ? "Dùng quick start" : "Quick start used"}: <strong>{fmtNumber(funnel.onboardingStartedGuide)}</strong></li>
            <li>{isVi ? "Generate submit" : "Generate submit"}: <strong>{fmtNumber(funnel.generated)}</strong></li>
            <li>{isVi ? "Generate success" : "Generate success"}: <strong>{fmtNumber(funnel.generatedSuccess)}</strong></li>
            <li>{isVi ? "Feedback gửi" : "Feedback submitted"}: <strong>{fmtNumber(funnel.feedbackSubmitted)}</strong></li>
          </ul>
        </article>

        <article className="admin-launch-funnel-card">
          <h3>{isVi ? "Top lỗi" : "Top errors"}</h3>
          <ul>
            {topErrors.length ? topErrors.map((item, index) => (
              <li key={`${item.type}-${index}`}>
                <strong>{fmtNumber(item.count)}x</strong> {item.type}: {item.reason}
              </li>
            )) : (
              <li>{isVi ? "Chưa có lỗi nổi bật" : "No major errors yet"}</li>
            )}
          </ul>
        </article>

        <article className="admin-launch-funnel-card">
          <h3>{isVi ? "Prompt versions" : "Prompt versions"}</h3>
          <ul>
            {promptVersions.length ? promptVersions.map((item) => (
              <li key={item.version}>
                <strong>{item.version}</strong>: {fmtNumber(item.count)}
              </li>
            )) : (
              <li>{isVi ? "Chưa có dữ liệu prompt version" : "No prompt version data yet"}</li>
            )}
          </ul>
        </article>
      </div>

      {loading ? <div className="history-empty">{isVi ? "Đang tải launch metrics..." : "Loading launch metrics..."}</div> : null}

      {!loading ? (
        <div className="admin-users-table-wrap">
          <table className="admin-users-table admin-ai-table">
            <thead>
              <tr>
                <th>{isVi ? "Ngày" : "Date"}</th>
                <th>{isVi ? "Generate submit" : "Generate submit"}</th>
                <th>{isVi ? "Generate success" : "Generate success"}</th>
                <th>{isVi ? "Tỉ lệ success" : "Success rate"}</th>
                <th>{isVi ? "Suggest success" : "Suggest success"}</th>
                <th>{isVi ? "Feedback" : "Feedback"}</th>
                <th>{isVi ? "Prompt chính" : "Top prompt"}</th>
              </tr>
            </thead>
            <tbody>
              {daily.length ? daily.slice().reverse().map((row) => (
                <tr key={row.day}>
                  <td>{row.day}</td>
                  <td>{fmtNumber(row.generateSubmit)}</td>
                  <td>{fmtNumber(row.generateSuccess)}</td>
                  <td>{fmtPercent(row.generateSuccessRate)}</td>
                  <td>{fmtNumber(row.suggestSuccess)}</td>
                  <td>{fmtNumber(row.feedbackSubmitted)}</td>
                  <td>{row.topPromptVersion || "-"}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7}>{isVi ? "Chưa có dữ liệu launch metrics." : "No launch metrics data yet."}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
