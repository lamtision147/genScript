import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync, isAdminEmail } from "@/lib/server/auth-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { paths, readJsonArray } from "@/lib/server/local-store";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function ensureAdmin(user) {
  if (!user || !isAdminEmail(user.email)) {
    throw new Error("Forbidden");
  }
}

function buildCsv(items = []) {
  const header = ["userId", "email", "name", "plan", "status", "provider", "transactionRef", "amount", "currency", "upgradedAt", "updatedAt"];
  const rows = [header.join(",")];

  for (const item of items) {
    const values = [
      item.userId || "",
      item.email || "",
      item.name || "",
      item.plan || "",
        item.status || "",
        item.provider || "",
        item.transactionRef || "",
        String(item.amount || 0),
        item.currency || "VND",
      item.upgradedAt || "",
      item.updatedAt || ""
    ].map((value) => `"${String(value).replace(/"/g, '""')}"`);

    rows.push(values.join(","));
  }

  return rows.join("\n");
}

async function listRows() {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data, error } = await supabase
      .from("billing_subscriptions")
      .select("user_id,plan,status,provider,transaction_ref,amount,currency,upgraded_at,updated_at")
      .order("updated_at", { ascending: false })
      .limit(5000);
    if (error) throw new Error(error.message || "Unable to load subscription data");

    const userIds = (data || []).map((item) => item.user_id).filter(Boolean);
    let userMap = new Map();
    if (userIds.length) {
      const { data: usersData } = await supabase.from("users").select("id,email,name").in("id", userIds);
      userMap = new Map((usersData || []).map((item) => [item.id, item]));
    }

    return (data || []).map((item) => {
      const user = userMap.get(item.user_id) || {};
      return {
        userId: item.user_id,
        email: user.email || "",
        name: user.name || "",
        plan: item.plan || "free",
        status: item.status || "active",
        provider: item.provider || "",
        transactionRef: item.transaction_ref || "",
        amount: Number(item.amount || 0),
        currency: String(item.currency || "VND").toUpperCase(),
        upgradedAt: item.upgraded_at || "",
        updatedAt: item.updated_at || ""
      };
    });
  }

  const users = readJsonArray(paths.users);
  const userMap = new Map(users.map((user) => [String(user.id || ""), user]));
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
      upgradedAt: row.upgradedAt || "",
      updatedAt: row.updatedAt || ""
    };
  });
}

export async function GET(request) {
  const ctx = createRequestContext(request, "/api/admin/billing/export");
  try {
    const actor = await getCurrentUserFromCookiesAsync();
    ensureAdmin(actor);

    const rows = await listRows();
    const csv = buildCsv(rows);

    logInfo(ctx, "admin.billing.export.success", {
      actorId: actor.id,
      count: rows.length,
      ms: elapsedMs(ctx)
    });

    const response = new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="billing-subscriptions-${Date.now()}.csv"`
      }
    });
    return withRequestId(response, ctx);
  } catch (error) {
    const status = error.message === "Forbidden" ? 403 : 400;
    logError(ctx, "admin.billing.export.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to export billing CSV" }, { status }), ctx);
  }
}
