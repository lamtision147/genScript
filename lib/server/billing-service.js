import { readJsonArray, writeJsonArray, paths } from "@/lib/server/local-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid, resolveSupabaseUserId } from "@/lib/server/auth-service";

export const PLAN_FREE = "free";
export const PLAN_PRO = "pro";
export const FREE_FAVORITES_LIMIT = 5;
export const FREE_HISTORY_LIMIT = 5;

const PLAN_VALUES = new Set([PLAN_FREE, PLAN_PRO]);

function normalizePlan(value) {
  const raw = String(value || "").trim().toLowerCase();
  return PLAN_VALUES.has(raw) ? raw : PLAN_FREE;
}

function normalizeBillingStatus(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "active") return "active";
  if (raw === "pending") return "pending";
  if (raw === "failed") return "failed";
  if (raw === "cancelled") return "cancelled";
  return "active";
}

function normalizePaymentProvider(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw || "mock";
}

function normalizeTransactionRef(value) {
  return String(value || "").trim().slice(0, 128);
}

function nowIso() {
  return new Date().toISOString();
}

export function getPlanLimits(plan) {
  const normalized = normalizePlan(plan);
  if (normalized === PLAN_PRO) {
    return {
      plan: PLAN_PRO,
      favoritesLimit: null,
      historyLimit: null,
      unlimitedFavorites: true,
      unlimitedHistory: true
    };
  }

  return {
    plan: PLAN_FREE,
    favoritesLimit: FREE_FAVORITES_LIMIT,
    historyLimit: FREE_HISTORY_LIMIT,
    unlimitedFavorites: false,
    unlimitedHistory: false
  };
}

function normalizeLocalBillingRecord(record) {
  if (!record || typeof record !== "object") return null;
  const userId = String(record.userId || "").trim();
  if (!userId) return null;

  return {
    userId,
    plan: normalizePlan(record.plan),
    status: normalizeBillingStatus(record.status),
    provider: normalizePaymentProvider(record.provider),
    transactionRef: normalizeTransactionRef(record.transactionRef),
    amount: Number(record.amount || 0),
    currency: String(record.currency || "VND").trim().toUpperCase() || "VND",
    upgradedAt: String(record.upgradedAt || nowIso()),
    createdAt: String(record.createdAt || nowIso()),
    updatedAt: String(record.updatedAt || nowIso())
  };
}

function readLocalBillingStore() {
  const rows = readJsonArray(paths.billingSubscriptions);
  if (!Array.isArray(rows)) return [];
  return rows.map(normalizeLocalBillingRecord).filter(Boolean);
}

function writeLocalBillingStore(rows) {
  return writeJsonArray(paths.billingSubscriptions, rows);
}

function upsertLocalBillingRecord(record) {
  const rows = readLocalBillingStore();
  const index = rows.findIndex((item) => item.userId === record.userId);
  const next = {
    ...record,
    updatedAt: nowIso(),
    createdAt: index >= 0 ? rows[index].createdAt : nowIso()
  };
  if (index >= 0) {
    rows[index] = next;
  } else {
    rows.unshift(next);
  }

  writeLocalBillingStore(rows);
  return next;
}

async function resolveBillingUserIdForSupabase(userId, supabase) {
  if (isUuid(userId)) return userId;
  return resolveSupabaseUserId(userId, supabase);
}

function buildPlanInfoPayload(recordOrPlan) {
  const plan = normalizePlan(recordOrPlan?.plan || recordOrPlan || PLAN_FREE);
  const limits = getPlanLimits(plan);

  return {
    plan,
    status: recordOrPlan?.status || "active",
    upgradedAt: recordOrPlan?.upgradedAt || null,
    transactionRef: recordOrPlan?.transactionRef || "",
    provider: recordOrPlan?.provider || "",
    amount: Number(recordOrPlan?.amount || 0),
    currency: String(recordOrPlan?.currency || "VND").toUpperCase(),
    limits
  };
}

async function getSupabasePlanInfoByUserId(userId, supabase) {
  const supabaseUserId = await resolveBillingUserIdForSupabase(userId, supabase);
  if (!supabaseUserId) return null;

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("plan,status,provider,transaction_ref,amount,currency,upgraded_at")
    .eq("user_id", supabaseUserId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to load billing plan from Supabase");
  }

  if (!data) return null;

  return buildPlanInfoPayload({
    plan: normalizePlan(data.plan),
    status: normalizeBillingStatus(data.status),
    provider: normalizePaymentProvider(data.provider),
    transactionRef: normalizeTransactionRef(data.transaction_ref),
    amount: Number(data.amount || 0),
    currency: String(data.currency || "VND").toUpperCase(),
    upgradedAt: data.upgraded_at || null
  });
}

function getLocalPlanInfoByUserId(userId) {
  const row = readLocalBillingStore().find((item) => item.userId === String(userId || ""));
  if (!row) return null;
  return buildPlanInfoPayload(row);
}

export async function getPlanInfoByUserIdAsync(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) return buildPlanInfoPayload(PLAN_FREE);

  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const supabasePlan = await getSupabasePlanInfoByUserId(normalizedUserId, supabase);
      if (supabasePlan) return supabasePlan;
    } catch {
      // fallback to local
    }
  }

  const localPlan = getLocalPlanInfoByUserId(normalizedUserId);
  if (localPlan) return localPlan;
  return buildPlanInfoPayload(PLAN_FREE);
}

export async function ensurePlanInfoForUserAsync(user) {
  if (!user?.id) {
    return buildPlanInfoPayload(PLAN_FREE);
  }
  return getPlanInfoByUserIdAsync(user.id);
}

async function upsertSupabaseBillingRecord(userId, payload, supabase) {
  const supabaseUserId = await resolveBillingUserIdForSupabase(userId, supabase);
  if (!supabaseUserId) return null;

  const insertPayload = {
    user_id: supabaseUserId,
    plan: normalizePlan(payload.plan),
    status: normalizeBillingStatus(payload.status || "active"),
    provider: normalizePaymentProvider(payload.provider),
    transaction_ref: normalizeTransactionRef(payload.transactionRef),
    amount: Number(payload.amount || 0),
    currency: String(payload.currency || "VND").toUpperCase(),
    upgraded_at: payload.upgradedAt || nowIso(),
    updated_at: nowIso()
  };

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .upsert(insertPayload, { onConflict: "user_id" })
    .select("plan,status,provider,transaction_ref,amount,currency,upgraded_at")
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Failed to update billing plan in Supabase");
  }

  if (!data) return null;
  return buildPlanInfoPayload({
    plan: data.plan,
    status: data.status,
    provider: data.provider,
    transactionRef: data.transaction_ref,
    amount: data.amount,
    currency: data.currency,
    upgradedAt: data.upgraded_at
  });
}

export async function upgradeUserToProAsync(userId, paymentPayload = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new Error("Unauthorized");
  }

  const baseRecord = {
    userId: normalizedUserId,
    plan: PLAN_PRO,
    status: "active",
    provider: normalizePaymentProvider(paymentPayload.provider || "mock"),
    transactionRef: normalizeTransactionRef(paymentPayload.transactionRef || `txn_${Date.now()}`),
    amount: Number(paymentPayload.amount || 299000),
    currency: String(paymentPayload.currency || "VND").toUpperCase(),
    upgradedAt: nowIso()
  };

  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const supabasePlan = await upsertSupabaseBillingRecord(normalizedUserId, baseRecord, supabase);
      if (supabasePlan) {
        upsertLocalBillingRecord(baseRecord);
        return supabasePlan;
      }
    } catch {
      // fallback to local
    }
  }

  const localRecord = upsertLocalBillingRecord(baseRecord);
  return buildPlanInfoPayload(localRecord);
}

export async function downgradeUserToFreeAsync(userId, payload = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new Error("Unauthorized");
  }

  const baseRecord = {
    userId: normalizedUserId,
    plan: PLAN_FREE,
    status: "active",
    provider: normalizePaymentProvider(payload.provider || "manual"),
    transactionRef: normalizeTransactionRef(payload.transactionRef || `cancel_${Date.now()}`),
    amount: 0,
    currency: "VND",
    upgradedAt: nowIso()
  };

  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const supabasePlan = await upsertSupabaseBillingRecord(normalizedUserId, baseRecord, supabase);
      if (supabasePlan) {
        upsertLocalBillingRecord(baseRecord);
        return supabasePlan;
      }
    } catch {
      // fallback to local
    }
  }

  const localRecord = upsertLocalBillingRecord(baseRecord);
  return buildPlanInfoPayload(localRecord);
}

export async function assertCanFavoriteAsync(userId) {
  const planInfo = await getPlanInfoByUserIdAsync(userId);
  return planInfo.limits;
}

export async function assertCanStoreHistoryAsync(userId) {
  const planInfo = await getPlanInfoByUserIdAsync(userId);
  return planInfo.limits;
}

export function getPaymentProviderStatus() {
  const stripeReady = Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  return {
    provider: stripeReady ? "stripe" : "mock",
    stripeReady
  };
}
