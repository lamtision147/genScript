"use client";

import { useMemo, useState } from "react";
import { apiGet, apiPost } from "@/lib/client/api";
import { routes } from "@/lib/routes";
import { trackEvent } from "@/lib/client/telemetry";

function mapItemToScript(item) {
  const result = item?.result || {};
  return {
    id: item.id,
    createdAt: item.createdAt,
    title: item.title || result.title || "",
    variantLabel: item.variantLabel || "",
    form: item.form || {},
    result: {
      title: result.title || "",
      hook: result.hook || "",
      scenes: Array.isArray(result.scenes) ? result.scenes : [],
      cta: result.cta || "",
      hashtags: Array.isArray(result.hashtags) ? result.hashtags : [],
      shotList: Array.isArray(result.shotList) ? result.shotList : [],
      source: result.source || "fallback"
    },
    isFavorite: Boolean(item?.isFavorite)
  };
}

export function useVideoScriptHistory({ onError } = {}) {
  const [history, setHistory] = useState([]);
  const [favoriteIds, setFavoriteIds] = useState(new Set());
  const [activeHistoryId, setActiveHistoryId] = useState(null);

  const mergedFavoriteIds = useMemo(() => {
    const historyIds = history.filter((item) => item.isFavorite).map((item) => item.id);
    return new Set([...favoriteIds, ...historyIds]);
  }, [favoriteIds, history]);

  async function refresh() {
    const [historyRes, favoritesRes] = await Promise.all([
      apiGet(`${routes.api.history}?type=video_script&limit=200`, { items: [] }),
      apiGet(`${routes.api.favorites}?type=video_script&limit=200`, { items: [] })
    ]);

    const historyItems = Array.isArray(historyRes?.items) ? historyRes.items.map(mapItemToScript) : [];
    const favoriteItems = Array.isArray(favoritesRes?.items) ? favoritesRes.items.map(mapItemToScript) : [];

    setHistory(historyItems);
    setFavoriteIds(new Set(favoriteItems.map((item) => item.id)));
  }

  async function toggleFavorite(historyId) {
    try {
      await apiPost(routes.api.toggleFavorite, { historyId });
      await refresh();
      trackEvent("favorite.toggle", { historyId, type: "video_script" });
    } catch (error) {
      if (typeof onError === "function") {
        onError(error);
      }
    }
  }

  async function deleteHistory(historyId) {
    await apiPost(routes.api.deleteHistory, { historyId });
    await refresh();
    trackEvent("history.delete", { historyId, type: "video_script" });
  }

  return {
    history,
    favoriteIds: mergedFavoriteIds,
    activeHistoryId,
    setActiveHistoryId,
    actions: {
      refresh,
      toggleFavorite,
      deleteHistory
    }
  };
}
