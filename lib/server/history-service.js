import { readJsonArray, writeJsonArray, paths } from "@/lib/server/local-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseHistoryInsert, normalizeHistoryRecord } from "@/lib/server/history-serializers";

export function listHistoryByUser(userId) {
  return readJsonArray(paths.history).filter((item) => item.userId === userId);
}

export async function listHistoryByUserAsync(userId) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase.from("history_items").select("*").eq("user_id", userId).order("created_at", { ascending: false });
    if (data) {
      return data.map(normalizeHistoryRecord);
    }
  }
  return listHistoryByUser(userId);
}

export function createHistoryItem({ userId, title, variantLabel, formData, resultData, images = [] }) {
  const items = readJsonArray(paths.history);
  const entry = {
    id: `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    userId,
    title,
    variantLabel,
    form: formData,
    images,
    result: resultData
  };
  items.unshift(entry);
  writeJsonArray(paths.history, items.slice(0, 200));
  return entry;
}

export async function createHistoryItemAsync({ userId, title, variantLabel, formData, resultData, images = [] }) {
  const supabase = createServerSupabaseClient();
  if (supabase && userId) {
    const { data } = await supabase.from("history_items").insert(createSupabaseHistoryInsert({ userId, title, variantLabel, formData, resultData, images })).select("*").single();
    if (data) {
      return normalizeHistoryRecord(data);
    }
  }
  return createHistoryItem({ userId, title, variantLabel, formData, resultData, images });
}

export function toggleFavorite(userId, historyId) {
  const users = readJsonArray(paths.users);
  const user = users.find((item) => item.id === userId);
  if (!user) throw new Error("User not found");
  user.favorites = user.favorites || [];
  if (user.favorites.includes(historyId)) {
    user.favorites = user.favorites.filter((id) => id !== historyId);
  } else {
    user.favorites.unshift(historyId);
  }
  writeJsonArray(paths.users, users);
  return user.favorites;
}

export async function toggleFavoriteAsync(userId, historyId) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase.from("favorites").select("id").eq("user_id", userId).eq("history_item_id", historyId).maybeSingle();
    if (data?.id) {
      await supabase.from("favorites").delete().eq("id", data.id);
    } else {
      await supabase.from("favorites").insert({ user_id: userId, history_item_id: historyId });
    }
    const { data: nextData } = await supabase.from("favorites").select("history_item_id").eq("user_id", userId);
    return (nextData || []).map((item) => item.history_item_id);
  }
  return toggleFavorite(userId, historyId);
}

export function listFavoritesByUser(userId) {
  const users = readJsonArray(paths.users);
  const user = users.find((item) => item.id === userId);
  const history = readJsonArray(paths.history);
  return (user?.favorites || []).map((id) => history.find((entry) => entry.id === id)).filter(Boolean);
}

export async function listFavoritesByUserAsync(userId) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const { data } = await supabase
      .from("favorites")
      .select("history_item_id, history_items(*)")
      .eq("user_id", userId);
    if (data) {
      return data.map((row) => normalizeHistoryRecord(row.history_items));
    }
  }
  return listFavoritesByUser(userId);
}

export function deleteHistoryByUser(userId, historyId) {
  const nextHistory = readJsonArray(paths.history).filter((item) => !(item.userId === userId && item.id === historyId));
  writeJsonArray(paths.history, nextHistory);
  return nextHistory;
}

export async function deleteHistoryByUserAsync(userId, historyId) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    await supabase.from("favorites").delete().eq("user_id", userId).eq("history_item_id", historyId);
    await supabase.from("history_items").delete().eq("user_id", userId).eq("id", historyId);
    return true;
  }
  return deleteHistoryByUser(userId, historyId);
}
