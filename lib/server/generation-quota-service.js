import { paths, readJsonArray, writeJsonArray } from "@/lib/server/local-store";
import { getPlanInfoByUserIdAsync } from "@/lib/server/billing-service";

export const FREE_DAILY_GENERATE_LIMIT_PER_PAGE = 5;
const QUOTA_ROWS_PATH = paths.generateQuota;
const QUOTA_WINDOWS_TO_KEEP = 45;

function toDayKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString().slice(0, 10);
  return date.toISOString().slice(0, 10);
}

function clampCount(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

function normalizeScope(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "video_script") return "video_script";
  return "product_copy";
}

function readQuotaRows() {
  return readJsonArray(QUOTA_ROWS_PATH)
    .filter((row) => row && typeof row === "object")
    .map((row) => ({
      userId: String(row.userId || "").trim(),
      day: toDayKey(row.day),
      scope: normalizeScope(row.scope),
      count: clampCount(row.count),
      updatedAt: String(row.updatedAt || new Date().toISOString())
    }))
    .filter((row) => row.userId);
}

function saveQuotaRows(rows = []) {
  const sorted = rows
    .slice()
    .sort((a, b) => {
      const byUser = String(a.userId).localeCompare(String(b.userId));
      if (byUser) return byUser;
      const byDay = String(a.day).localeCompare(String(b.day));
      if (byDay) return byDay;
      return String(a.scope).localeCompare(String(b.scope));
    });

  const cutoffDay = toDayKey(Date.now() - QUOTA_WINDOWS_TO_KEEP * 24 * 60 * 60 * 1000);
  const next = sorted.filter((row) => String(row.day) >= cutoffDay);
  writeJsonArray(QUOTA_ROWS_PATH, next);
}

function findQuotaRow(rows, { userId, day, scope }) {
  return rows.find((row) => row.userId === userId && row.day === day && row.scope === scope) || null;
}

export async function getGenerationQuotaSummaryAsync(userId) {
  const normalizedUserId = String(userId || "").trim();
  const day = toDayKey(new Date());
  const planInfo = await getPlanInfoByUserIdAsync(normalizedUserId);
  const isPro = String(planInfo?.plan || "free") === "pro";

  if (!normalizedUserId) {
    return {
      isPro,
      day,
      productCopy: {
        limit: FREE_DAILY_GENERATE_LIMIT_PER_PAGE,
        used: 0,
        remaining: FREE_DAILY_GENERATE_LIMIT_PER_PAGE,
        unlimited: false
      },
      videoScript: {
        limit: FREE_DAILY_GENERATE_LIMIT_PER_PAGE,
        used: 0,
        remaining: FREE_DAILY_GENERATE_LIMIT_PER_PAGE,
        unlimited: false
      }
    };
  }

  if (isPro) {
    return {
      isPro: true,
      day,
      productCopy: { limit: null, used: 0, remaining: null, unlimited: true },
      videoScript: { limit: null, used: 0, remaining: null, unlimited: true }
    };
  }

  const rows = readQuotaRows();
  const productRow = findQuotaRow(rows, { userId: normalizedUserId, day, scope: "product_copy" });
  const videoRow = findQuotaRow(rows, { userId: normalizedUserId, day, scope: "video_script" });

  const productUsed = clampCount(productRow?.count);
  const videoUsed = clampCount(videoRow?.count);

  return {
    isPro: false,
    day,
    productCopy: {
      limit: FREE_DAILY_GENERATE_LIMIT_PER_PAGE,
      used: productUsed,
      remaining: Math.max(0, FREE_DAILY_GENERATE_LIMIT_PER_PAGE - productUsed),
      unlimited: false
    },
    videoScript: {
      limit: FREE_DAILY_GENERATE_LIMIT_PER_PAGE,
      used: videoUsed,
      remaining: Math.max(0, FREE_DAILY_GENERATE_LIMIT_PER_PAGE - videoUsed),
      unlimited: false
    }
  };
}

export async function consumeGenerationQuotaAsync({ userId, scope }) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    return {
      allowed: true,
      unlimited: false,
      scope: normalizeScope(scope),
      used: 0,
      limit: FREE_DAILY_GENERATE_LIMIT_PER_PAGE,
      remaining: FREE_DAILY_GENERATE_LIMIT_PER_PAGE
    };
  }

  const normalizedScope = normalizeScope(scope);
  const planInfo = await getPlanInfoByUserIdAsync(normalizedUserId);
  const isPro = String(planInfo?.plan || "free") === "pro";
  if (isPro) {
    return {
      allowed: true,
      unlimited: true,
      scope: normalizedScope,
      used: 0,
      limit: null,
      remaining: null
    };
  }

  const rows = readQuotaRows();
  const day = toDayKey(new Date());
  const existing = findQuotaRow(rows, { userId: normalizedUserId, day, scope: normalizedScope });
  const used = clampCount(existing?.count);

  if (used >= FREE_DAILY_GENERATE_LIMIT_PER_PAGE) {
    return {
      allowed: false,
      unlimited: false,
      scope: normalizedScope,
      used,
      limit: FREE_DAILY_GENERATE_LIMIT_PER_PAGE,
      remaining: 0
    };
  }

  const nextUsed = used + 1;
  const nextRow = {
    userId: normalizedUserId,
    day,
    scope: normalizedScope,
    count: nextUsed,
    updatedAt: new Date().toISOString()
  };

  if (existing) {
    const nextRows = rows.map((row) => {
      if (row.userId === normalizedUserId && row.day === day && row.scope === normalizedScope) {
        return nextRow;
      }
      return row;
    });
    saveQuotaRows(nextRows);
  } else {
    rows.push(nextRow);
    saveQuotaRows(rows);
  }

  return {
    allowed: true,
    unlimited: false,
    scope: normalizedScope,
    used: nextUsed,
    limit: FREE_DAILY_GENERATE_LIMIT_PER_PAGE,
    remaining: Math.max(0, FREE_DAILY_GENERATE_LIMIT_PER_PAGE - nextUsed)
  };
}

export function buildQuotaExceededMessage(scope = "product_copy", language = "vi") {
  const isVi = String(language || "vi").toLowerCase() === "vi";
  const scopeLabel = scope === "video_script"
    ? (isVi ? "Kịch bản video" : "Video script")
    : (isVi ? "Nội dung sản phẩm" : "Product content");

  if (isVi) {
    return `Bạn đã dùng hết ${FREE_DAILY_GENERATE_LIMIT_PER_PAGE}/${FREE_DAILY_GENERATE_LIMIT_PER_PAGE} lượt ${scopeLabel} hôm nay. Nâng cấp Pro để dùng không giới hạn.`;
  }
  return `You have used all ${FREE_DAILY_GENERATE_LIMIT_PER_PAGE}/${FREE_DAILY_GENERATE_LIMIT_PER_PAGE} ${scopeLabel} generations today. Upgrade to Pro for unlimited usage.`;
}
