import { readJsonArray, writeJsonArray, paths } from "@/lib/server/local-store";

const TELEMETRY_PATH = paths.telemetry;
const MAX_TELEMETRY_ROWS = 10_000;
const ONBOARDING_WINDOW_MS = 30 * 60 * 1000;

function toTimestamp(value) {
  const stamp = new Date(value).getTime();
  return Number.isFinite(stamp) ? stamp : 0;
}

function hasValue(value) {
  return value !== undefined && value !== null && value !== "";
}

function normalizeEvent(raw = {}) {
  const createdAt = hasValue(raw.createdAt) ? new Date(raw.createdAt).toISOString() : new Date().toISOString();
  const id = String(raw.id || "").trim() || `telemetry_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: id.slice(0, 96),
    createdAt,
    type: String(raw.type || "unknown").slice(0, 64),
    requestId: String(raw.requestId || "").slice(0, 96),
    userId: raw.userId ? String(raw.userId).slice(0, 96) : null,
    sessionId: raw.sessionId ? String(raw.sessionId).slice(0, 96) : null,
    payload: raw.payload && typeof raw.payload === "object" ? raw.payload : {}
  };
}

export function trackTelemetryEvent(event) {
  const entries = readJsonArray(TELEMETRY_PATH);
  entries.unshift(normalizeEvent(event));
  writeJsonArray(TELEMETRY_PATH, entries.slice(0, MAX_TELEMETRY_ROWS));
}

function normalizeRows(rows) {
  return rows
    .filter((row) => row && typeof row === "object")
    .map((row) => normalizeEvent(row));
}

function countBy(rows, predicate) {
  return rows.reduce((acc, row) => (predicate(row) ? acc + 1 : acc), 0);
}

function buildSessionStats(rows) {
  const map = new Map();

  for (const row of rows) {
    const key = row.sessionId || row.requestId;
    if (!key) continue;

    const stamp = toTimestamp(row.createdAt);
    const state = map.get(key) || {
      firstAt: 0,
      opened: false,
      firstGenerateAt: 0,
      firstGenerateSuccessAt: 0,
      firstSuggestSuccessAt: 0,
      completedFirstOutput: false
    };

    if (!state.firstAt || (stamp && stamp < state.firstAt)) {
      state.firstAt = stamp;
    }

    if (row.type === "workspace.open") {
      state.opened = true;
    }
    if (row.type === "generate.submit" && !state.firstGenerateAt && stamp) {
      state.firstGenerateAt = stamp;
    }
    if (row.type === "generate.success" && !state.firstGenerateSuccessAt && stamp) {
      state.firstGenerateSuccessAt = stamp;
      state.completedFirstOutput = true;
    }
    if (row.type === "image.suggest.success" && !state.firstSuggestSuccessAt && stamp) {
      state.firstSuggestSuccessAt = stamp;
    }

    map.set(key, state);
  }

  const sessions = Array.from(map.values()).filter((session) => session.opened);
  const sessionCount = sessions.length;

  const firstOutputCompletedCount = sessions.filter((session) => session.completedFirstOutput).length;
  const firstOutputCompletionRate = sessionCount > 0
    ? Number(((firstOutputCompletedCount / sessionCount) * 100).toFixed(2))
    : 0;

  const firstOutputLatencies = sessions
    .filter((session) => session.firstGenerateAt && session.firstGenerateSuccessAt && session.firstGenerateSuccessAt >= session.firstGenerateAt)
    .map((session) => session.firstGenerateSuccessAt - session.firstGenerateAt);

  const averageFirstOutputMs = firstOutputLatencies.length
    ? Math.round(firstOutputLatencies.reduce((sum, value) => sum + value, 0) / firstOutputLatencies.length)
    : 0;

  const p95FirstOutputMs = firstOutputLatencies.length
    ? firstOutputLatencies.slice().sort((a, b) => a - b)[Math.max(0, Math.ceil(firstOutputLatencies.length * 0.95) - 1)]
    : 0;

  const suggestEngagedSessions = sessions.filter((session) => session.firstSuggestSuccessAt > 0).length;
  const suggestEngagementRate = sessionCount > 0
    ? Number(((suggestEngagedSessions / sessionCount) * 100).toFixed(2))
    : 0;

  const onboarding30mSessions = sessions.filter((session) => {
    if (!session.firstAt || !session.firstGenerateSuccessAt) return false;
    return session.firstGenerateSuccessAt - session.firstAt <= ONBOARDING_WINDOW_MS;
  }).length;

  const onboardingCompletionRate30m = sessionCount > 0
    ? Number(((onboarding30mSessions / sessionCount) * 100).toFixed(2))
    : 0;

  return {
    sessionCount,
    firstOutputCompletedCount,
    firstOutputCompletionRate,
    averageFirstOutputMs,
    p95FirstOutputMs,
    suggestEngagedSessions,
    suggestEngagementRate,
    onboardingCompletionRate30m
  };
}

function buildDaily(rows) {
  const byDay = new Map();

  for (const row of rows) {
    const day = String(row.createdAt || "").slice(0, 10);
    if (!day) continue;

    const state = byDay.get(day) || {
      day,
      generateSubmit: 0,
      generateSuccess: 0,
      generateFailed: 0,
      suggestSuccess: 0,
      suggestFailed: 0,
      feedbackSubmitted: 0,
      promptVersions: {}
    };

    if (row.type === "generate.submit") state.generateSubmit += 1;
    if (row.type === "generate.success") state.generateSuccess += 1;
    if (row.type === "generate.failed") state.generateFailed += 1;
    if (row.type === "image.suggest.success") state.suggestSuccess += 1;
    if (row.type === "image.suggest.failed") state.suggestFailed += 1;
    if (row.type === "feedback.submit") state.feedbackSubmitted += 1;
    if (row.type === "generate.success") {
      const promptVersion = String(row.payload?.promptVersion || "").trim();
      if (promptVersion) {
        state.promptVersions[promptVersion] = Number(state.promptVersions[promptVersion] || 0) + 1;
      }
    }

    byDay.set(day, state);
  }

  return Array.from(byDay.values())
    .sort((a, b) => a.day.localeCompare(b.day))
    .map((item) => ({
      ...item,
      generateSuccessRate: item.generateSubmit > 0
        ? Number(((item.generateSuccess / item.generateSubmit) * 100).toFixed(2))
        : 0,
      topPromptVersion: Object.entries(item.promptVersions || {}).sort((a, b) => Number(b[1]) - Number(a[1]))[0]?.[0] || ""
    }));
}

function buildTopErrors(rows, limit = 6) {
  const map = new Map();

  for (const row of rows) {
    if (row.type !== "generate.failed" && row.type !== "image.suggest.failed") continue;
    const reason = String(row.payload?.error || row.payload?.reason || "unknown").slice(0, 140);
    const key = `${row.type}:${reason}`;
    map.set(key, (map.get(key) || 0) + 1);
  }

  return Array.from(map.entries())
    .map(([key, count]) => {
      const split = key.indexOf(":");
      return {
        type: key.slice(0, split),
        reason: key.slice(split + 1),
        count
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export function getLaunchMetricsSummary({ days = 14 } = {}) {
  const safeDays = Math.max(1, Math.min(60, Number(days) || 14));
  const now = Date.now();
  const fromMs = now - (safeDays * 24 * 60 * 60 * 1000);

  const allRows = normalizeRows(readJsonArray(TELEMETRY_PATH));
  const rows = allRows.filter((row) => {
    const stamp = toTimestamp(row.createdAt);
    return stamp >= fromMs;
  });

  const totalGenerateSubmit = countBy(rows, (row) => row.type === "generate.submit");
  const totalGenerateSuccess = countBy(rows, (row) => row.type === "generate.success");
  const totalSuggestSuccess = countBy(rows, (row) => row.type === "image.suggest.success");
  const totalSuggestFailed = countBy(rows, (row) => row.type === "image.suggest.failed");

  const generateSuccessRate = totalGenerateSubmit > 0
    ? Number(((totalGenerateSuccess / totalGenerateSubmit) * 100).toFixed(2))
    : 0;

  const firstRun = buildSessionStats(rows);
  const daily = buildDaily(rows);

  const funnel = {
    openedWorkspace: countBy(rows, (row) => row.type === "workspace.open"),
    onboardingSeen: countBy(rows, (row) => row.type === "onboarding.viewed"),
    onboardingSkipped: countBy(rows, (row) => row.type === "onboarding.skipped"),
    onboardingStartedGuide: countBy(rows, (row) => row.type === "onboarding.quickstart"),
    generated: totalGenerateSubmit,
    generatedSuccess: totalGenerateSuccess,
    feedbackSubmitted: countBy(rows, (row) => row.type === "feedback.submit")
  };

  const promptVersionCounts = rows
    .filter((row) => row.type === "generate.success")
    .reduce((acc, row) => {
      const key = String(row.payload?.promptVersion || "").trim();
      if (!key) return acc;
      acc[key] = Number(acc[key] || 0) + 1;
      return acc;
    }, {});

  const promptVersions = Object.entries(promptVersionCounts)
    .map(([version, count]) => ({ version, count }))
    .sort((a, b) => Number(b.count) - Number(a.count));

  return {
    days: safeDays,
    totals: {
      telemetryEvents: rows.length,
      generateSubmit: totalGenerateSubmit,
      generateSuccess: totalGenerateSuccess,
      generateSuccessRate,
      suggestSuccess: totalSuggestSuccess,
      suggestFailed: totalSuggestFailed
    },
    firstRun,
    funnel,
    promptVersions,
    topErrors: buildTopErrors(rows),
    daily
  };
}
