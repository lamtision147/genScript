"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";
import { apiGet, apiPost } from "@/lib/client/api";
import { getCopy, localizeKnownMessage } from "@/lib/i18n";

const DEFAULT_FAVORITES_BY_TYPE = {
  product_copy: [],
  video_script: []
};

function sortByCreatedAtDesc(items = []) {
  return [...items].sort((left, right) => {
    const leftTime = new Date(left?.createdAt || 0).getTime();
    const rightTime = new Date(right?.createdAt || 0).getTime();
    return rightTime - leftTime;
  });
}

export function useProfileWorkspace(language = "vi") {
  const { session, setSession } = useAuthBootstrap();
  const copy = getCopy(language);
  const [favoritesByType, setFavoritesByType] = useState(DEFAULT_FAVORITES_BY_TYPE);
  const [activeFavoriteTab, setActiveFavoriteTab] = useState("product_copy");
  const [form, setForm] = useState({ currentPassword: "", newPassword: "" });
  const [message, setMessage] = useState("");

  const favorites = useMemo(
    () => sortByCreatedAtDesc([
      ...(favoritesByType.product_copy || []),
      ...(favoritesByType.video_script || [])
    ]),
    [favoritesByType]
  );

  const activeFavorites = useMemo(() => {
    if (activeFavoriteTab === "video_script") {
      return favoritesByType.video_script || [];
    }
    return favoritesByType.product_copy || [];
  }, [activeFavoriteTab, favoritesByType]);

  async function loadFavorites() {
    const sessionData = await apiGet("/api/session", { user: null });
    setSession(sessionData.user || null);
    if (!sessionData.user) {
      setFavoritesByType(DEFAULT_FAVORITES_BY_TYPE);
      setActiveFavoriteTab("product_copy");
      return;
    }

    const [productData, videoData] = await Promise.all([
      apiGet("/api/favorites?type=product_copy", { items: [] }),
      apiGet("/api/favorites?type=video_script", { items: [] })
    ]);

    const nextFavoritesByType = {
      product_copy: sortByCreatedAtDesc(productData.items || []),
      video_script: sortByCreatedAtDesc(videoData.items || [])
    };

    setFavoritesByType(nextFavoritesByType);
    setActiveFavoriteTab((prev) => {
      if (prev === "video_script" && !nextFavoritesByType.video_script.length && nextFavoritesByType.product_copy.length) {
        return "product_copy";
      }
      if (prev === "product_copy" && !nextFavoritesByType.product_copy.length && nextFavoritesByType.video_script.length) {
        return "video_script";
      }
      return prev;
    });
  }

  useEffect(() => {
    loadFavorites();
  }, []);

  async function toggleFavorite(historyId) {
    await apiPost("/api/favorites/toggle", { historyId });
    await loadFavorites();
  }

  async function changePassword() {
    try {
      await apiPost("/api/auth/change-password", form);
      setMessage(copy.messages.changePasswordSuccess);
    } catch (error) {
      const raw = error.message || copy.messages.changePasswordError;
      setMessage(localizeKnownMessage(raw, copy) || raw);
    }
  }

  return {
    session,
    favorites,
    favoritesByType,
    activeFavoriteTab,
    activeFavorites,
    form,
    message,
    actions: {
      loadFavorites,
      toggleFavorite,
      changePassword,
      setActiveFavoriteTab,
      setForm,
      setMessage
    }
  };
}
