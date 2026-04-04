import { readJsonArray, writeJsonArray, paths } from "@/lib/server/local-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isUuid, resolveSupabaseUserId } from "@/lib/server/auth-service";

export const PLAN_FREE = "free";
export const PLAN_PRO = "pro";
export const FREE_FAVORITES_LIMIT = 5;
export const FREE_HISTORY_LIMIT = 5;
export const PRO_PLAN_CYCLE_DAYS = 30;

const DAY_MS = 24 * 60 * 60 * 1000;

const PLAN_VALUES = new Set([PLAN_FREE, PLAN_PRO]);
const MANUAL_PAYMENT_METHOD_VALUES = new Set(["bank_transfer", "momo", "zalopay"]);

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

function normalizeManualPaymentMethod(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  return MANUAL_PAYMENT_METHOD_VALUES.has(raw) ? raw : "bank_transfer";
}

function sanitizeManualTransferRef(value = "") {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32).toUpperCase();
}

function nowIso() {
  return new Date().toISOString();
}

function parseIsoDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return null;
  return parsed;
}

function toIsoOrNull(value) {
  const parsed = parseIsoDate(value);
  return parsed ? parsed.toISOString() : null;
}

function addDays(sourceDate, days) {
  const date = new Date(sourceDate.getTime());
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date;
}

function calculateRemainingDays(expiresAt) {
  const expiryDate = parseIsoDate(expiresAt);
  if (!expiryDate) return null;
  const delta = expiryDate.getTime() - Date.now();
  return Math.max(0, Math.ceil(delta / DAY_MS));
}

function isMissingColumnError(error) {
  const message = String(error?.message || "");
  return /column.+does not exist|schema cache|failed to parse select parameter/i.test(message);
}

function canUseLocalBillingFallback() {
  if (process.env.BILLING_ALLOW_LOCAL_FALLBACK === "true") return true;
  return process.env.NODE_ENV !== "production";
}

function normalizeUserReference(userOrId) {
  if (userOrId && typeof userOrId === "object") {
    return {
      id: String(userOrId.id || "").trim(),
      email: String(userOrId.email || "").trim().toLowerCase(),
      name: String(userOrId.name || "").trim(),
      passwordHash: String(userOrId.passwordHash || "").trim(),
      supabaseId: String(userOrId.supabaseId || "").trim()
    };
  }

  return {
    id: String(userOrId || "").trim(),
    email: "",
    name: "",
    passwordHash: "",
    supabaseId: ""
  };
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
    expiresAt: toIsoOrNull(record.expiresAt),
    cancelAtPeriodEnd: Boolean(record.cancelAtPeriodEnd),
    cancelledAt: toIsoOrNull(record.cancelledAt),
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

async function resolveBillingUserIdForSupabase(userOrId, supabase) {
  const ref = normalizeUserReference(userOrId);
  if (!ref.id && !ref.email) return null;

  if (ref.email) {
    return resolveSupabaseUserId({
      id: ref.id || undefined,
      email: ref.email,
      name: ref.name || ref.email.split("@")[0] || "User",
      passwordHash: ref.passwordHash || undefined,
      supabaseId: ref.supabaseId || undefined
    }, supabase);
  }

  if (isUuid(ref.id)) return ref.id;
  return resolveSupabaseUserId(ref.id, supabase);
}

function buildPlanInfoPayload(recordOrPlan) {
  const plan = normalizePlan(recordOrPlan?.plan || recordOrPlan || PLAN_FREE);
  const limits = getPlanLimits(plan);
  const expiresAt = toIsoOrNull(recordOrPlan?.expiresAt);
  const cancelledAt = toIsoOrNull(recordOrPlan?.cancelledAt);
  const cancelAtPeriodEnd = Boolean(recordOrPlan?.cancelAtPeriodEnd);
  const remainingDays = calculateRemainingDays(expiresAt);

  return {
    plan,
    status: recordOrPlan?.status || "active",
    upgradedAt: recordOrPlan?.upgradedAt || null,
    expiresAt,
    remainingDays,
    cancelAtPeriodEnd,
    cancelledAt,
    transactionRef: recordOrPlan?.transactionRef || "",
    provider: recordOrPlan?.provider || "",
    amount: Number(recordOrPlan?.amount || 0),
    currency: String(recordOrPlan?.currency || "VND").toUpperCase(),
    limits
  };
}

async function getSupabasePlanInfoByUserRef(userOrId, supabase) {
  const supabaseUserId = await resolveBillingUserIdForSupabase(userOrId, supabase);
  if (!supabaseUserId) return null;

  async function query(selectColumns) {
    return supabase
      .from("billing_subscriptions")
      .select(selectColumns)
      .eq("user_id", supabaseUserId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
  }

  let result = await query("plan,status,provider,transaction_ref,amount,currency,upgraded_at,expires_at,cancel_at_period_end,cancelled_at");
  if (result.error && isMissingColumnError(result.error)) {
    result = await query("plan,status,provider,transaction_ref,amount,currency,upgraded_at");
  }

  const { data, error } = result;

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
    upgradedAt: data.upgraded_at || null,
    expiresAt: data.expires_at || null,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
    cancelledAt: data.cancelled_at || null
  });
}

function getLocalPlanInfoByUserId(userId) {
  const row = readLocalBillingStore().find((item) => item.userId === String(userId || ""));
  if (!row) return null;
  return buildPlanInfoPayload(row);
}

export async function getPlanInfoByUserIdAsync(userId) {
  const normalized = normalizeUserReference(userId);
  const normalizedUserId = normalized.id;
  if (!normalizedUserId) return buildPlanInfoPayload(PLAN_FREE);

  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const supabasePlan = await getSupabasePlanInfoByUserRef(normalizedUserId, supabase);
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
  const normalized = normalizeUserReference(user);
  if (!normalized.id && !normalized.email) {
    return buildPlanInfoPayload(PLAN_FREE);
  }

  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const supabasePlan = await getSupabasePlanInfoByUserRef(normalized, supabase);
      if (supabasePlan) return supabasePlan;
    } catch {
      // fallback to local
    }
  }

  const localPlan = getLocalPlanInfoByUserId(normalized.id);
  if (localPlan) return localPlan;
  return buildPlanInfoPayload(PLAN_FREE);
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
    expires_at: toIsoOrNull(payload.expiresAt),
    cancel_at_period_end: Boolean(payload.cancelAtPeriodEnd),
    cancelled_at: toIsoOrNull(payload.cancelledAt),
    updated_at: nowIso()
  };

  async function execute(upsertPayload, selectColumns) {
    return supabase
      .from("billing_subscriptions")
      .upsert(upsertPayload, { onConflict: "user_id" })
      .select(selectColumns)
      .maybeSingle();
  }

  let result = await execute(
    insertPayload,
    "plan,status,provider,transaction_ref,amount,currency,upgraded_at,expires_at,cancel_at_period_end,cancelled_at"
  );

  if (result.error && isMissingColumnError(result.error)) {
    const fallbackPayload = {
      user_id: insertPayload.user_id,
      plan: insertPayload.plan,
      status: insertPayload.status,
      provider: insertPayload.provider,
      transaction_ref: insertPayload.transaction_ref,
      amount: insertPayload.amount,
      currency: insertPayload.currency,
      upgraded_at: insertPayload.upgraded_at,
      updated_at: insertPayload.updated_at
    };
    result = await execute(
      fallbackPayload,
      "plan,status,provider,transaction_ref,amount,currency,upgraded_at"
    );
  }

  const { data, error } = result;

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
    upgradedAt: data.upgraded_at,
    expiresAt: data.expires_at || null,
    cancelAtPeriodEnd: Boolean(data.cancel_at_period_end),
    cancelledAt: data.cancelled_at || null
  });
}

export async function upgradeUserToProAsync(userOrId, paymentPayload = {}) {
  const normalized = normalizeUserReference(userOrId);
  const normalizedUserId = normalized.id;
  if (!normalizedUserId && !normalized.email) {
    throw new Error("Unauthorized");
  }

  const localUserId = normalizedUserId || normalized.email;

  const now = new Date();
  const previousPlanInfo = await ensurePlanInfoForUserAsync(normalized);
  const previousExpiryDate = parseIsoDate(previousPlanInfo?.expiresAt);
  const nowDate = parseIsoDate(now.toISOString()) || now;
  const cycleDays = Number(paymentPayload.cycleDays || PRO_PLAN_CYCLE_DAYS) || PRO_PLAN_CYCLE_DAYS;
  const periodAnchor = previousExpiryDate && previousExpiryDate.getTime() > nowDate.getTime()
    ? previousExpiryDate
    : nowDate;
  const nextExpiry = addDays(periodAnchor, cycleDays);

  const baseRecord = {
    userId: localUserId,
    plan: PLAN_PRO,
    status: "active",
    provider: normalizePaymentProvider(paymentPayload.provider || "mock"),
    transactionRef: normalizeTransactionRef(paymentPayload.transactionRef || `txn_${Date.now()}`),
    amount: Number(paymentPayload.amount || 299000),
    currency: String(paymentPayload.currency || "VND").toUpperCase(),
    upgradedAt: nowIso(),
    expiresAt: nextExpiry.toISOString(),
    cancelAtPeriodEnd: false,
    cancelledAt: null
  };

  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const supabaseUserId = await resolveBillingUserIdForSupabase(normalized, supabase);
      if (supabaseUserId) {
        const supabasePlan = await upsertSupabaseBillingRecord(supabaseUserId, {
          ...baseRecord,
          userId: supabaseUserId
        }, supabase);
        if (supabasePlan) {
          upsertLocalBillingRecord({
            ...baseRecord,
            userId: supabaseUserId
          });
          return supabasePlan;
        }
      }

      if (!canUseLocalBillingFallback()) {
        throw new Error("Billing subscription was not persisted. Please contact support.");
      }
    } catch {
      if (!canUseLocalBillingFallback()) {
        throw new Error("Billing backend is unavailable. Please try again in a moment.");
      }
    }
  } else if (!canUseLocalBillingFallback()) {
    throw new Error("Billing backend is not configured in production.");
  }

  const localRecord = upsertLocalBillingRecord(baseRecord);
  return buildPlanInfoPayload(localRecord);
}

export async function registerManualPaymentIntentAsync(userOrId, paymentPayload = {}) {
  const normalized = normalizeUserReference(userOrId);
  const normalizedUserId = normalized.id;
  if (!normalizedUserId && !normalized.email) {
    throw new Error("Unauthorized");
  }

  const localUserId = normalizedUserId || normalized.email;
  const method = normalizeManualPaymentMethod(paymentPayload.method || "bank_transfer");
  const transferRef = sanitizeManualTransferRef(paymentPayload.transferRef || "");
  if (!transferRef || transferRef.length < 6) {
    throw new Error("transferRef is required");
  }

  const baseRecord = {
    userId: localUserId,
    plan: PLAN_FREE,
    status: "pending",
    provider: normalizePaymentProvider(`manual_${method}`),
    transactionRef: normalizeTransactionRef(`manual_${transferRef}`),
    amount: Number(paymentPayload.amount || 129000),
    currency: String(paymentPayload.currency || "VND").toUpperCase(),
    upgradedAt: nowIso(),
    expiresAt: null,
    cancelAtPeriodEnd: false,
    cancelledAt: null
  };

  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const supabaseUserId = await resolveBillingUserIdForSupabase(normalized, supabase);
      if (supabaseUserId) {
        const supabasePlan = await upsertSupabaseBillingRecord(supabaseUserId, {
          ...baseRecord,
          userId: supabaseUserId
        }, supabase);
        if (supabasePlan) {
          upsertLocalBillingRecord({
            ...baseRecord,
            userId: supabaseUserId
          });
          return {
            ...supabasePlan,
            transferRef,
            paymentMethod: method
          };
        }
      }

      if (!canUseLocalBillingFallback()) {
        throw new Error("Manual payment intent was not persisted.");
      }
    } catch {
      if (!canUseLocalBillingFallback()) {
        throw new Error("Billing backend is unavailable. Please try again in a moment.");
      }
    }
  } else if (!canUseLocalBillingFallback()) {
    throw new Error("Billing backend is not configured in production.");
  }

  const localRecord = upsertLocalBillingRecord(baseRecord);
  return {
    ...buildPlanInfoPayload(localRecord),
    transferRef,
    paymentMethod: method
  };
}

function normalizeAmountInt(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return Math.max(0, Math.floor(Number(fallback) || 0));
  return Math.max(0, Math.floor(parsed));
}

function isPendingManualRow(row, transferRef) {
  return Boolean(
    row
    && String(row.status || "").toLowerCase() === "pending"
    && String(row.plan || "").toLowerCase() === PLAN_FREE
    && String(row.transactionRef || "").toLowerCase() === `manual_${String(transferRef || "").toLowerCase()}`
  );
}

export async function activatePendingManualPaymentAsync({
  transferRef,
  paidAmount,
  provider = "sepay",
  transactionRef = ""
} = {}) {
  const normalizedTransferRef = sanitizeManualTransferRef(transferRef || "");
  if (!normalizedTransferRef) {
    throw new Error("transferRef is required");
  }

  const normalizedPaidAmount = normalizeAmountInt(paidAmount, 0);
  const normalizedProvider = normalizePaymentProvider(provider || "sepay");
  const externalTransactionRef = normalizeTransactionRef(transactionRef || `sepay_${Date.now()}_${normalizedTransferRef}`);

  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select("user_id,amount,currency,status,plan,transaction_ref")
        .eq("transaction_ref", `manual_${normalizedTransferRef}`)
        .limit(1)
        .maybeSingle();

      if (error) {
        throw new Error(error.message || "Unable to load pending manual payment");
      }

      if (isPendingManualRow({
        status: data?.status,
        plan: data?.plan,
        transactionRef: data?.transaction_ref
      }, normalizedTransferRef)) {
        const expectedAmount = normalizeAmountInt(data?.amount, 0);
        if (expectedAmount > 0 && normalizedPaidAmount > 0 && normalizedPaidAmount < expectedAmount) {
          return {
            ok: false,
            reason: "amount_mismatch",
            transferRef: normalizedTransferRef,
            expectedAmount,
            paidAmount: normalizedPaidAmount,
            userId: String(data?.user_id || "")
          };
        }

        const planInfo = await upgradeUserToProAsync(String(data?.user_id || ""), {
          provider: normalizedProvider,
          transactionRef: externalTransactionRef,
          amount: expectedAmount || normalizedPaidAmount,
          currency: String(data?.currency || "VND").toUpperCase()
        });

        return {
          ok: true,
          reason: "activated",
          transferRef: normalizedTransferRef,
          userId: String(data?.user_id || ""),
          planInfo
        };
      }
    } catch {
      // fallback to local store
    }
  }

  const localRows = readLocalBillingStore();
  const pendingRow = localRows.find((row) => isPendingManualRow(row, normalizedTransferRef));
  if (!pendingRow) {
    return {
      ok: false,
      reason: "not_found",
      transferRef: normalizedTransferRef
    };
  }

  const expectedAmount = normalizeAmountInt(pendingRow.amount, 0);
  if (expectedAmount > 0 && normalizedPaidAmount > 0 && normalizedPaidAmount < expectedAmount) {
    return {
      ok: false,
      reason: "amount_mismatch",
      transferRef: normalizedTransferRef,
      expectedAmount,
      paidAmount: normalizedPaidAmount,
      userId: String(pendingRow.userId || "")
    };
  }

  const planInfo = await upgradeUserToProAsync(String(pendingRow.userId || ""), {
    provider: normalizedProvider,
    transactionRef: externalTransactionRef,
    amount: expectedAmount || normalizedPaidAmount,
    currency: String(pendingRow.currency || "VND").toUpperCase()
  });

  return {
    ok: true,
    reason: "activated",
    transferRef: normalizedTransferRef,
    userId: String(pendingRow.userId || ""),
    planInfo
  };
}

export async function downgradeUserToFreeAsync(userId, payload = {}) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw new Error("Unauthorized");
  }

  const baseRecord = {
    userId: normalizedUserId,
    plan: PLAN_PRO,
    status: "active",
    provider: normalizePaymentProvider(payload.provider || "manual"),
    transactionRef: normalizeTransactionRef(payload.transactionRef || `cancel_${Date.now()}`),
    amount: Number(payload.amount || 0),
    currency: "VND",
    upgradedAt: payload.upgradedAt || nowIso(),
    expiresAt: toIsoOrNull(payload.expiresAt),
    cancelAtPeriodEnd: true,
    cancelledAt: nowIso()
  };

  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const supabasePlan = await upsertSupabaseBillingRecord(normalizedUserId, baseRecord, supabase);
      if (supabasePlan) {
        upsertLocalBillingRecord(baseRecord);
        return supabasePlan;
      }
      if (!canUseLocalBillingFallback()) {
        throw new Error("Billing downgrade was not persisted. Please contact support.");
      }
    } catch {
      if (!canUseLocalBillingFallback()) {
        throw new Error("Billing backend is unavailable. Please try again in a moment.");
      }
    }
  } else if (!canUseLocalBillingFallback()) {
    throw new Error("Billing backend is not configured in production.");
  }

  const localRecord = upsertLocalBillingRecord(baseRecord);
  return buildPlanInfoPayload(localRecord);
}

export async function markExpiredSubscriptionsToFreeAsync() {
  const now = new Date();
  const nowIsoValue = now.toISOString();

  const supabase = createServerSupabaseClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from("billing_subscriptions")
        .select("id,user_id,plan,status,expires_at,cancel_at_period_end,cancelled_at")
        .eq("plan", PLAN_PRO)
        .eq("status", "active")
        .not("expires_at", "is", null)
        .lte("expires_at", nowIsoValue)
        .limit(500);

      if (!error && Array.isArray(data) && data.length) {
        for (const row of data) {
          await supabase
            .from("billing_subscriptions")
            .update({
              plan: PLAN_FREE,
              status: "active",
              amount: 0,
              updated_at: nowIsoValue,
              cancel_at_period_end: false,
              cancelled_at: row?.cancelled_at || nowIsoValue
            })
            .eq("id", row.id);
        }
      }
    } catch {
      // fallback to local check
    }
  }

  const localRows = readLocalBillingStore();
  if (!localRows.length) return;

  let changed = false;
  const nextRows = localRows.map((row) => {
    const expiresAt = parseIsoDate(row?.expiresAt);
    if (row?.plan === PLAN_PRO && row?.status === "active" && expiresAt && expiresAt.getTime() <= now.getTime()) {
      changed = true;
      return {
        ...row,
        plan: PLAN_FREE,
        status: "active",
        amount: 0,
        cancelAtPeriodEnd: false,
        cancelledAt: row?.cancelledAt || nowIsoValue,
        updatedAt: nowIsoValue
      };
    }
    return row;
  });

  if (changed) {
    writeLocalBillingStore(nextRows);
  }
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
