import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync, isAdminEmail, resolveSupabaseUserId } from "@/lib/server/auth-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { paths, readJsonArray } from "@/lib/server/local-store";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function ensureAdmin(user) {
  if (!user || !isAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
}

function normalizeQuery(value = "") {
  return String(value || "").trim().toLowerCase();
}

function applyQuery(items, query = "") {
  const q = normalizeQuery(query);
  if (!q) return items;
  return items.filter((item) => {
    const email = String(item.email || "").toLowerCase();
    const name = String(item.name || "").toLowerCase();
    const plan = String(item.plan || "").toLowerCase();
    return email.includes(q) || name.includes(q) || plan.includes(q);
  });
}

function paginate(items, page = 1, pageSize = 20) {
  const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safePageSize;
  return {
    items: items.slice(start, start + safePageSize),
    meta: {
      page: currentPage,
      pageSize: safePageSize,
      total,
      totalPages
    }
  };
}

async function listSupabaseSubscriptions() {
  const supabase = createServerSupabaseClient();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("billing_subscriptions")
    .select("user_id,plan,status,provider,transaction_ref,amount,currency,upgraded_at,updated_at")
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new Error(error.message || "Unable to load subscriptions from Supabase");
  }

  if (!Array.isArray(data)) return [];

  const userIds = data.map((item) => item.user_id).filter(Boolean);
  let userMap = new Map();
  if (userIds.length) {
    const { data: usersData } = await supabase.from("users").select("id,email,name").in("id", userIds);
    userMap = new Map((usersData || []).map((row) => [row.id, row]));
  }

  return data.map((row) => {
    const user = userMap.get(row.user_id) || {};
    return {
      userId: row.user_id,
      email: user.email || "",
      name: user.name || "",
      plan: row.plan || "free",
      status: row.status || "active",
      provider: row.provider || "",
      transactionRef: row.transaction_ref || "",
      amount: Number(row.amount || 0),
      currency: String(row.currency || "VND").toUpperCase(),
      upgradedAt: row.upgraded_at || null,
      updatedAt: row.updated_at || null
    };
  });
}

function listLocalSubscriptions() {
  const users = readJsonArray(paths.users);
  const userMap = new Map(users.map((user) => [String(user.id), user]));
  const rows = readJsonArray(paths.billingSubscriptions);

  return (Array.isArray(rows) ? rows : []).map((row) => {
    const user = userMap.get(String(row.userId || "")) || {};
    return {
      userId: String(row.userId || ""),
      email: user.email || "",
      name: user.name || "",
      plan: row.plan || "free",
      status: row.status || "active",
      provider: row.provider || "",
      transactionRef: row.transactionRef || "",
      amount: Number(row.amount || 0),
      currency: String(row.currency || "VND").toUpperCase(),
      upgradedAt: row.upgradedAt || null,
      updatedAt: row.updatedAt || null
    };
  });
}

export async function GET(request) {
  const ctx = createRequestContext(request, "/api/admin/billing/subscriptions");
  try {
    const actor = await getCurrentUserFromCookiesAsync();
    ensureAdmin(actor);

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const page = Number(searchParams.get("page") || 1);
    const pageSize = Number(searchParams.get("pageSize") || 20);

    const sourceRows = await listSupabaseSubscriptions().catch(() => null);
    const rows = sourceRows || listLocalSubscriptions();
    const filtered = applyQuery(rows, query);
    const result = paginate(filtered, page, pageSize);

    logInfo(ctx, "admin.billing.subscriptions.list", {
      actorId: actor.id,
      count: result.items.length,
      total: result.meta.total,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json(result), ctx);
  } catch (error) {
    const status = error.message === "Forbidden" ? 403 : 400;
    logError(ctx, "admin.billing.subscriptions.list.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to load subscriptions" }, { status }), ctx);
  }
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/admin/billing/subscriptions");
  try {
    const actor = await getCurrentUserFromCookiesAsync();
    ensureAdmin(actor);

    const payload = await request.json().catch(() => ({}));
    const targetUserId = String(payload?.userId || "").trim();
    const nextPlan = String(payload?.plan || "").trim().toLowerCase();
    if (!targetUserId || !["free", "pro"].includes(nextPlan)) {
      return withRequestId(NextResponse.json({ error: "userId and valid plan are required" }, { status: 400 }), ctx);
    }

    const { upgradeUserToProAsync, downgradeUserToFreeAsync } = await import("@/lib/server/billing-service");
    const planInfo = nextPlan === "pro"
      ? await upgradeUserToProAsync(targetUserId, { provider: "admin", transactionRef: `admin_upgrade_${Date.now()}` })
      : await downgradeUserToFreeAsync(targetUserId, { provider: "admin", transactionRef: `admin_downgrade_${Date.now()}` });

    logInfo(ctx, "admin.billing.subscriptions.update", {
      actorId: actor.id,
      userId: targetUserId,
      nextPlan,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({ ok: true, planInfo }), ctx);
  } catch (error) {
    const status = error.message === "Forbidden" ? 403 : 400;
    logError(ctx, "admin.billing.subscriptions.update.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to update subscription" }, { status }), ctx);
  }
}
