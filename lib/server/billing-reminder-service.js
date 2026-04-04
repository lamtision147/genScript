import { appEnv } from "@/lib/env";
import { sendRenewalReminderEmail } from "@/lib/server/auth-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { paths, readJsonArray, writeJsonArray } from "@/lib/server/local-store";

const REMINDER_STATE_PATH = paths.billingReminderEmails || paths.billingWebhookEvents;
const REMINDER_DEFAULT_DAYS = [7, 3, 1];

function toIsoDay(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function normalizeReminderDays(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return REMINDER_DEFAULT_DAYS;
  const parsed = raw
    .split(",")
    .map((item) => Number(String(item || "").trim()))
    .filter((item) => Number.isFinite(item) && item >= 0)
    .map((item) => Math.floor(item));
  return parsed.length ? [...new Set(parsed)].sort((a, b) => b - a) : REMINDER_DEFAULT_DAYS;
}

function parseRemainingDays(expiresAt) {
  const expiry = new Date(String(expiresAt || ""));
  if (!Number.isFinite(expiry.getTime())) return null;
  const now = new Date();
  const deltaMs = expiry.getTime() - now.getTime();
  return Math.max(0, Math.ceil(deltaMs / (24 * 60 * 60 * 1000)));
}

function buildReminderKey({ userId, expiresAt, remainingDays }) {
  return `renewal:${String(userId || "")}:${toIsoDay(expiresAt)}:${Number(remainingDays)}`;
}

function readReminderState() {
  return readJsonArray(REMINDER_STATE_PATH)
    .filter((row) => row && typeof row === "object" && String(row.kind || "") === "renewal_reminder_sent")
    .map((row) => ({
      kind: "renewal_reminder_sent",
      key: String(row.key || ""),
      userId: String(row.userId || ""),
      sentAt: String(row.sentAt || "")
    }))
    .filter((row) => row.key);
}

function saveReminderState(rows = []) {
  const sanitized = rows
    .slice(0, 5000)
    .map((row) => ({
      kind: "renewal_reminder_sent",
      key: String(row.key || ""),
      userId: String(row.userId || ""),
      sentAt: String(row.sentAt || new Date().toISOString())
    }))
    .filter((row) => row.key);
  writeJsonArray(REMINDER_STATE_PATH, sanitized);
}

function wasReminderSent(stateRows, key) {
  return stateRows.some((row) => row.key === key);
}

function markReminderSent(stateRows, { key, userId }) {
  const next = [
    {
      kind: "renewal_reminder_sent",
      key,
      userId: String(userId || ""),
      sentAt: new Date().toISOString()
    },
    ...stateRows.filter((row) => row.key !== key)
  ];
  saveReminderState(next);
  return next;
}

async function listProSubscriptionsForReminder() {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("billing_subscriptions")
      .select("user_id,plan,status,expires_at")
      .eq("plan", "pro")
      .eq("status", "active")
      .not("expires_at", "is", null)
      .limit(2000);

    if (!error) {
      const userIds = [...new Set((Array.isArray(data) ? data : []).map((row) => String(row.user_id || "")).filter(Boolean))];
      let usersById = new Map();
      if (userIds.length) {
        const { data: usersData } = await supabase.from("users").select("id,email,name").in("id", userIds);
        usersById = new Map((Array.isArray(usersData) ? usersData : []).map((user) => [String(user.id || ""), user]));
      }

      return (Array.isArray(data) ? data : []).map((row) => {
        const user = usersById.get(String(row.user_id || "")) || {};
        return {
          userId: String(row.user_id || ""),
          email: String(user.email || ""),
          name: String(user.name || ""),
          expiresAt: row.expires_at || null
        };
      }).filter((row) => row.userId && row.email && row.expiresAt);
    }
  }

  const users = readJsonArray(paths.users);
  const usersById = new Map((Array.isArray(users) ? users : []).map((user) => [String(user.id || ""), user]));
  const subscriptions = readJsonArray(paths.billingSubscriptions);
  return (Array.isArray(subscriptions) ? subscriptions : [])
    .filter((row) => String(row.plan || "") === "pro" && String(row.status || "") === "active" && row.expiresAt)
    .map((row) => {
      const user = usersById.get(String(row.userId || "")) || {};
      return {
        userId: String(row.userId || ""),
        email: String(user.email || ""),
        name: String(user.name || ""),
        expiresAt: row.expiresAt || null
      };
    })
    .filter((row) => row.userId && row.email && row.expiresAt);
}

export async function sendRenewalReminderBatchAsync() {
  const reminderDays = normalizeReminderDays(process.env.RENEWAL_REMINDER_DAYS || "");
  const subscriptions = await listProSubscriptionsForReminder();
  let stateRows = readReminderState();

  let scanned = 0;
  let sent = 0;
  let skipped = 0;

  for (const item of subscriptions) {
    scanned += 1;
    const remainingDays = parseRemainingDays(item.expiresAt);
    if (remainingDays === null || !reminderDays.includes(remainingDays)) {
      skipped += 1;
      continue;
    }

    const reminderKey = buildReminderKey({
      userId: item.userId,
      expiresAt: item.expiresAt,
      remainingDays
    });

    if (wasReminderSent(stateRows, reminderKey)) {
      skipped += 1;
      continue;
    }

    try {
      const emailSent = await sendRenewalReminderEmail({
        email: item.email,
        name: item.name,
        expiresAt: item.expiresAt,
        remainingDays,
        upgradeUrl: `${String(appEnv.publicBaseUrl || "").replace(/\/$/, "")}/upgrade`
      });

      if (!emailSent) {
        skipped += 1;
        continue;
      }

      stateRows = markReminderSent(stateRows, {
        key: reminderKey,
        userId: item.userId
      });
      sent += 1;
    } catch {
      skipped += 1;
    }
  }

  return {
    ok: true,
    scanned,
    sent,
    skipped,
    reminderDays
  };
}
