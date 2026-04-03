import crypto from "crypto";
import { paths, readJsonArray, writeJsonArray } from "@/lib/server/local-store";
import { getPlanInfoByUserIdAsync } from "@/lib/server/billing-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { GUEST_QUOTA_COOKIE_NAME, GUEST_QUOTA_USAGE_COOKIE_NAME } from "@/lib/auth-constants";

export const FREE_DAILY_GENERATE_LIMIT_PER_PAGE = 5;
export const GUEST_DAILY_GENERATE_LIMIT_PER_PAGE = 2;
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

function normalizeActorType(value = "") {
  return String(value || "").trim().toLowerCase() === "guest" ? "guest" : "user";
}

function normalizeActorKey(value = "") {
  return String(value || "").trim().toLowerCase();
}

function normalizeGuestQuotaToken(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (/^[a-f0-9]{32}$/i.test(raw)) return raw;
  return "";
}

function parseGuestQuotaUsageCookie(raw = "") {
  try {
    const parsed = JSON.parse(String(raw || ""));
    if (!parsed || typeof parsed !== "object") return null;
    const day = toDayKey(parsed.day);
    const actorKey = normalizeActorKey(parsed.actorKey || "");
    const product = clampCount(parsed.productCopy);
    const video = clampCount(parsed.videoScript);
    if (!actorKey || !day) return null;
    return {
      day,
      actorKey,
      productCopy: product,
      videoScript: video
    };
  } catch {
    return null;
  }
}

function readGuestQuotaUsageCookie(request) {
  return parseGuestQuotaUsageCookie(request?.cookies?.get?.(GUEST_QUOTA_USAGE_COOKIE_NAME)?.value || "");
}

function pickHigherCount(...counts) {
  const normalized = counts.map((value) => clampCount(value));
  return Math.max(0, ...normalized);
}

function writeGuestQuotaUsageCookie(response, payload) {
  if (!response || !payload) return response;
  response.cookies.set(GUEST_QUOTA_USAGE_COOKIE_NAME, JSON.stringify(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}

function getIpFromForwardedHeader(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/for="?([^;,"]+)"?/i);
  return match?.[1] ? String(match[1]).trim() : "";
}

function normalizeClientIp(value = "") {
  let ip = String(value || "").trim();
  if (!ip) return "";
  if (ip.includes(",")) {
    ip = ip.split(",")[0].trim();
  }
  if (ip.startsWith("::ffff:")) {
    ip = ip.slice(7);
  }
  return ip;
}

function extractRequestIp(request) {
  if (!request?.headers) return "";
  const candidates = [
    request.headers.get("x-forwarded-for"),
    request.headers.get("x-real-ip"),
    request.headers.get("x-client-ip"),
    request.headers.get("x-vercel-forwarded-for"),
    request.headers.get("cf-connecting-ip"),
    getIpFromForwardedHeader(request.headers.get("forwarded"))
  ];

  for (const candidate of candidates) {
    const normalized = normalizeClientIp(candidate);
    if (normalized) return normalized;
  }

  return "";
}

export function buildGuestQuotaActorKeyFromRequest(request) {
  const ip = extractRequestIp(request);
  const userAgent = String(request?.headers?.get("user-agent") || "").slice(0, 180);
  const acceptLanguage = String(request?.headers?.get("accept-language") || "").slice(0, 40);
  const seed = ip
    ? `ip:${ip}`
    : (userAgent ? `ua:${userAgent}|lang:${acceptLanguage}` : "guest:anonymous");

  const digest = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 32);
  return `guest:${digest}`;
}

function buildGuestQuotaTokenFromRequest(request) {
  const actorKey = buildGuestQuotaActorKeyFromRequest(request);
  const token = String(actorKey || "").replace(/^guest:/i, "").trim().toLowerCase();
  return normalizeGuestQuotaToken(token);
}

function buildQuotaActor({ userId = "", request = null } = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (normalizedUserId) {
    return {
      actorType: "user",
      actorKey: `user:${normalizedUserId}`,
      userId: normalizedUserId,
      isAuthenticated: true,
      limitPerScope: FREE_DAILY_GENERATE_LIMIT_PER_PAGE
    };
  }

  const guestCookieToken = normalizeGuestQuotaToken(request?.cookies?.get?.(GUEST_QUOTA_COOKIE_NAME)?.value || "");
  const stableGuestToken = guestCookieToken || buildGuestQuotaTokenFromRequest(request);

  return {
    actorType: "guest",
    actorKey: `guestcookie:${stableGuestToken}`,
    userId: "",
    isAuthenticated: false,
    limitPerScope: GUEST_DAILY_GENERATE_LIMIT_PER_PAGE
  };
}

function isUuid(value = "") {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || "").trim());
}

function isMissingSupabaseQuotaSchema(error) {
  const message = String(error?.message || "");
  return /generation_quota_daily|relation.+does not exist|column.+does not exist|schema cache|onConflict|failed to parse select parameter/i.test(message);
}

function buildLimitedQuotaSummary({ isGuest, day, limitPerScope, productUsed, videoUsed }) {
  return {
    isPro: false,
    isGuest: Boolean(isGuest),
    day,
    productCopy: {
      limit: limitPerScope,
      used: productUsed,
      remaining: Math.max(0, limitPerScope - productUsed),
      unlimited: false
    },
    videoScript: {
      limit: limitPerScope,
      used: videoUsed,
      remaining: Math.max(0, limitPerScope - videoUsed),
      unlimited: false
    }
  };
}

function buildQuotaResponseByUsage({ actor, scope, limitPerScope, used }) {
  if (used >= limitPerScope) {
    return {
      allowed: false,
      unlimited: false,
      scope,
      used,
      limit: limitPerScope,
      remaining: 0,
      actorType: actor.actorType,
      isGuest: !actor.isAuthenticated
    };
  }

  const nextUsed = used + 1;
  return {
    allowed: true,
    unlimited: false,
    scope,
    used: nextUsed,
    limit: limitPerScope,
    remaining: Math.max(0, limitPerScope - nextUsed),
    actorType: actor.actorType,
    isGuest: !actor.isAuthenticated
  };
}

async function readSupabaseQuotaUsageByActorDayAsync(actor, day) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("generation_quota_daily")
    .select("scope,count")
    .eq("actor_key", actor.actorKey)
    .eq("day", day)
    .in("scope", ["product_copy", "video_script"]);

  if (error) {
    if (isMissingSupabaseQuotaSchema(error)) return null;
    throw new Error(error.message || "Unable to read generation quota from Supabase");
  }

  const rows = Array.isArray(data) ? data : [];
  const productUsed = clampCount(rows.find((item) => normalizeScope(item?.scope) === "product_copy")?.count);
  const videoUsed = clampCount(rows.find((item) => normalizeScope(item?.scope) === "video_script")?.count);
  return { productUsed, videoUsed };
}

async function consumeSupabaseQuotaAsync(actor, day, scope, limitPerScope) {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const current = await supabase
    .from("generation_quota_daily")
    .select("count")
    .eq("actor_key", actor.actorKey)
    .eq("day", day)
    .eq("scope", scope)
    .maybeSingle();

  if (current.error) {
    if (isMissingSupabaseQuotaSchema(current.error)) return null;
    throw new Error(current.error.message || "Unable to read generation quota row from Supabase");
  }

  const used = clampCount(current.data?.count);
  if (used >= limitPerScope) {
    return {
      allowed: false,
      unlimited: false,
      scope,
      used,
      limit: limitPerScope,
      remaining: 0,
      actorType: actor.actorType,
      isGuest: !actor.isAuthenticated
    };
  }

  const nextUsed = used + 1;
  const upsertPayload = {
    actor_key: actor.actorKey,
    actor_type: actor.actorType,
    user_id: actor.actorType === "user" && isUuid(actor.userId) ? actor.userId : null,
    day,
    scope,
    count: nextUsed,
    updated_at: new Date().toISOString()
  };

  const writeResult = await supabase
    .from("generation_quota_daily")
    .upsert(upsertPayload, { onConflict: "actor_key,day,scope" })
    .select("count")
    .maybeSingle();

  if (writeResult.error) {
    if (isMissingSupabaseQuotaSchema(writeResult.error)) return null;
    throw new Error(writeResult.error.message || "Unable to update generation quota row in Supabase");
  }

  const persistedUsed = clampCount(writeResult.data?.count ?? nextUsed);
  return {
    allowed: true,
    unlimited: false,
    scope,
    used: persistedUsed,
    limit: limitPerScope,
    remaining: Math.max(0, limitPerScope - persistedUsed),
    actorType: actor.actorType,
    isGuest: !actor.isAuthenticated
  };
}

function readQuotaRows() {
  return readJsonArray(QUOTA_ROWS_PATH)
    .filter((row) => row && typeof row === "object")
    .map((row) => {
      const legacyUserId = String(row.userId || "").trim();
      const actorKey = normalizeActorKey(row.actorKey || (legacyUserId ? `user:${legacyUserId}` : ""));
      const actorType = normalizeActorType(row.actorType || (actorKey.startsWith("guest:") ? "guest" : "user"));
      const userId = String(row.userId || (actorKey.startsWith("user:") ? actorKey.slice(5) : "")).trim();

      return {
        actorKey,
        actorType,
        userId,
        day: toDayKey(row.day),
        scope: normalizeScope(row.scope),
        count: clampCount(row.count),
        updatedAt: String(row.updatedAt || new Date().toISOString())
      };
    })
    .filter((row) => row.actorKey);
}

function saveQuotaRows(rows = []) {
  const sorted = rows
    .slice()
    .sort((a, b) => {
      const byActor = String(a.actorKey).localeCompare(String(b.actorKey));
      if (byActor) return byActor;
      const byDay = String(a.day).localeCompare(String(b.day));
      if (byDay) return byDay;
      return String(a.scope).localeCompare(String(b.scope));
    });

  const cutoffDay = toDayKey(Date.now() - QUOTA_WINDOWS_TO_KEEP * 24 * 60 * 60 * 1000);
  const next = sorted.filter((row) => String(row.day) >= cutoffDay);
  writeJsonArray(QUOTA_ROWS_PATH, next);
}

function findQuotaRow(rows, { actorKey, day, scope }) {
  return rows.find((row) => row.actorKey === actorKey && row.day === day && row.scope === scope) || null;
}

export async function getGenerationQuotaSummaryAsync(userId) {
  return getGenerationQuotaSummaryByRequestAsync(null, { userId });
}

export async function getGenerationQuotaSummaryByRequestAsync(request, { userId = "" } = {}) {
  const actor = buildQuotaActor({ userId, request });
  const day = toDayKey(new Date());
  const limitPerScope = actor.limitPerScope;
  const guestUsageCookie = !actor.isAuthenticated ? readGuestQuotaUsageCookie(request) : null;

  if (actor.isAuthenticated) {
    const planInfo = await getPlanInfoByUserIdAsync(actor.userId);
    const isPro = String(planInfo?.plan || "free") === "pro";

    if (isPro) {
      return {
        isPro: true,
        isGuest: false,
        day,
        productCopy: { limit: null, used: 0, remaining: null, unlimited: true },
        videoScript: { limit: null, used: 0, remaining: null, unlimited: true }
      };
    }
  }

  const supabaseUsage = await readSupabaseQuotaUsageByActorDayAsync(actor, day).catch(() => null);
  if (supabaseUsage) {
    const productUsed = actor.isAuthenticated
      ? supabaseUsage.productUsed
      : pickHigherCount(supabaseUsage.productUsed, guestUsageCookie?.actorKey === actor.actorKey && guestUsageCookie?.day === day ? guestUsageCookie.productCopy : 0);
    const videoUsed = actor.isAuthenticated
      ? supabaseUsage.videoUsed
      : pickHigherCount(supabaseUsage.videoUsed, guestUsageCookie?.actorKey === actor.actorKey && guestUsageCookie?.day === day ? guestUsageCookie.videoScript : 0);

    return buildLimitedQuotaSummary({
      isGuest: !actor.isAuthenticated,
      day,
      limitPerScope,
      productUsed,
      videoUsed
    });
  }

  const rows = readQuotaRows();
  const productRow = findQuotaRow(rows, { actorKey: actor.actorKey, day, scope: "product_copy" });
  const videoRow = findQuotaRow(rows, { actorKey: actor.actorKey, day, scope: "video_script" });

  const productUsed = clampCount(productRow?.count);
  const videoUsed = clampCount(videoRow?.count);

  const resolvedProductUsed = actor.isAuthenticated
    ? productUsed
    : pickHigherCount(productUsed, guestUsageCookie?.actorKey === actor.actorKey && guestUsageCookie?.day === day ? guestUsageCookie.productCopy : 0);
  const resolvedVideoUsed = actor.isAuthenticated
    ? videoUsed
    : pickHigherCount(videoUsed, guestUsageCookie?.actorKey === actor.actorKey && guestUsageCookie?.day === day ? guestUsageCookie.videoScript : 0);

  return buildLimitedQuotaSummary({
    isGuest: !actor.isAuthenticated,
    day,
    limitPerScope,
    productUsed: resolvedProductUsed,
    videoUsed: resolvedVideoUsed
  });
}

export async function consumeGenerationQuotaAsync({ userId, scope, request }) {
  const actor = buildQuotaActor({ userId, request });
  const normalizedScope = normalizeScope(scope);

  if (actor.isAuthenticated) {
    const planInfo = await getPlanInfoByUserIdAsync(actor.userId);
    const isPro = String(planInfo?.plan || "free") === "pro";
    if (isPro) {
      return {
        allowed: true,
        unlimited: true,
        scope: normalizedScope,
        used: 0,
        limit: null,
        remaining: null,
        actorType: actor.actorType,
        isGuest: false
      };
    }
  }

  const limitPerScope = actor.limitPerScope;
  const day = toDayKey(new Date());
  const guestUsageCookie = !actor.isAuthenticated ? readGuestQuotaUsageCookie(request) : null;
  const cookieUsedRaw = actor.isAuthenticated || guestUsageCookie?.actorKey !== actor.actorKey || guestUsageCookie?.day !== day
    ? 0
    : (normalizedScope === "video_script" ? guestUsageCookie.videoScript : guestUsageCookie.productCopy);
  const cookieUsed = clampCount(cookieUsedRaw);

  const supabaseQuota = await consumeSupabaseQuotaAsync(actor, day, normalizedScope, limitPerScope).catch(() => null);
  if (supabaseQuota) {
    if (!actor.isAuthenticated && cookieUsed > supabaseQuota.used) {
      return buildQuotaResponseByUsage({ actor, scope: normalizedScope, limitPerScope, used: cookieUsed });
    }
    return supabaseQuota;
  }

  const rows = readQuotaRows();
  const existing = findQuotaRow(rows, { actorKey: actor.actorKey, day, scope: normalizedScope });
  const localUsed = clampCount(existing?.count);
  const used = actor.isAuthenticated ? localUsed : pickHigherCount(localUsed, cookieUsed);

  if (used >= limitPerScope) {
    return {
      allowed: false,
      unlimited: false,
      scope: normalizedScope,
      used,
      limit: limitPerScope,
      remaining: 0,
      actorType: actor.actorType,
      isGuest: !actor.isAuthenticated
    };
  }

  const nextUsed = used + 1;
  const nextRow = {
    actorKey: actor.actorKey,
    actorType: actor.actorType,
    userId: actor.userId || "",
    day,
    scope: normalizedScope,
    count: nextUsed,
    updatedAt: new Date().toISOString()
  };

  if (existing) {
    const nextRows = rows.map((row) => {
      if (row.actorKey === actor.actorKey && row.day === day && row.scope === normalizedScope) {
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
    limit: limitPerScope,
    remaining: Math.max(0, limitPerScope - nextUsed),
    actorType: actor.actorType,
    isGuest: !actor.isAuthenticated
  };
}

export function buildQuotaExceededMessage(scope = "product_copy", language = "vi", quota = null) {
  const isVi = String(language || "vi").toLowerCase() === "vi";
  const scopeLabel = scope === "video_script"
    ? (isVi ? "Kịch bản video" : "Video script")
    : (isVi ? "Nội dung sản phẩm" : "Product content");
  const limit = Number.isFinite(Number(quota?.limit)) ? Number(quota.limit) : FREE_DAILY_GENERATE_LIMIT_PER_PAGE;
  const isGuest = Boolean(quota?.isGuest || quota?.actorType === "guest");

  if (isGuest) {
    if (isVi) {
      return `Bạn đã dùng hết ${limit}/${limit} lượt ${scopeLabel} ở chế độ khách hôm nay. Đăng nhập để nhận thêm 5 lượt mỗi trang/ngày hoặc nâng cấp Pro để dùng không giới hạn.`;
    }
    return `You have used all ${limit}/${limit} ${scopeLabel} requests in guest mode today. Log in to get 5 free requests per page per day, or upgrade to Pro for unlimited usage.`;
  }

  if (isVi) {
    return `Bạn đã dùng hết ${limit}/${limit} lượt ${scopeLabel} hôm nay. Nâng cấp Pro để dùng không giới hạn.`;
  }
  return `You have used all ${limit}/${limit} ${scopeLabel} generations today. Upgrade to Pro for unlimited usage.`;
}

export function ensureGuestQuotaCookie(response, request) {
  const existing = normalizeGuestQuotaToken(request?.cookies?.get?.(GUEST_QUOTA_COOKIE_NAME)?.value || "");
  const token = existing || buildGuestQuotaTokenFromRequest(request);
  if (!token) return response;
  if (existing) return response;

  response.cookies.set(GUEST_QUOTA_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  });
  return response;
}

export function ensureGuestQuotaUsageCookie(response, request, { userId = "", scope = "product_copy", used = 0 } = {}) {
  const actor = buildQuotaActor({ userId, request });
  if (actor.isAuthenticated) return response;

  const day = toDayKey(new Date());
  const normalizedScope = normalizeScope(scope);
  const existing = readGuestQuotaUsageCookie(request);
  const sameActor = existing?.actorKey === actor.actorKey && existing?.day === day;

  const nextPayload = {
    day,
    actorKey: actor.actorKey,
    productCopy: sameActor ? clampCount(existing.productCopy) : 0,
    videoScript: sameActor ? clampCount(existing.videoScript) : 0
  };

  if (normalizedScope === "video_script") {
    nextPayload.videoScript = pickHigherCount(nextPayload.videoScript, used);
  } else {
    nextPayload.productCopy = pickHigherCount(nextPayload.productCopy, used);
  }

  return writeGuestQuotaUsageCookie(response, nextPayload);
}

export function ensureGuestQuotaUsageFromSummaryCookie(response, request, summary = null) {
  const actor = buildQuotaActor({ userId: "", request });
  if (actor.isAuthenticated) return response;

  const day = toDayKey(new Date());
  const existing = readGuestQuotaUsageCookie(request);
  const sameActor = existing?.actorKey === actor.actorKey && existing?.day === day;

  const nextPayload = {
    day,
    actorKey: actor.actorKey,
    productCopy: pickHigherCount(
      sameActor ? existing.productCopy : 0,
      summary?.productCopy?.used
    ),
    videoScript: pickHigherCount(
      sameActor ? existing.videoScript : 0,
      summary?.videoScript?.used
    )
  };

  return writeGuestQuotaUsageCookie(response, nextPayload);
}
