import { paths, readJsonArray, writeJsonArray } from "@/lib/server/local-store";

const AI_USAGE_PATH = paths.aiUsage;

function toDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function clampCounter(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function readUsageRows() {
  return readJsonArray(AI_USAGE_PATH)
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      id: String(row.id || `ai_usage_${toDayKey(row.day)}_${Math.random().toString(36).slice(2, 8)}`),
      day: toDayKey(row.day),
      requestCount: clampCounter(row.requestCount),
      successCount: clampCounter(row.successCount),
      fallbackCount: clampCounter(row.fallbackCount),
      suggestCount: clampCounter(row.suggestCount),
      suggestSuccessCount: clampCounter(row.suggestSuccessCount),
      suggestFallbackCount: clampCounter(row.suggestFallbackCount),
      updatedAt: row.updatedAt || new Date().toISOString()
    }));
}

function saveUsageRows(rows = []) {
  const ordered = rows
    .slice()
    .sort((a, b) => String(a.day).localeCompare(String(b.day)))
    .slice(-120);
  writeJsonArray(AI_USAGE_PATH, ordered);
}

export function trackAiUsageEvent(event = {}) {
  const day = toDayKey(event.day || new Date());
  const type = String(event.type || "").trim();
  if (!type) return;

  const rows = readUsageRows();
  const existing = rows.find((row) => row.day === day);
  const current = existing || {
    id: `ai_usage_${day}_${Math.random().toString(36).slice(2, 8)}`,
    day,
    requestCount: 0,
    successCount: 0,
    fallbackCount: 0,
    suggestCount: 0,
    suggestSuccessCount: 0,
    suggestFallbackCount: 0,
    updatedAt: new Date().toISOString()
  };

  if (type === "generate_request") current.requestCount += 1;
  if (type === "generate_success") current.successCount += 1;
  if (type === "generate_fallback") current.fallbackCount += 1;
  if (type === "suggest_request") current.suggestCount += 1;
  if (type === "suggest_success") current.suggestSuccessCount += 1;
  if (type === "suggest_fallback") current.suggestFallbackCount += 1;

  current.updatedAt = new Date().toISOString();

  if (existing) {
    const nextRows = rows.map((row) => (row.day === day ? current : row));
    saveUsageRows(nextRows);
    return;
  }

  rows.push(current);
  saveUsageRows(rows);
}

function sumRowTotals(rows = []) {
  return rows.reduce((acc, row) => {
    acc.requestCount += clampCounter(row.requestCount);
    acc.successCount += clampCounter(row.successCount);
    acc.fallbackCount += clampCounter(row.fallbackCount);
    acc.suggestCount += clampCounter(row.suggestCount);
    acc.suggestSuccessCount += clampCounter(row.suggestSuccessCount);
    acc.suggestFallbackCount += clampCounter(row.suggestFallbackCount);
    return acc;
  }, {
    requestCount: 0,
    successCount: 0,
    fallbackCount: 0,
    suggestCount: 0,
    suggestSuccessCount: 0,
    suggestFallbackCount: 0
  });
}

function withRates(totals) {
  const generateRate = totals.requestCount > 0
    ? Number(((totals.successCount / totals.requestCount) * 100).toFixed(2))
    : 0;
  const suggestRate = totals.suggestCount > 0
    ? Number(((totals.suggestSuccessCount / totals.suggestCount) * 100).toFixed(2))
    : 0;
  return {
    ...totals,
    successRate: generateRate,
    suggestSuccessRate: suggestRate
  };
}

export function getAiUsageSummary({ days = 30 } = {}) {
  const safeDays = Math.max(1, Math.min(120, Number(days) || 30));
  const rows = readUsageRows().sort((a, b) => String(a.day).localeCompare(String(b.day)));
  const recentRows = rows.slice(-safeDays);

  const totals = withRates(sumRowTotals(recentRows));
  const latestDay = recentRows[recentRows.length - 1]?.day || null;

  return {
    totals,
    latestDay,
    daily: recentRows.map((row) => {
      const rowTotals = withRates({
        requestCount: row.requestCount,
        successCount: row.successCount,
        fallbackCount: row.fallbackCount,
        suggestCount: row.suggestCount,
        suggestSuccessCount: row.suggestSuccessCount,
        suggestFallbackCount: row.suggestFallbackCount
      });
      return {
        day: row.day,
        requestCount: row.requestCount,
        successCount: row.successCount,
        fallbackCount: row.fallbackCount,
        suggestCount: row.suggestCount,
        suggestSuccessCount: row.suggestSuccessCount,
        suggestFallbackCount: row.suggestFallbackCount,
        successRate: rowTotals.successRate,
        suggestSuccessRate: rowTotals.suggestSuccessRate,
        updatedAt: row.updatedAt
      };
    })
  };
}
