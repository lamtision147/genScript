import { createServerSupabaseClient } from "@/lib/supabase/server";
import { paths, readJsonArray, writeJsonArray } from "@/lib/server/local-store";
import { hashPassword, isAdminEmail, isUuid } from "@/lib/server/auth-service";

function toIso(value) {
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toISOString();
  } catch {
    return null;
  }
}

function dateMax(a, b) {
  const da = a ? new Date(a).getTime() : 0;
  const db = b ? new Date(b).getTime() : 0;
  return da >= db ? a : b;
}

function mapUsersWithStats(users = [], historyRows = [], favoriteRows = []) {
  const stats = new Map();

  for (const row of historyRows) {
    const userId = String(row.user_id || row.userId || "").trim();
    if (!userId) continue;
    const prev = stats.get(userId) || { historyCount: 0, favoriteCount: 0, lastActivity: null };
    prev.historyCount += 1;
    prev.lastActivity = dateMax(prev.lastActivity, toIso(row.created_at || row.createdAt));
    stats.set(userId, prev);
  }

  for (const row of favoriteRows) {
    const userId = String(row.user_id || row.userId || "").trim();
    if (!userId) continue;
    const prev = stats.get(userId) || { historyCount: 0, favoriteCount: 0, lastActivity: null };
    prev.favoriteCount += 1;
    prev.lastActivity = dateMax(prev.lastActivity, toIso(row.created_at || row.createdAt));
    stats.set(userId, prev);
  }

  return users
    .map((user) => {
      const userId = String(user.id || "");
      const rowStats = stats.get(userId) || { historyCount: 0, favoriteCount: 0, lastActivity: null };
      const createdAt = toIso(user.created_at || user.createdAt) || new Date(0).toISOString();
      return {
        id: userId,
        email: user.email || "",
        name: user.name || "",
        isAdmin: isAdminEmail(user.email),
        createdAt,
        historyCount: rowStats.historyCount,
        favoriteCount: rowStats.favoriteCount,
        lastActivity: rowStats.lastActivity || createdAt
      };
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function applyUserQuery(items = [], query = "") {
  const normalized = String(query || "").trim().toLowerCase();
  if (!normalized) return items;
  return items.filter((user) => {
    const email = String(user.email || "").toLowerCase();
    const name = String(user.name || "").toLowerCase();
    return email.includes(normalized) || name.includes(normalized);
  });
}

function paginateUsers(items = [], { page = 1, pageSize = 20 } = {}) {
  const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20));
  const safePage = Math.max(1, Number(page) || 1);
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safePageSize;
  const pagedItems = items.slice(start, start + safePageSize);
  return {
    items: pagedItems,
    meta: {
      page: currentPage,
      pageSize: safePageSize,
      total,
      totalPages
    }
  };
}

export async function listAdminUsersAsync({ query = "", page = 1, pageSize = 20 } = {}) {
  const supabase = createServerSupabaseClient();

  if (supabase) {
    try {
      const [usersRes, historyRes, favoritesRes] = await Promise.all([
        supabase.from("users").select("id,email,name,created_at").order("created_at", { ascending: false }).limit(500),
        supabase.from("history_items").select("user_id,created_at").limit(5000),
        supabase.from("favorites").select("user_id,created_at").limit(5000)
      ]);

      if (!usersRes.error && usersRes.data) {
        const merged = mapUsersWithStats(usersRes.data, historyRes.data || [], favoritesRes.data || []);
        const filtered = applyUserQuery(merged, query);
        return paginateUsers(filtered, { page, pageSize });
      }
    } catch {
      // fallback to local
    }
  }

  const localUsers = readJsonArray(paths.users).map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    created_at: user.createdAt || new Date().toISOString()
  }));
  const localHistory = readJsonArray(paths.history).map((item) => ({ user_id: item.userId, created_at: item.createdAt }));

  const localFavorites = [];
  for (const user of readJsonArray(paths.users)) {
    for (const historyId of Array.isArray(user.favorites) ? user.favorites : []) {
      localFavorites.push({ user_id: user.id, history_id: historyId, created_at: new Date().toISOString() });
    }
  }

  const merged = mapUsersWithStats(localUsers, localHistory, localFavorites);
  const filtered = applyUserQuery(merged, query);
  return paginateUsers(filtered, { page, pageSize });
}

function assertNotAdminUserByEmail(email) {
  if (isAdminEmail(email)) {
    throw new Error("Admin account cannot be modified.");
  }
}

export async function adminResetUserPasswordAsync(userId, newPassword) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("userId is required");
  if (String(newPassword || "").trim().length < 6) throw new Error("Password must be at least 6 characters");

  const nextHash = hashPassword(newPassword);
  let updated = false;

  const supabase = createServerSupabaseClient();
  if (supabase && isUuid(normalizedUserId)) {
    const { data: targetUser, error: lookupError } = await supabase.from("users").select("email").eq("id", normalizedUserId).maybeSingle();
    if (lookupError) throw new Error(lookupError.message || "Unable to lookup target user");
    if (targetUser?.email) {
      assertNotAdminUserByEmail(targetUser.email);
    }

    const { error } = await supabase.from("users").update({ password_hash: nextHash }).eq("id", normalizedUserId);
    if (error) throw new Error(error.message || "Unable to reset password in Supabase");
    updated = true;
  }

  const users = readJsonArray(paths.users);
  let changed = false;
  for (const user of users) {
    if (user.id === normalizedUserId || user.supabaseId === normalizedUserId) {
      assertNotAdminUserByEmail(user.email);
      user.passwordHash = nextHash;
      changed = true;
      updated = true;
    }
  }
  if (changed) writeJsonArray(paths.users, users);

  if (!updated) {
    throw new Error("User not found");
  }

  return true;
}

export async function adminDeleteUserAsync(userId) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) throw new Error("userId is required");

  let deleted = false;
  const supabase = createServerSupabaseClient();
  if (supabase && isUuid(normalizedUserId)) {
    const { data: targetUser, error: lookupError } = await supabase.from("users").select("email").eq("id", normalizedUserId).maybeSingle();
    if (lookupError) throw new Error(lookupError.message || "Unable to lookup target user");
    if (targetUser?.email) {
      assertNotAdminUserByEmail(targetUser.email);
    }

    const { error } = await supabase.from("users").delete().eq("id", normalizedUserId);
    if (error) throw new Error(error.message || "Unable to delete user in Supabase");
    deleted = true;
  }

  const users = readJsonArray(paths.users);
  for (const user of users) {
    if ((user.id === normalizedUserId || user.supabaseId === normalizedUserId) && isAdminEmail(user.email)) {
      throw new Error("Admin account cannot be modified.");
    }
  }
  const nextUsers = users.filter((user) => user.id !== normalizedUserId && user.supabaseId !== normalizedUserId);
  if (nextUsers.length !== users.length) {
    writeJsonArray(paths.users, nextUsers);
    deleted = true;
  }

  const history = readJsonArray(paths.history);
  const nextHistory = history.filter((item) => item.userId !== normalizedUserId);
  if (nextHistory.length !== history.length) {
    writeJsonArray(paths.history, nextHistory);
  }

  if (!deleted) {
    throw new Error("User not found");
  }

  return true;
}
