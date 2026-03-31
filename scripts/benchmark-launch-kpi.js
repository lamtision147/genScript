const fs = require("node:fs");
const path = require("node:path");

const endpoint = process.env.BENCHMARK_METRICS_ENDPOINT || "http://127.0.0.1:4174/api/admin/launch-metrics?days=14";
const outDir = process.env.BENCHMARK_OUT_DIR || path.join(process.cwd(), "scripts", "benchmark-output");
const now = new Date();
const stamp = `${now.toISOString().slice(0, 10)}-${now.toISOString().slice(11, 19).replace(/:/g, "")}`;
const outPath = path.join(outDir, `launch-kpi-${stamp}.json`);

function grade(summary = {}) {
  const checks = {
    generateSuccessRate: Number(summary?.totals?.generateSuccessRate || 0) >= 97,
    firstOutputCompletionRate: Number(summary?.firstRun?.firstOutputCompletionRate || 0) >= 80,
    avgFirstOutputMs: Number(summary?.firstRun?.averageFirstOutputMs || 0) > 0 && Number(summary?.firstRun?.averageFirstOutputMs || 0) < 10_000
  };

  const passCount = Object.values(checks).filter(Boolean).length;
  return {
    checks,
    passCount,
    totalChecks: Object.keys(checks).length,
    passed: passCount === Object.keys(checks).length
  };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const headers = { "Content-Type": "application/json" };
  const cookie = String(process.env.BENCHMARK_AUTH_COOKIE || "").trim();
  if (cookie) {
    headers.cookie = cookie;
  }

  const response = await fetch(endpoint, {
    method: "GET",
    headers
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 403) {
    const report = {
      generatedAt: new Date().toISOString(),
      endpoint,
      requiresAdminAuth: true,
      message: "Launch metrics endpoint requires admin auth cookie. Set BENCHMARK_AUTH_COOKIE and run again.",
      responseStatus: response.status,
      responseBody: body
    };
    fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
    console.log(`Saved report: ${outPath}`);
    console.log("Launch KPI check skipped (missing admin auth cookie).");
    return;
  }

  if (response.status !== 200) {
    throw new Error(`launch-metrics status ${response.status}: ${body?.error || "unknown"}`);
  }

  const verdict = grade(body);
  const report = {
    generatedAt: new Date().toISOString(),
    endpoint,
    verdict,
    metrics: body
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`Saved report: ${outPath}`);
  console.log(`Checks passed: ${verdict.passCount}/${verdict.totalChecks}`);
  console.log(`Launch ready: ${verdict.passed ? "YES" : "NO"}`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
