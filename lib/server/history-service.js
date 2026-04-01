import { readJsonArray, writeJsonArray, paths } from "@/lib/server/local-store";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createSupabaseHistoryInsert, normalizeHistoryRecord } from "@/lib/server/history-serializers";
import { isUuid, resolveSupabaseUserId } from "@/lib/server/auth-service";
import { getPlanLimits, getPlanInfoByUserIdAsync } from "@/lib/server/billing-service";

const HISTORY_TYPES = new Set(["product_copy", "video_script"]);

function toPositiveIntOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  if (parsed <= 0) return null;
  return Math.floor(parsed);
}

function applyServerLimit(items, limit) {
  const normalizedLimit = toPositiveIntOrNull(limit);
  if (!normalizedLimit) return items;
  return Array.isArray(items) ? items.slice(0, normalizedLimit) : [];
}

async function resolveHistoryListLimitByUser(userId) {
  const planInfo = await getPlanInfoByUserIdAsync(userId);
  const limits = getPlanLimits(planInfo.plan);
  return limits.historyLimit;
}

async function resolveFavoritesLimitByUser(userId) {
  const planInfo = await getPlanInfoByUserIdAsync(userId);
  const limits = getPlanLimits(planInfo.plan);
  return limits.favoritesLimit;
}

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

function normalizeHistoryResultPayload(resultData = {}) {
  const safe = resultData && typeof resultData === "object" ? resultData : {};
  return {
    ...safe,
    variants: Array.isArray(safe.variants) && safe.variants.length ? safe.variants : [safe],
    selectedVariant: Number.isFinite(Number(safe.selectedVariant)) ? Number(safe.selectedVariant) : 0
  };
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
  const historyLimit = toPositiveIntOrNull(options.limit) ?? await resolveHistoryListLimitByUser(userId);
  const supabase = createServerSupabaseClient();
  const localHistory = listHistoryByUser(userId, options);

  if (!supabase) {
    return applyServerLimit(localHistory, historyLimit);
  }

  const supabaseUserId = isUuid(userId) ? userId : await resolveSupabaseUserId(userId, supabase);
  if (!supabaseUserId) {
    return applyServerLimit(localHistory, historyLimit);
  }

  try {
    const [historyResult, favoritesResult] = await Promise.all([
      supabase.from("history_items").select("*").eq("user_id", supabaseUserId).order("created_at", { ascending: false }),
      supabase.from("favorites").select("history_item_id").eq("user_id", supabaseUserId)
    ]);

    if (!historyResult.error && historyResult.data) {
      const favoriteIds = (favoritesResult.data || []).map((item) => item.history_item_id).filter(Boolean);
      const normalized = decorateFavorites(historyResult.data.map(normalizeHistoryRecord), favoriteIds);
      return applyServerLimit(filterHistoryByType(normalized, options.type), historyLimit);
    }
  } catch {
    // noop
  }

  return applyServerLimit(localHistory, historyLimit);
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
  const normalizedResult = normalizeHistoryResultPayload(resultData);

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

function extractNormalizedHistoryRecord(item) {
  const normalized = normalizeHistoryRecord(item);
  return {
    ...normalized,
    result: normalizeHistoryResultPayload(normalized.result || {})
  };
}

export async function getHistoryItemByUserAsync(userId, historyId) {
  const normalizedHistoryId = String(historyId || "").trim();
  if (!normalizedHistoryId) return null;

  const supabase = createServerSupabaseClient();
  if (supabase) {
    const supabaseUserId = isUuid(userId) ? userId : await resolveSupabaseUserId(userId, supabase);
    if (supabaseUserId) {
      const { data } = await supabase
        .from("history_items")
        .select("*")
        .eq("user_id", supabaseUserId)
        .eq("id", normalizedHistoryId)
        .maybeSingle();

      if (data) {
        return normalizeHistoryRecord(data);
      }
    }
  }

  const localItem = filterHistoryByOwner(readJsonArray(paths.history), userId)
    .find((entry) => String(entry.id) === normalizedHistoryId);
  return localItem || null;
}

export async function ensureFavoriteAsync(userId, historyId) {
  const supabase = getSupabaseForFavoritesOrThrow();
  const supabaseUserId = await resolveSupabaseUserIdOrThrow(userId, supabase);

  const { error } = await supabase
    .from("favorites")
    .upsert({ user_id: supabaseUserId, history_item_id: historyId }, { onConflict: "user_id,history_item_id", ignoreDuplicates: true });

  if (error) {
    throw new Error(error.message || "Failed to save favorite in Supabase");
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

export async function updateHistoryItemOutputByUserAsync(userId, historyId, { title, resultData } = {}) {
  const normalizedHistoryId = String(historyId || "").trim();
  if (!normalizedHistoryId) throw new Error("historyId is required");

  const normalizedResult = normalizeHistoryResultPayload(resultData || {});
  const nextTitle = String(title || normalizedResult?.title || "").trim();

  const supabase = createServerSupabaseClient();
  if (supabase) {
    const supabaseUserId = isUuid(userId) ? userId : await resolveSupabaseUserId(userId, supabase);
    if (supabaseUserId) {
      const updatePayload = {
        result_data: normalizedResult,
        title: nextTitle || null
      };

      const { data, error } = await supabase
        .from("history_items")
        .update(updatePayload)
        .eq("id", normalizedHistoryId)
        .eq("user_id", supabaseUserId)
        .select("*")
        .maybeSingle();

      if (error) {
        throw new Error(error.message || "Failed to update history output in Supabase");
      }
      if (!data) {
        throw new Error("History item not found");
      }

      await ensureFavoriteAsync(userId, normalizedHistoryId);
      return {
        ...extractNormalizedHistoryRecord(data),
        isFavorite: true
      };
    }
  }

  const items = readJsonArray(paths.history);
  const index = items.findIndex((entry) => String(entry.id) === normalizedHistoryId && String(entry.userId) === String(userId));
  if (index === -1) {
    throw new Error("History item not found");
  }

  items[index] = {
    ...items[index],
    title: nextTitle || items[index].title,
    result: normalizedResult
  };

  const wrote = writeJsonArray(paths.history, items);
  if (!wrote) {
    throw new Error("Local history storage is read-only. Please configure Supabase for persistent history.");
  }

  try {
    ensureLocalFavorite(userId, normalizedHistoryId);
  } catch {
    // noop
  }

  return {
    ...items[index],
    isFavorite: true
  };
}

export async function createHistoryItemAsync({ userId, title, variantLabel, formData, resultData, images = [] }) {
  const historyLimit = userId
    ? getPlanLimits((await getPlanInfoByUserIdAsync(userId)).plan).historyLimit
    : null;

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
          if (historyLimit) {
            const { data: oldRows } = await supabase
              .from("history_items")
              .select("id,created_at")
              .eq("user_id", supabaseUserId)
              .order("created_at", { ascending: false })
              .range(historyLimit, historyLimit + 999);

            const staleIds = (oldRows || []).map((item) => item.id).filter(Boolean);
            if (staleIds.length) {
              await supabase.from("favorites").delete().eq("user_id", supabaseUserId).in("history_item_id", staleIds);
              await supabase.from("history_items").delete().eq("user_id", supabaseUserId).in("id", staleIds);
            }
          }
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

function ensureLocalFavorite(userId, historyId) {
  const users = readJsonArray(paths.users);
  const user = users.find((item) => item.id === userId);
  if (!user) throw new Error("User not found");
  user.favorites = Array.isArray(user.favorites) ? user.favorites : [];
  if (!user.favorites.includes(historyId)) {
    user.favorites.unshift(historyId);
  }
  const wrote = writeJsonArray(paths.users, users);
  if (!wrote) {
    throw new Error("Local favorite storage is read-only. Please configure Supabase for persistent favorites.");
  }
  return user.favorites;
}

export async function toggleFavoriteAsync(userId, historyId) {
  const favoriteLimit = await resolveFavoritesLimitByUser(userId);
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
    if (favoriteLimit) {
      const { count, error: countError } = await supabase
        .from("favorites")
        .select("id", { count: "exact", head: true })
        .eq("user_id", supabaseUserId);

      if (countError) {
        throw new Error(countError.message || "Failed to validate favorite limit");
      }

      if ((count || 0) >= favoriteLimit) {
        throw new Error(`Bạn đang dùng gói Free và chỉ lưu tối đa ${favoriteLimit} mục yêu thích. Vui lòng nâng cấp Pro.`);
      }
    }

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
  const favoritesLimit = toPositiveIntOrNull(options.limit) ?? await resolveFavoritesLimitByUser(userId);
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

  return applyServerLimit(filterHistoryByType(dedupeById(supaFavorites), options.type), favoritesLimit);
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
