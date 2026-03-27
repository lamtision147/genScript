"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";
import { useLocalDraft } from "@/hooks/use-local-draft";
import { apiGet, apiPost } from "@/lib/client/api";
import { filesToDataImages } from "@/lib/client/image-utils";
import { createEmptyProductForm, restoreProductFormFromHistoryItem, serializeAttributesText, serializeHighlightsText } from "@/lib/product-form-utils";
import { copyResultText, downloadResultDoc } from "@/lib/client/result-export";
import { routes } from "@/lib/routes";

const DRAFT_KEY = "seller-studio-next-product-draft";

export function useProductWorkspace({ initialHistoryId, samplePresets, subcategoryMap }) {
  const { session, setSession } = useAuthBootstrap();
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [form, setForm] = useState(createEmptyProductForm());

  useLocalDraft(DRAFT_KEY, form, setForm);

  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.id)), [favorites]);
  const currentSubcategories = subcategoryMap[form.category] || subcategoryMap.other;

  async function refreshUserData() {
    const [sessionRes, historyRes, favoritesRes] = await Promise.all([
      apiGet(routes.api.session, { user: null }),
      apiGet(routes.api.history, { items: [] }),
      apiGet(routes.api.favorites, { items: [] })
    ]);
    setSession(sessionRes.user || null);
    setHistory(historyRes.items || []);
    setFavorites(favoritesRes?.items || []);
  }

  useEffect(() => {
    refreshUserData();
  }, []);

  useEffect(() => {
    if (!initialHistoryId) return;
    apiGet(`${routes.api.history}/${initialHistoryId}`, null).then((data) => {
      if (data?.item) openHistoryItem(data.item);
    }).catch(() => {});
  }, [initialHistoryId]);

  async function handleGenerate(improved = false) {
    setLoading(true);
    setMessage("");
    try {
      const data = await apiPost(routes.api.generate, {
        ...form,
        attributes: serializeAttributesText(form.attributes),
        highlights: serializeHighlightsText(form.highlights),
        images: form.images,
        improved,
        previousResult: improved && result
          ? { paragraphs: result.paragraphs || [], hashtags: result.hashtags || [] }
          : null
      });
      setResult(data);
      setActiveHistoryId(data.historyId || null);
      await refreshUserData();
    } catch (error) {
      setMessage(error.message || "Không thể tạo nội dung lúc này.");
    } finally {
      setLoading(false);
      window.requestAnimationFrame(() => {
        document.querySelector(".content-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  }

  function applySample() {
    const preset = samplePresets[form.category] || samplePresets.fashion;
    setForm((prev) => ({ ...prev, ...preset, images: prev.images }));
  }

  function clearDraft() {
    setForm(createEmptyProductForm());
    setResult(null);
    setMessage("");
    setActiveHistoryId(null);
    try { window.localStorage.removeItem(DRAFT_KEY); } catch {}
  }

  function handleCategoryChange(nextCategory) {
    setForm((prev) => ({ ...prev, category: nextCategory, subcategory: 0 }));
  }

  function handleFieldChange(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openHistoryItem(item) {
    setResult(item.result || null);
    setActiveHistoryId(item.id || null);
    setForm(restoreProductFormFromHistoryItem(item));
    window.requestAnimationFrame(() => {
      document.querySelector(".content-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleImageSelect(event) {
    const nextImages = await filesToDataImages(event.target.files, 4);
    setForm((prev) => ({ ...prev, images: nextImages }));
  }

  function removeImage(imageId) {
    setForm((prev) => ({ ...prev, images: prev.images.filter((image) => image.id !== imageId) }));
  }

  async function copyResult() {
    await copyResultText(result);
  }

  function downloadDoc() {
    downloadResultDoc(result, form.productName);
  }

  async function toggleFavorite(historyId) {
    const exists = favoriteIds.has(historyId);
    if (exists) {
      setFavorites((prev) => prev.filter((item) => item.id !== historyId));
    } else {
      const historyItem = history.find((item) => item.id === historyId);
      if (historyItem) setFavorites((prev) => [historyItem, ...prev]);
    }
    await apiPost(routes.api.toggleFavorite, { historyId });
    await refreshUserData();
  }

  async function deleteHistory(historyId) {
    await apiPost(routes.api.deleteHistory, { historyId });
    await refreshUserData();
  }

  return {
    session,
    history,
    favorites,
    loading,
    result,
    message,
    activeHistoryId,
    form,
    favoriteIds,
    currentSubcategories,
    actions: {
      handleGenerate,
      applySample,
      clearDraft,
      handleCategoryChange,
      handleFieldChange,
      openHistoryItem,
      handleImageSelect,
      removeImage,
      copyResult,
      downloadDoc,
      toggleFavorite,
      deleteHistory
    }
  };
}
