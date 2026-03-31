const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const DEFAULT_PROD_BASE = "https://gen-script-tau.vercel.app";
const outDir = process.env.BENCHMARK_OUT_DIR || path.join(process.cwd(), "scripts", "benchmark-output");
const now = new Date();
const stamp = `${now.toISOString().slice(0, 10)}-${now.toISOString().slice(11, 19).replace(/:/g, "")}`;
const summaryPath = path.join(outDir, `benchmark-summary-${stamp}.json`);

function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function runNodeScript(scriptPath, env = {}) {
  const result = spawnSync(process.execPath, [scriptPath], {
    stdio: "inherit",
    env: {
      ...process.env,
      ...env
    }
  });
  return result.status === 0;
}

function listFilesByPrefix(prefix) {
  if (!fs.existsSync(outDir)) return [];
  return fs
    .readdirSync(outDir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .map((name) => ({
      name,
      fullPath: path.join(outDir, name),
      mtime: fs.statSync(path.join(outDir, name)).mtimeMs
    }))
    .sort((a, b) => b.mtime - a.mtime);
}

function readJsonSafe(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function postAlert(message) {
  const webhook = String(process.env.BENCHMARK_ALERT_WEBHOOK_URL || "").trim();
  if (!webhook) return false;

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message })
    });
    return res.ok;
  } catch {
    return false;
  }
}

function buildSummary(categoryReport, kpiReport) {
  const minCategoryAccuracy = toNumber(process.env.MIN_CATEGORY_ACCURACY, 85);
  const minGroupAccuracy = toNumber(process.env.MIN_GROUP_ACCURACY, 90);
  const minConfidentRate = toNumber(process.env.MIN_CONFIDENT_RATE, 70);

  const categorySummary = categoryReport?.summary || {};
  const categoryAccuracy = toNumber(categorySummary.categoryAccuracy, 0);
  const groupAccuracy = toNumber(categorySummary.groupAccuracy, 0);
  const confidentRate = toNumber(categorySummary.confidentRate, 0);

  const categoryChecks = {
    categoryAccuracy: categoryAccuracy >= minCategoryAccuracy,
    groupAccuracy: groupAccuracy >= minGroupAccuracy,
    confidentRate: confidentRate >= minConfidentRate
  };

  const launchSkipped = Boolean(kpiReport?.requiresAdminAuth);
  const launchPassed = launchSkipped ? null : Boolean(kpiReport?.verdict?.passed);

  let status = "pass";
  if (Object.values(categoryChecks).some((value) => value === false)) {
    status = "fail";
  }
  if (launchPassed === false) {
    status = "fail";
  }
  if (status !== "fail" && launchSkipped) {
    status = "warn";
  }

  return {
    generatedAt: new Date().toISOString(),
    status,
    thresholds: {
      minCategoryAccuracy,
      minGroupAccuracy,
      minConfidentRate
    },
    category: {
      endpoint: categoryReport?.endpoint || null,
      categoryAccuracy,
      groupAccuracy,
      confidentRate,
      checks: categoryChecks,
      totals: {
        categoryHits: toNumber(categorySummary.categoryHits, 0),
        groupHits: toNumber(categorySummary.groupHits, 0),
        total: toNumber(categorySummary.total, 0)
      },
      reportFile: categoryReport?._reportFile || null
    },
    launchKpi: {
      endpoint: kpiReport?.endpoint || null,
      skippedMissingAuth: launchSkipped,
      verdict: kpiReport?.verdict || null,
      reportFile: kpiReport?._reportFile || null
    }
  };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const suggestEndpoint = process.env.BENCHMARK_ENDPOINT || `${DEFAULT_PROD_BASE}/api/suggest-from-images`;
  const kpiEndpoint = process.env.BENCHMARK_METRICS_ENDPOINT || `${DEFAULT_PROD_BASE}/api/admin/launch-metrics?days=14`;

  const categoryRan = runNodeScript(path.join("scripts", "benchmark-category-accuracy.js"), {
    BENCHMARK_ENDPOINT: suggestEndpoint,
    BENCHMARK_OUT_DIR: outDir
  });

  const kpiRan = runNodeScript(path.join("scripts", "benchmark-launch-kpi.js"), {
    BENCHMARK_METRICS_ENDPOINT: kpiEndpoint,
    BENCHMARK_OUT_DIR: outDir,
    BENCHMARK_AUTH_COOKIE: process.env.BENCHMARK_AUTH_COOKIE || ""
  });

  const latestCategoryFile = listFilesByPrefix("category-accuracy-")[0]?.fullPath || "";
  const latestKpiFile = listFilesByPrefix("launch-kpi-")[0]?.fullPath || "";

  const categoryReport = latestCategoryFile ? readJsonSafe(latestCategoryFile) : null;
  const kpiReport = latestKpiFile ? readJsonSafe(latestKpiFile) : null;

  if (categoryReport) categoryReport._reportFile = latestCategoryFile;
  if (kpiReport) kpiReport._reportFile = latestKpiFile;

  const summary = buildSummary(categoryReport, kpiReport);
  summary.steps = {
    categoryScriptSucceeded: categoryRan,
    launchKpiScriptSucceeded: kpiRan
  };

  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(`Saved orchestrator summary: ${summaryPath}`);
  console.log(`Status: ${summary.status}`);

  if (summary.status !== "pass") {
    const launchStatus = summary.launchKpi.skippedMissingAuth
      ? "launch-kpi=skipped(missing_auth)"
      : `launch-kpi=${summary.launchKpi.verdict?.passed ? "pass" : "fail"}`;
    const message = `[Benchmark ${summary.status.toUpperCase()}] category=${summary.category.categoryAccuracy}% group=${summary.category.groupAccuracy}% confident=${summary.category.confidentRate}% ${launchStatus}`;
    const alerted = await postAlert(message);
    if (alerted) {
      console.log("Alert sent to benchmark webhook.");
    }
  }

  if (summary.status === "fail") {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
