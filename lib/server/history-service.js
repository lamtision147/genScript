import { readJsonArray, writeJsonArray, paths } from "@/lib/server/local-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseHistoryInsert, normalizeHistoryRecord } from "@/lib/server/history-serializers";
import { isUuid, resolveSupabaseUserId } from "@/lib/server/auth-service";

const HISTORY_TYPES = new Set(["product_copy", "video_script"]);

function normalizeHistoryType(type) {
  const normalized = String(type || "").trim().toLowerCase();
  return HISTORY_TYPES.has(normalized) ? normalized : null;
}

function getHistoryItemType(item) {
  const fromForm = String(item?.form?.contentType || item?.form_data?.contentType || "").trim().toLowerCase();
  if (fromForm === "video_script") return "video_script";
  return "product_copy";
}

function filterHistoryByType(items, type) {
  const normalizedType = normalizeHistoryType(type);
  if (!normalizedType) return items;
  return (items || []).filter((item) => getHistoryItemType(item) === normalizedType);
}

function filterHistoryByOwner(items, userId) {
  const normalized = String(userId || "").trim();
  return items.filter((item) => item.userId === normalized);
}

function decorateFavorites(items, favoriteIds) {
  const favoriteSet = new Set((favoriteIds || []).map((id) => String(id)));
  return items.map((item) => ({ ...item, isFavorite: favoriteSet.has(String(item.id)) }));
}

function dedupeById(items) {
  const map = new Map();
  for (const item of items || []) {
    if (!item?.id) continue;
    map.set(String(item.id), item);
  }
  return Array.from(map.values());
}

function getSupabaseForFavoritesOrThrow() {
  const supabase = createServerSupabaseClient();
  if (!supabase) {
    throw new Error("Supabase favorites is required. Configure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return supabase;
}

async function resolveSupabaseUserIdOrThrow(userId, supabase) {
  const supabaseUserId = isUuid(userId) ? userId : await resolveSupabaseUserId(userId, supabase);
  if (!supabaseUserId) {
    throw new Error("Unable to map current user to Supabase for favorites.");
  }
  return supabaseUserId;
}

export function listHistoryByUser(userId, options = {}) {
  const scoped = filterHistoryByOwner(readJsonArray(paths.history), userId);
  return filterHistoryByType(scoped, options.type);
}

export async function listHistoryByUserAsync(userId, options = {}) {
  const supabase = createServerSupabaseClient();
  const localHistory = listHistoryByUser(userId, options);

  if (!supabase) {
    return localHistory;
  }

  const supabaseUserId = isUuid(userId) ? userId : await resolveSupabaseUserId(userId, supabase);
  if (!supabaseUserId) {
    return localHistory;
  }

  try {
    const [historyResult, favoritesResult] = await Promise.all([
      supabase.from("history_items").select("*").eq("user_id", supabaseUserId).order("created_at", { ascending: false }),
      supabase.from("favorites").select("history_item_id").eq("user_id", supabaseUserId)
    ]);

    if (!historyResult.error && historyResult.data) {
      const favoriteIds = (favoritesResult.data || []).map((item) => item.history_item_id).filter(Boolean);
      const normalized = decorateFavorites(historyResult.data.map(normalizeHistoryRecord), favoriteIds);
      return filterHistoryByType(normalized, options.type);
    }
  } catch {
    // noop
  }

  return localHistory;
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
  const wrote = writeJsonArray(paths.history, items.slice(0, 200));
  if (!wrote) {
    throw new Error("Local history storage is read-only. Please configure Supabase for persistent history.");
  }
  return entry;
}

function createTransientHistoryItem({ userId, title, variantLabel, formData, resultData, images = [] }) {
  const normalizedResult = resultData && typeof resultData === "object"
    ? {
        ...resultData,
        variants: Array.isArray(resultData.variants) && resultData.variants.length ? resultData.variants : [resultData],
        selectedVariant: Number.isFinite(Number(resultData.selectedVariant)) ? Number(resultData.selectedVariant) : 0
      }
    : resultData;

  return {
    id: `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    userId: userId || null,
    title,
    variantLabel,
    form: formData,
    images,
    result: normalizedResult
  };
}

export async function createHistoryItemAsync({ userId, title, variantLabel, formData, resultData, images = [] }) {
  const supabase = createServerSupabaseClient();
  if (supabase && userId) {
    const supabaseUserId = isUuid(userId) ? userId : await resolveSupabaseUserId(userId, supabase);
    try {
      if (supabaseUserId) {
        const { data } = await supabase
          .from("history_items")
          .insert(createSupabaseHistoryInsert({ userId: supabaseUserId, title, variantLabel, formData, resultData, images }))
          .select("*")
          .single();
        if (data) {
          return normalizeHistoryRecord(data);
        }
      }
    } catch {
      // Fall through to non-persistent response instead of breaking content generation.
    }
  }

  if (!userId) {
    return createTransientHistoryItem({ userId, title, variantLabel, formData, resultData, images });
  }

  try {
    return createHistoryItem({ userId, title, variantLabel, formData, resultData, images });
  } catch {
    return createTransientHistoryItem({ userId, title, variantLabel, formData, resultData, images });
  }
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
  const wrote = writeJsonArray(paths.users, users);
  if (!wrote) {
    throw new Error("Local favorite storage is read-only. Please configure Supabase for persistent favorites.");
  }
  return user.favorites;
}

export async function toggleFavoriteAsync(userId, historyId) {
  const supabase = getSupabaseForFavoritesOrThrow();
  const supabaseUserId = await resolveSupabaseUserIdOrThrow(userId, supabase);

  const { data: existing, error: existingError } = await supabase
    .from("favorites")
    .select("id")
    .eq("user_id", supabaseUserId)
    .eq("history_item_id", historyId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message || "Failed to read favorite state from Supabase");
  }

  if (existing?.id) {
    const { error: deleteError } = await supabase.from("favorites").delete().eq("id", existing.id);
    if (deleteError) {
      throw new Error(deleteError.message || "Failed to remove favorite in Supabase");
    }
  } else {
    const { error: insertError } = await supabase
      .from("favorites")
      .insert({ user_id: supabaseUserId, history_item_id: historyId });
    if (insertError) {
      throw new Error(insertError.message || "Failed to add favorite in Supabase");
    }
  }

  const { data: nextData, error: nextError } = await supabase
    .from("favorites")
    .select("history_item_id")
    .eq("user_id", supabaseUserId);

  if (nextError) {
    throw new Error(nextError.message || "Failed to reload favorites from Supabase");
  }

  return (nextData || []).map((item) => item.history_item_id);
}

export function listFavoritesByUser(userId, options = {}) {
  const users = readJsonArray(paths.users);
  const user = users.find((item) => item.id === userId);
  const history = readJsonArray(paths.history);
  const items = (user?.favorites || []).map((id) => history.find((entry) => entry.id === id)).filter(Boolean);
  return filterHistoryByType(items, options.type);
}

export async function listFavoritesByUserAsync(userId, options = {}) {
  const supabase = getSupabaseForFavoritesOrThrow();
  const supabaseUserId = await resolveSupabaseUserIdOrThrow(userId, supabase);

  const { data, error } = await supabase
    .from("favorites")
    .select("history_item_id, history_items(*)")
    .eq("user_id", supabaseUserId);

  if (error) {
    throw new Error(error.message || "Failed to load favorites from Supabase");
  }

  const supaFavorites = (data || [])
    .map((row) => normalizeHistoryRecord(row.history_items))
    .filter((item) => Boolean(item?.id))
    .map((item) => ({ ...item, isFavorite: true }));

  return filterHistoryByType(dedupeById(supaFavorites), options.type);
}

export function deleteHistoryByUser(userId, historyId) {
  const nextHistory = readJsonArray(paths.history).filter((item) => !(item.userId === userId && item.id === historyId));
  const wrote = writeJsonArray(paths.history, nextHistory);
  if (!wrote) {
    throw new Error("Local history storage is read-only. Please configure Supabase for persistent history.");
  }
  return nextHistory;
}

export async function deleteHistoryByUserAsync(userId, historyId) {
  const supabase = createServerSupabaseClient();
  if (supabase) {
    const supabaseUserId = isUuid(userId) ? userId : await resolveSupabaseUserId(userId, supabase);
    if (supabaseUserId) {
      await supabase.from("favorites").delete().eq("user_id", supabaseUserId).eq("history_item_id", historyId);
      await supabase.from("history_items").delete().eq("user_id", supabaseUserId).eq("id", historyId);
      return true;
    }
  }
  return deleteHistoryByUser(userId, historyId);
}
