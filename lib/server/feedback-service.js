import { paths, readJsonArray, writeJsonArray } from "@/lib/server/local-store";

const FEEDBACK_PATH = paths.feedback;
const MAX_FEEDBACK_ROWS = 5_000;

function toInt(value, fallback = 0) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.floor(num);
}

function compact(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function clampRating(value) {
  const rating = toInt(value, 0);
  if (rating < 0) return 0;
  if (rating > 5) return 5;
  return rating;
}

function normalizeType(type) {
  const value = compact(type).toLowerCase();
  if (value === "bug" || value === "suggest") return value;
  return "general";
}

function normalizeFeedback(raw = {}) {
  return {
    id: `feedback_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    type: normalizeType(raw.type),
    rating: clampRating(raw.rating),
    message: compact(raw.message).slice(0, 1200),
    page: compact(raw.page).slice(0, 64) || "unknown",
    category: compact(raw.category).slice(0, 64) || "other",
    hasImages: Boolean(raw.hasImages),
    hasSuggestion: Boolean(raw.hasSuggestion),
    hasResult: Boolean(raw.hasResult),
    language: compact(raw.language).slice(0, 12) || "vi",
    userId: raw.userId ? compact(raw.userId).slice(0, 96) : null,
    sessionId: raw.sessionId ? compact(raw.sessionId).slice(0, 96) : null,
    requestId: raw.requestId ? compact(raw.requestId).slice(0, 96) : ""
  };
}

export function createFeedbackEntry(raw = {}) {
  const entry = normalizeFeedback(raw);
  if (!entry.message) {
    throw new Error("Feedback message is required");
  }

  const rows = readJsonArray(FEEDBACK_PATH);
  rows.unshift(entry);
  writeJsonArray(FEEDBACK_PATH, rows.slice(0, MAX_FEEDBACK_ROWS));

  return entry;
}
