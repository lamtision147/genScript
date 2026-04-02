"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";
import { apiGet, apiPost } from "@/lib/client/api";
import { filesToDataImages } from "@/lib/client/image-utils";
import { createEmptyProductForm, getAdvancedFieldGroup, restoreProductFormFromHistoryItem, serializeAttributesText, serializeHighlightsText } from "@/lib/product-form-utils";
import { copyResultText, downloadResultDoc } from "@/lib/client/result-export";
import { routes } from "@/lib/routes";
import { getCopy, localizeKnownMessage, toAiLang } from "@/lib/i18n";
import { trackEvent } from "@/lib/client/telemetry";
import { getProductIndustryPresets } from "@/lib/product-industry-templates";
import { getCategoryGroupValue, getCategoryValuesByGroup, getMarketplaceDefaults } from "@/lib/category-marketplace-presets";
import {
  buildCategoryFallbackProductName,
  inferCategoryFromProductName,
  isUnknownGeneratedProductName,
  normalizeSuggestedCategory,
  shouldPreferInferredCategory
} from "@/lib/category-inference";
import {
  applyIndustryPresetToForm,
  enforceGroupScopedCategory,
  resolveSuggestedIndustryPresetValue,
  resolveSuggestedSubcategoryIndex,
  shouldRequireVisionName
} from "@/lib/product-workspace-helpers";

const DRAFT_KEY = "seller-studio-next-product-draft";
const MAX_IMAGE_COUNT = 4;
const ONBOARDING_STATE_KEY = "seller-studio-onboarding-state";
const MULTI_STYLE_SEQUENCE = ["balanced", "expert", "sales", "lifestyle"];

function inferStylePresetFromFields(source = {}) {
  const tone = Number(source?.tone);
  const brandStyle = Number(source?.brandStyle);
  const mood = Number(source?.mood);

  if (tone === 1 && brandStyle === 2 && mood === 3) return "expert";
  if (tone === 2 && brandStyle === 1 && mood === 3) return "sales";
  if (tone === 0 && brandStyle === 1 && mood === 1) return "lifestyle";
  if (tone === 0 && brandStyle === 0 && mood === 0) return "balanced";
  return "custom";
}

function normalizeStylePresetKey(value, fallback = "balanced") {
  const normalized = String(value || "").trim().toLowerCase();
  if (["balanced", "expert", "sales", "lifestyle", "custom"].includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function isSameStylePresetList(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  if (left.length !== right.length) return false;
  for (let index = 0; index < left.length; index += 1) {
    if (String(left[index] || "") !== String(right[index] || "")) return false;
  }
  return true;
}

function buildVariantStylePresetList(count = 1, seedPreset = "balanced", existing = []) {
  const size = Math.max(1, Math.min(5, Number(count) || 1));
  const normalizedSeed = normalizeStylePresetKey(seedPreset, "balanced");
  const firstStyle = MULTI_STYLE_SEQUENCE.includes(normalizedSeed) ? normalizedSeed : "balanced";
  const rotation = [firstStyle, ...MULTI_STYLE_SEQUENCE.filter((item) => item !== firstStyle)];
  const next = [];

  for (let index = 0; index < size; index += 1) {
    const preset = normalizeStylePresetKey(existing?.[index], "");
    if (size > 1) {
      if (MULTI_STYLE_SEQUENCE.includes(preset)) {
        next.push(preset);
        continue;
      }
      next.push(rotation[index % rotation.length] || "balanced");
      continue;
    }

    if (preset === "custom") {
      next.push("custom");
      continue;
    }

    next.push(normalizedSeed);
  }

  return next;
}

function bytesToReadableMB(bytes = 0) {
  const value = Number(bytes || 0) / (1024 * 1024);
  return Number.isFinite(value) ? value.toFixed(1) : "0.0";
}

function buildRejectedUploadMessage(rejected = [], language = "vi") {
  if (!Array.isArray(rejected) || !rejected.length) return "";

  const first = rejected[0] || {};
  const fileName = String(first.name || "file");
  const readableSize = bytesToReadableMB(first.size || 0);
  const reason = String(first.reason || "");

  if (language === "vi") {
    if (reason === "file_too_large") {
      return `Ảnh ${fileName} (${readableSize}MB) vượt quá giới hạn 8MB, vui lòng chọn ảnh nhỏ hơn.`;
    }
    if (reason === "payload_too_large") {
      return `Ảnh ${fileName} quá nặng sau khi xử lý, vui lòng dùng ảnh dưới 8MB hoặc giảm độ phân giải.`;
    }
    if (reason === "unsupported_type" || reason === "unsupported_after_normalize") {
      return `Định dạng ảnh ${fileName} chưa hỗ trợ. Vui lòng dùng PNG, JPG, JPEG, WEBP, AVIF, HEIC hoặc HEIF.`;
    }
    if (reason === "read_failed" || reason === "normalize_failed") {
      return `Không thể đọc ảnh ${fileName}. Vui lòng thử lại với ảnh khác.`;
    }
    return `Có ${rejected.length} ảnh không hợp lệ và đã bị bỏ qua.`;
  }

  if (reason === "file_too_large") {
    return `Image ${fileName} (${readableSize}MB) exceeds 8MB limit. Please choose a smaller file.`;
  }
  if (reason === "payload_too_large") {
    return `Image ${fileName} is still too large after processing. Please use a lower-resolution file.`;
  }
  if (reason === "unsupported_type" || reason === "unsupported_after_normalize") {
    return `Unsupported image format for ${fileName}. Please use PNG, JPG, JPEG, WEBP, AVIF, HEIC or HEIF.`;
  }
  if (reason === "read_failed" || reason === "normalize_failed") {
    return `Could not read ${fileName}. Please try another image.`;
  }
  return `${rejected.length} invalid image(s) were skipped.`;
}

function getOnboardingState() {
  if (typeof window === "undefined") return { seen: false, dismissed: false, quickstartUsed: false };
  try {
    const raw = window.localStorage.getItem(ONBOARDING_STATE_KEY);
    if (!raw) return { seen: false, dismissed: false, quickstartUsed: false };
    const parsed = JSON.parse(raw);
    return {
      seen: Boolean(parsed?.seen),
      dismissed: Boolean(parsed?.dismissed),
      quickstartUsed: Boolean(parsed?.quickstartUsed)
    };
  } catch {
    return { seen: false, dismissed: false, quickstartUsed: false };
  }
}

function saveOnboardingState(nextState) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_STATE_KEY, JSON.stringify({
      seen: Boolean(nextState?.seen),
      dismissed: Boolean(nextState?.dismissed),
      quickstartUsed: Boolean(nextState?.quickstartUsed)
    }));
  } catch {
    // noop
  }
}

export function useProductWorkspace({ initialHistoryId, samplePresets, language = "vi" }) {
  const { session, setSession } = useAuthBootstrap();
  const copy = getCopy(language);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [message, setMessage] = useState("");
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [selectedVariant, setSelectedVariant] = useState(0);
  const [suggestion, setSuggestion] = useState(null);
  const [suggestionPulseToken, setSuggestionPulseToken] = useState(0);
  const [suggesting, setSuggesting] = useState(false);
  const [form, setForm] = useState(() => {
    const base = createEmptyProductForm();
    const defaults = getMarketplaceDefaults(base.category, base.channel);
    return enforceGroupScopedCategory({ ...base, ...defaults }, "fashionBeauty");
  });
  const [brandPreset, setBrandPreset] = useState("minimalist");
  const [variantCount, setVariantCountState] = useState(1);
  const [variantStylePresets, setVariantStylePresets] = useState(["balanced"]);
  const [industrySearchKeyword, setIndustrySearchKeyword] = useState("");
  const [categoryGroupFilter, setCategoryGroupFilter] = useState("fashionBeauty");
  const [onboardingState, setOnboardingState] = useState(() => getOnboardingState());
  const [generateQuota, setGenerateQuota] = useState(null);

  const isProPlan = String(session?.plan || "free") === "pro";
  const inferredStylePresetFromForm = useMemo(
    () => normalizeStylePresetKey(inferStylePresetFromFields(form), "balanced"),
    [form?.tone, form?.brandStyle, form?.mood]
  );

  function setVariantCount(nextValue) {
    const parsed = Number(nextValue);
    if (!Number.isFinite(parsed)) {
      setVariantCountState(1);
      return;
    }
    const clamped = Math.max(1, Math.min(5, Math.floor(parsed)));
    setVariantCountState(isProPlan ? clamped : 1);
  }

  function setVariantStylePresetAt(index, nextPreset) {
    const targetIndex = Math.max(0, Math.floor(Number(index) || 0));
    const targetCount = isProPlan ? variantCount : 1;
    const normalizedPreset = normalizeStylePresetKey(nextPreset, "balanced");

    setVariantStylePresets((prev) => {
      const inferred = normalizeStylePresetKey(inferStylePresetFromFields(form), "balanced");
      const seed = normalizeStylePresetKey(prev?.[0], inferred);
      const next = buildVariantStylePresetList(targetCount, seed, prev);
      next[targetIndex] = normalizedPreset;
      return next;
    });

    if (targetIndex === 0 && normalizedPreset !== "custom") {
      setForm((prev) => {
        const mapped = resolveStyleFieldsByPreset(normalizedPreset, prev);
        return {
          ...prev,
          tone: mapped.tone,
          brandStyle: mapped.brandStyle,
          mood: mapped.mood
        };
      });
    }
  }

  const industryPresets = useMemo(
    () => getProductIndustryPresets(form?.category),
    [form?.category]
  );

  const filteredIndustryPresets = useMemo(() => {
    const keyword = String(industrySearchKeyword || "").trim().toLowerCase();
    if (!keyword) return industryPresets;
    const next = industryPresets.filter((item) => {
      const haystack = [item.label, item.targetCustomer, item.shortDescription, item.highlights]
        .join(" ")
        .toLowerCase();
      return haystack.includes(keyword);
    });
    return next.length ? next : industryPresets;
  }, [industrySearchKeyword, industryPresets]);

  const selectedIndustryPreset = useMemo(() => {
    if (!industryPresets.length) return null;
    return industryPresets.find((item) => item.value === form.industryPreset) || industryPresets[0];
  }, [industryPresets, form.industryPreset]);

  useEffect(() => {
    const expectedGroup = getCategoryGroupValue(form.category);
    if (expectedGroup === categoryGroupFilter) return;
    setCategoryGroupFilter(expectedGroup);
  }, [form.category, categoryGroupFilter]);

  useEffect(() => {
    const allowed = getCategoryValuesByGroup(categoryGroupFilter);
    if (allowed.includes(form.category)) {
      return;
    }
    handleCategoryChange(allowed[0] || "other");
  }, [categoryGroupFilter]);

  const advancedFieldGroup = useMemo(
    () => getAdvancedFieldGroup(form?.category),
    [form?.category]
  );

  useEffect(() => {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // noop
    }
  }, []);

  const favoriteIds = useMemo(() => new Set(favorites.map((item) => item.id)), [favorites]);
  const historyFavoriteIds = useMemo(
    () => new Set((history || []).filter((item) => item?.isFavorite).map((item) => item.id)),
    [history]
  );
  const mergedFavoriteIds = useMemo(
    () => new Set([...favoriteIds, ...historyFavoriteIds]),
    [favoriteIds, historyFavoriteIds]
  );

  async function refreshUserData() {
    const [sessionRes, historyRes, favoritesRes] = await Promise.all([
      apiGet(routes.api.session, { user: null }),
      apiGet(`${routes.api.history}?type=product_copy&limit=200`, { items: [] }),
      apiGet(`${routes.api.favorites}?type=product_copy&limit=200`, { items: [] })
    ]);
    setSession(sessionRes.user || null);
    setGenerateQuota(sessionRes?.user?.generateQuota || null);
    setHistory(historyRes.items || []);
    setFavorites(favoritesRes?.items || []);
  }

  function resolveStylePresetFromForm(nextForm = form) {
    return inferStylePresetFromFields(nextForm);
  }

  function resolveStyleFieldsByPreset(stylePreset = "balanced", fallbackForm = form) {
    const normalized = String(stylePreset || "balanced").trim().toLowerCase();
    if (normalized === "expert") {
      return { tone: 1, brandStyle: 2, mood: 3 };
    }
    if (normalized === "sales") {
      return { tone: 2, brandStyle: 1, mood: 3 };
    }
    if (normalized === "lifestyle") {
      return { tone: 0, brandStyle: 1, mood: 1 };
    }
    if (normalized === "balanced") {
      return { tone: 0, brandStyle: 0, mood: 0 };
    }

    return {
      tone: Number.isFinite(Number(fallbackForm?.tone)) ? Number(fallbackForm.tone) : 0,
      brandStyle: Number.isFinite(Number(fallbackForm?.brandStyle)) ? Number(fallbackForm.brandStyle) : 0,
      mood: Number.isFinite(Number(fallbackForm?.mood)) ? Number(fallbackForm.mood) : 0
    };
  }

  function buildLocalVariantStyleLabel(variant = {}, index = 0) {
    const stylePreset = String(variant?.stylePreset || resolveStylePresetFromForm(variant?.formData || form)).toLowerCase();
    if (stylePreset === "expert") return language === "vi" ? "Chuyên gia" : "Expert";
    if (stylePreset === "sales") return language === "vi" ? "Chốt sale" : "Sales";
    if (stylePreset === "lifestyle") return language === "vi" ? "Lifestyle" : "Lifestyle";
    if (stylePreset === "balanced") return language === "vi" ? "Cân bằng" : "Balanced";
    return language === "vi" ? `Biến thể ${index + 1}` : `Variant ${index + 1}`;
  }

  async function hydrateVariantGroup(groupId, preferredHistoryId = "") {
    const variantGroupId = String(groupId || "").trim();
    if (!variantGroupId) return null;

    const data = await apiGet(`${routes.api.history}?type=product_copy&variantGroupId=${encodeURIComponent(variantGroupId)}&limit=200`, { items: [] });
    const groupItems = Array.isArray(data?.items)
      ? [...data.items].sort((left, right) => {
        const leftIndex = Number(left?.result?.variantIndex);
        const rightIndex = Number(right?.result?.variantIndex);
        if (Number.isFinite(leftIndex) && Number.isFinite(rightIndex)) {
          return leftIndex - rightIndex;
        }
        return String(left?.createdAt || "").localeCompare(String(right?.createdAt || ""));
      })
      : [];
    if (!groupItems.length) return null;

    const variants = groupItems
      .map((entry, index) => ({
        ...(entry?.result || {}),
        historyId: entry?.id || null,
        title: entry?.title || entry?.result?.title || "",
        variantStyleLabel: entry?.result?.variantStyleLabel || entry?.variantLabel || buildLocalVariantStyleLabel(entry?.result, index),
        stylePreset: entry?.result?.stylePreset || resolveStylePresetFromForm(entry?.form)
      }))
      .filter(Boolean);

    if (!variants.length) return null;

    const selectedIndex = Math.max(0, groupItems.findIndex((entry) => String(entry.id) === String(preferredHistoryId)));
    const selectedVariant = variants[selectedIndex] || variants[0];

    return {
      ...selectedVariant,
      variants,
      selectedVariant: selectedIndex,
      historyId: preferredHistoryId || selectedVariant?.historyId || null,
      title: selectedVariant?.title || "",
      variantLabel: groupItems[selectedIndex]?.variantLabel || selectedVariant?.variantStyleLabel || "",
      variantGroupId
    };
  }

  useEffect(() => {
    refreshUserData();
  }, []);

  useEffect(() => {
    if (!initialHistoryId) return;
    apiGet(`${routes.api.history}/${initialHistoryId}`).then((data) => {
      if (data?.item) openHistoryItem(data.item);
    }).catch(() => {});
  }, [initialHistoryId]);

  useEffect(() => {
    if (!isProPlan && variantCount !== 1) {
      setVariantCountState(1);
    }
  }, [isProPlan, variantCount]);

  useEffect(() => {
    const targetCount = isProPlan ? variantCount : 1;
    if (targetCount === 1) {
      const singlePreset = normalizeStylePresetKey(inferredStylePresetFromForm, "balanced");
      if (!isSameStylePresetList(variantStylePresets, [singlePreset])) {
        setVariantStylePresets([singlePreset]);
      }
      return;
    }

    const seedPreset = normalizeStylePresetKey(variantStylePresets?.[0], inferredStylePresetFromForm);
    const normalized = buildVariantStylePresetList(targetCount, seedPreset, variantStylePresets);
    if (!isSameStylePresetList(normalized, variantStylePresets)) {
      setVariantStylePresets(normalized);
    }
  }, [isProPlan, variantCount, inferredStylePresetFromForm]);

  useEffect(() => {
    if (!industryPresets.length) return;
    const exists = industryPresets.some((item) => item.value === form.industryPreset);
    if (exists) return;
    setForm((prev) => ({ ...prev, industryPreset: industryPresets[0].value }));
  }, [industryPresets, form.industryPreset]);

  useEffect(() => {
    trackEvent("workspace.open", { page: "scriptProductInfo", lang: language });

    if (!onboardingState.seen) {
      const nextState = { ...onboardingState, seen: true };
      setOnboardingState(nextState);
      saveOnboardingState(nextState);
      trackEvent("onboarding.viewed", { page: "scriptProductInfo" });
    }
  }, [language]);

  async function handleGenerate(improved = false) {
    window.requestAnimationFrame(() => {
      document.querySelector(".content-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    setLoading(true);
    setMessage("");
    trackEvent("generate.submit", {
      category: form.category,
      hasImages: Array.isArray(form.images) && form.images.length > 0,
      improved,
      page: "scriptProductInfo"
    });
    try {
      const stylePresetFromForm = resolveStylePresetFromForm();
      const stylePresetFromResult = String(result?.stylePreset || "").trim().toLowerCase();
      const stylePresetForRequest = improved
        ? (stylePresetFromResult || stylePresetFromForm)
        : stylePresetFromForm;
      const styleFields = resolveStyleFieldsByPreset(stylePresetForRequest, form);

      const data = await apiPost(routes.api.generate, {
        ...form,
        tone: styleFields.tone,
        brandStyle: styleFields.brandStyle,
        mood: styleFields.mood,
        lang: toAiLang(language),
        attributes: serializeAttributesText(form.attributes),
        highlights: serializeHighlightsText(form.highlights),
        images: form.images,
        usage: form.usage || "",
        skinConcern: form.skinConcern || "",
        routineStep: form.routineStep || "",
        dimensions: form.dimensions || "",
        warranty: form.warranty || "",
        usageSpace: form.usageSpace || "",
        specs: form.specs || "",
        compatibility: form.compatibility || "",
        sizeGuide: form.sizeGuide || "",
        careGuide: form.careGuide || "",
        exchangePolicy: form.exchangePolicy || "",
        brandPreset,
        variantCount: improved ? 1 : (isProPlan ? variantCount : 1),
        stylePreset: stylePresetForRequest,
        variantStylePresets: improved
          ? [stylePresetForRequest]
          : (isProPlan ? buildVariantStylePresetList(variantCount, stylePresetForRequest, variantStylePresets) : [stylePresetForRequest]),
        improved,
        previousResult: improved && result
          ? {
              paragraphs: result.paragraphs || [],
              hashtags: result.hashtags || [],
              variantIndex: Number.isFinite(Number(result?.variantIndex)) ? Number(result.variantIndex) : Number(selectedVariant || 0),
              variantGroupId: result?.variantGroupId || "",
              variantStyleLabel: result?.variantStyleLabel || "",
              stylePreset: result?.stylePreset || resolveStylePresetFromForm()
            }
          : null
      });
      const normalizedResult = {
        ...data,
        variants: Array.isArray(data.variants) && data.variants.length ? data.variants : [data],
        selectedVariant: data.selectedVariant ?? 0,
        variantGroupId: data?.variantGroupId || result?.variantGroupId || ""
      };

      const hydratedFromGroup = await hydrateVariantGroup(normalizedResult.variantGroupId, data?.historyId || activeHistoryId || "");
      if (hydratedFromGroup) {
        setResult(hydratedFromGroup);
        setSelectedVariant(hydratedFromGroup.selectedVariant || 0);
        setActiveHistoryId(hydratedFromGroup.historyId || data?.historyId || null);
      } else {
        setResult(normalizedResult);
        setSelectedVariant(normalizedResult.selectedVariant);
        setActiveHistoryId(data.historyId || null);
      }

      await refreshUserData();
      trackEvent("generate.success", {
        category: form.category,
        source: normalizedResult.source,
        quality: normalizedResult?.quality?.score ?? null,
        variantCount: normalizedResult?.variants?.length || 1,
        selectedVariant: normalizedResult?.selectedVariant ?? 0,
        promptVersion: normalizedResult?.promptVersion || null
      });
    } catch (error) {
      const raw = error.message || copy.messages.generateError;
      setMessage(localizeKnownMessage(raw, copy) || raw);
      await refreshUserData();
      trackEvent("generate.failed", { error: raw, category: form.category });
    } finally {
      setLoading(false);
    }
  }

  function applySample() {
    const preset = samplePresets[form.category] || samplePresets.fashion;
    setForm((prev) => ({ ...createEmptyProductForm(), ...preset, images: prev.images }));
    setVariantStylePresets([normalizeStylePresetKey(inferStylePresetFromFields(preset), "balanced")]);
    const nextState = { ...onboardingState, quickstartUsed: true };
    setOnboardingState(nextState);
    saveOnboardingState(nextState);
    trackEvent("onboarding.quickstart", {
      page: "scriptProductInfo",
      source: "sample"
    });
  }

  function applyIndustryPreset() {
    if (!selectedIndustryPreset) return;
    setForm((prev) => applyIndustryPresetToForm(prev, selectedIndustryPreset));
    trackEvent("industry.template.apply", { page: "scriptProductInfo", preset: selectedIndustryPreset.value, category: form.category });
  }

  function clearDraft() {
    const base = createEmptyProductForm();
    const defaults = getMarketplaceDefaults(base.category, base.channel);
    setForm(enforceGroupScopedCategory({ ...base, ...defaults }, "fashionBeauty"));
    setResult(null);
    setSuggestion(null);
    setSelectedVariant(0);
    setBrandPreset("minimalist");
    setVariantCountState(1);
    setVariantStylePresets([normalizeStylePresetKey(inferStylePresetFromFields({ ...base, ...defaults }), "balanced")]);
    setCategoryGroupFilter("fashionBeauty");
    setMessage("");
    setActiveHistoryId(null);
    try { window.localStorage.removeItem(DRAFT_KEY); } catch {}
  }

  function handleCategoryChange(nextCategory) {
    const defaults = getMarketplaceDefaults(nextCategory);
    const advancedReset = {
      usage: "",
      skinConcern: "",
      routineStep: "",
      dimensions: "",
      warranty: "",
      usageSpace: "",
      specs: "",
      compatibility: "",
      sizeGuide: "",
      careGuide: "",
      exchangePolicy: ""
    };
    setForm((prev) => ({
      ...prev,
      category: nextCategory,
      subcategory: 0,
      channel: defaults.channel,
      tone: defaults.tone,
      brandStyle: defaults.brandStyle,
      mood: defaults.mood,
      industryPreset: getProductIndustryPresets(nextCategory)?.[0]?.value || "",
      ...advancedReset
    }));
    trackEvent("category.change", {
      category: nextCategory,
      defaultsApplied: true,
      channel: defaults.channel,
      tone: defaults.tone,
      brandStyle: defaults.brandStyle,
      mood: defaults.mood
    });
    setIndustrySearchKeyword("");
  }

  function handleCategoryGroupFilterChange(nextGroup) {
    const allowed = getCategoryValuesByGroup(nextGroup);
    const nextCategory = allowed.includes(form.category) ? form.category : allowed[0] || "other";

    setCategoryGroupFilter(nextGroup);
    handleCategoryChange(nextCategory);
  }

  function handleFieldChange(key, value) {
    if (key === "industryPreset") {
      const preset = industryPresets.find((item) => item.value === value) || null;
      setForm((prev) => applyIndustryPresetToForm(prev, preset || { value }));
      trackEvent("industry.template.select", {
        page: "scriptProductInfo",
        category: form.category,
        preset: value
      });
      return;
    }
    if (key === "channel") {
      const defaults = getMarketplaceDefaults(form.category, value);
      setForm((prev) => ({
        ...prev,
        channel: defaults.channel,
        tone: defaults.tone,
        brandStyle: defaults.brandStyle,
        mood: defaults.mood
      }));
      trackEvent("channel.change", {
        category: form.category,
        channel: defaults.channel,
        defaultsApplied: true
      });
      return;
    }
    if (key === "category") {
      handleCategoryChange(value);
      return;
    }
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (["tone", "brandStyle", "mood"].includes(key)) {
        const inferred = normalizeStylePresetKey(inferStylePresetFromFields(next), "balanced");
        setVariantStylePresets((prevStyles) => {
          if (!Array.isArray(prevStyles) || !prevStyles.length) return [inferred];
          const updated = [...prevStyles];
          updated[0] = inferred;
          return updated;
        });
      }
      return next;
    });
  }

  function openHistoryItem(item) {
    const nextResult = item.result ? {
      ...item.result,
      variants: Array.isArray(item.result.variants) && item.result.variants.length ? item.result.variants : [item.result],
      selectedVariant: Number.isFinite(Number(item.result.selectedVariant)) ? Number(item.result.selectedVariant) : 0,
      historyId: item.id,
      title: item.title,
      variantLabel: item.variantLabel,
      variantGroupId: item?.form?.variantGroupId || ""
    } : null;
    setResult(nextResult);
    setSelectedVariant(nextResult?.selectedVariant ?? 0);
    setActiveHistoryId(item.id || null);
    setForm(restoreProductFormFromHistoryItem(item));
    const stylesFromResult = Array.isArray(item?.result?.variants) && item.result.variants.length
      ? item.result.variants.map((variant) => normalizeStylePresetKey(variant?.stylePreset, "balanced"))
      : [normalizeStylePresetKey(item?.result?.stylePreset || inferStylePresetFromFields(item?.form || {}), "balanced")];
    setVariantStylePresets(stylesFromResult);

    const variantGroupId = String(item?.form?.variantGroupId || "").trim();
    if (variantGroupId) {
      hydrateVariantGroup(variantGroupId, item?.id)
        .then((hydrated) => {
          if (!hydrated) return;
          setResult(hydrated);
          setSelectedVariant(hydrated.selectedVariant || 0);
        })
        .catch(() => {});
    }

    trackEvent("history.open", { historyId: item.id, source: item?.result?.source || null });
    window.requestAnimationFrame(() => {
      document.querySelector(".content-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function handleImageSelect(event) {
    const currentImages = Array.isArray(form.images) ? form.images : [];
    const availableSlots = Math.max(0, MAX_IMAGE_COUNT - currentImages.length);
    const uploadResult = await filesToDataImages(event.target.files, availableSlots || MAX_IMAGE_COUNT);
    const newImages = Array.isArray(uploadResult?.images) ? uploadResult.images : [];
    const rejected = Array.isArray(uploadResult?.rejected) ? uploadResult.rejected : [];
    const nextImages = [...currentImages, ...newImages].slice(0, MAX_IMAGE_COUNT);

    setForm((prev) => ({ ...prev, images: nextImages }));
    setSuggestion(null);
    trackEvent("image.upload", { count: nextImages.length, added: newImages.length });

    if (rejected.length) {
      const rejectedMessage = buildRejectedUploadMessage(rejected, language);
      if (rejectedMessage) {
        setMessage(rejectedMessage);
      }
      trackEvent("image.upload.rejected", {
        rejected: rejected.length,
        reason: rejected[0]?.reason || "unknown"
      });
    } else {
      setMessage("");
    }

    if (nextImages.length) {
      await suggestFromImagesInternal(nextImages, "auto");
    }

    if (event?.target) {
      event.target.value = "";
    }
  }

  function removeImage(imageId) {
    setForm((prev) => ({ ...prev, images: prev.images.filter((image) => image.id !== imageId) }));
  }

  async function copyResult() {
    await copyResultText(result);
    trackEvent("result.copy", { source: result?.source || null, quality: result?.quality?.score ?? null });
  }

  function downloadDoc() {
    downloadResultDoc(result, form.productName);
    trackEvent("result.download", { hasResult: Boolean(result), source: result?.source || null });
  }

  async function toggleFavorite(historyId) {
    const exists = favoriteIds.has(historyId);
    try {
      if (exists) {
        setFavorites((prev) => prev.filter((item) => item.id !== historyId));
      } else {
        const historyItem = history.find((item) => item.id === historyId);
        if (historyItem) setFavorites((prev) => [historyItem, ...prev]);
      }
      await apiPost(routes.api.toggleFavorite, { historyId });
      await refreshUserData();
      trackEvent("favorite.toggle", { historyId, nextState: !exists });
    } catch (error) {
      await refreshUserData();
      const raw = error?.message || copy.messages.genericError;
      setMessage(localizeKnownMessage(raw, copy) || raw);
    }
  }

  async function saveEditedResult(nextResult) {
    if (!activeHistoryId) {
      throw new Error(language === "vi" ? "Vui lòng chọn một bản trong lịch sử trước khi lưu chỉnh sửa." : "Please open a history item before saving edits.");
    }

    const payload = {
      historyId: activeHistoryId,
      contentType: "product_copy",
      title: form.productName || result?.title || "Product content",
      result: {
        ...nextResult,
        paragraphs: Array.isArray(nextResult?.paragraphs)
          ? nextResult.paragraphs.map((item) => String(item || "").trim()).filter(Boolean)
          : [],
        hashtags: Array.isArray(nextResult?.hashtags)
          ? nextResult.hashtags.map((item) => String(item || "").trim()).filter(Boolean)
          : [],
        selectedVariant: Number.isFinite(Number(nextResult?.selectedVariant)) ? Number(nextResult.selectedVariant) : 0,
        variants: Array.isArray(nextResult?.variants) && nextResult.variants.length ? nextResult.variants : [nextResult],
        variantStyleLabel: nextResult?.variantStyleLabel || buildLocalVariantStyleLabel(nextResult, Number(nextResult?.selectedVariant || 0)),
        stylePreset: nextResult?.stylePreset || resolveStylePresetFromForm()
      }
    };

    const data = await apiPost(routes.api.saveHistoryOutput, payload);
    const updatedItem = data?.item;
    if (!updatedItem) {
      throw new Error(language === "vi" ? "Không thể lưu chỉnh sửa lúc này." : "Unable to save edits right now.");
    }

    openHistoryItem(updatedItem);
    await refreshUserData();
    trackEvent("output.save", {
      page: "scriptProductInfo",
      historyId: activeHistoryId,
      contentType: "product_copy"
    });
  }

  async function deleteHistory(historyId) {
    await apiPost(routes.api.deleteHistory, { historyId });
    await refreshUserData();
    trackEvent("history.delete", { historyId });
  }

  async function suggestFromImagesInternal(imageSet, mode = "manual") {
    const images = Array.isArray(imageSet) ? imageSet : [];
    if (!images.length) return;
    setSuggesting(true);
    try {
      const data = await apiPost(routes.api.suggestFromImages, {
        images,
        productName: form.productName,
        lang: toAiLang(language)
      });

      const suggested = data.suggestion || null;
      setSuggestion(suggested);
      if (!suggested) return;

      const noteText = Array.isArray(suggested.notes) ? suggested.notes.join(" ") : "";
      const normalizedGeneratedName = String(suggested.generatedProductName || "").trim();
      const noNameDetected = isUnknownGeneratedProductName(normalizedGeneratedName);

      const suggestedCategory = normalizeSuggestedCategory(suggested.category || "");

      const strictNeedVisionName = shouldRequireVisionName(form.productName);
      const shouldUseGeneratedName = Boolean(normalizedGeneratedName && !noNameDetected);
      const provisionalNameForInference = shouldUseGeneratedName
        ? normalizedGeneratedName
        : form.productName;

      const inferredCategory = inferCategoryFromProductName(provisionalNameForInference);

      let resolvedCategory = suggestedCategory;
      if (!resolvedCategory || resolvedCategory === "other") {
        resolvedCategory = inferredCategory || resolvedCategory || "other";
      } else if (shouldPreferInferredCategory(inferredCategory, suggestedCategory)) {
        resolvedCategory = inferredCategory;
      }

      const potentialMismatch = Boolean(
        inferredCategory
        && suggestedCategory
        && inferredCategory !== suggestedCategory
      );

      const shouldWarnMismatch = Boolean(
        potentialMismatch
        && resolvedCategory === suggestedCategory
        && mode === "manual"
      );

      const suggestedGroup = getCategoryGroupValue(resolvedCategory);
      const canApplySuggestedCategory = getCategoryValuesByGroup(suggestedGroup).includes(resolvedCategory);

      const shouldUseCategoryFallbackName = Boolean(
        strictNeedVisionName
        && !shouldUseGeneratedName
        && canApplySuggestedCategory
        && resolvedCategory !== "other"
      );

      const fallbackProductName = shouldUseCategoryFallbackName
        ? buildCategoryFallbackProductName(resolvedCategory, language)
        : "";

      const nextProductName = shouldUseGeneratedName
        ? normalizedGeneratedName
        : (fallbackProductName || null);
      const nameRequiredButMissing = strictNeedVisionName && !nextProductName;

      const resolvedIndustryPreset = canApplySuggestedCategory
        ? resolveSuggestedIndustryPresetValue({
            category: resolvedCategory,
            suggestion: suggested,
            productName: nextProductName || form.productName,
            currentPreset: form.industryPreset,
            categoryWillChange: resolvedCategory !== form.category
          })
        : form.industryPreset;

      const resolvedSubcategory = canApplySuggestedCategory
        ? resolveSuggestedSubcategoryIndex({
            category: resolvedCategory,
            suggestion: suggested,
            productName: nextProductName || form.productName,
            currentSubcategory: form.subcategory,
            categoryWillChange: resolvedCategory !== form.category,
            industryPreset: resolvedIndustryPreset
          })
        : form.subcategory;

      if (canApplySuggestedCategory && suggestedGroup !== categoryGroupFilter) {
        setCategoryGroupFilter(suggestedGroup);
      }

      const shouldUseNoDataMode = /chua du du lieu|khong du du lieu|uploaded image does not contain enough data|khong the phan tich/i.test(noteText);

      if (shouldUseNoDataMode) {
        setForm((prev) => ({
          ...prev,
          productName: nextProductName || prev.productName,
          category: canApplySuggestedCategory ? resolvedCategory : prev.category,
          subcategory: canApplySuggestedCategory
            ? (Number.isFinite(Number(resolvedSubcategory)) ? Number(resolvedSubcategory) : prev.subcategory)
            : prev.subcategory,
          industryPreset: canApplySuggestedCategory
            ? (resolvedIndustryPreset || prev.industryPreset)
            : prev.industryPreset
        }));
        setSuggestionPulseToken(Date.now());

        if (nameRequiredButMissing) {
          setMessage(language === "vi"
            ? "Chưa nhận dạng được tên sản phẩm từ ảnh. Vui lòng dùng ảnh rõ sản phẩm hoặc nhập tên thủ công."
            : "Unable to identify product name from image yet. Please upload a clearer image or enter product name manually.");
          trackEvent("image.suggest.name_not_detected", { mode, category: canApplySuggestedCategory ? resolvedCategory : form.category });
        } else if (shouldUseCategoryFallbackName) {
          setMessage(language === "vi"
            ? "AI chưa nhận dạng chính xác tên sản phẩm, đã điền tên gợi ý theo ngành hàng."
            : "AI could not detect an exact product name, so a category-based fallback name was applied.");
        } else {
          setMessage(noteText);
        }

        trackEvent("image.suggest.no_data", {
          mode,
          category: canApplySuggestedCategory ? resolvedCategory : form.category,
          generatedProductName: nextProductName,
          fallbackNameApplied: shouldUseCategoryFallbackName
        });
        return;
      }

      setForm((prev) => ({
        ...prev,
        productName: nextProductName || prev.productName,
        category: canApplySuggestedCategory ? resolvedCategory : prev.category,
        subcategory: canApplySuggestedCategory
          ? (Number.isFinite(Number(resolvedSubcategory)) ? Number(resolvedSubcategory) : prev.subcategory)
          : prev.subcategory,
        industryPreset: canApplySuggestedCategory
          ? (resolvedIndustryPreset || prev.industryPreset)
          : prev.industryPreset,
        tone: Number.isFinite(Number(suggested.tone)) ? Number(suggested.tone) : prev.tone,
        channel: Number.isFinite(Number(suggested.channel)) ? Number(suggested.channel) : prev.channel,
        mood: Number.isFinite(Number(suggested.mood)) ? Number(suggested.mood) : prev.mood,
        brandStyle: Number.isFinite(Number(suggested.brandStyle)) ? Number(suggested.brandStyle) : prev.brandStyle,
        targetCustomer: suggested.targetCustomer || prev.targetCustomer,
        shortDescription: suggested.shortDescription || prev.shortDescription,
        highlights: suggested.highlights?.length ? suggested.highlights.join("\n") : prev.highlights,
        attributes: suggested.attributes?.length
          ? suggested.attributes.map((item) => item.value).join("\n")
          : prev.attributes
      }));
      setSuggestionPulseToken(Date.now());

      trackEvent("image.suggest.success", {
        mode,
        category: canApplySuggestedCategory ? resolvedCategory : form.category,
        suggestedCategory,
        inferredCategory: inferredCategory || null,
        categoryGroup: canApplySuggestedCategory ? suggestedGroup : categoryGroupFilter,
        confidence: suggested.confidence,
        notesCount: suggested.notes?.length || 0
      });

      if (nameRequiredButMissing) {
        setMessage(language === "vi"
          ? "Chưa nhận dạng được tên sản phẩm từ ảnh. Vui lòng dùng ảnh rõ sản phẩm hoặc nhập tên thủ công."
          : "Unable to identify product name from image yet. Please upload a clearer image or enter product name manually.");
        trackEvent("image.suggest.name_not_detected", { mode, category: canApplySuggestedCategory ? resolvedCategory : form.category });
      } else if (shouldUseCategoryFallbackName) {
        setMessage(language === "vi"
          ? "AI chưa nhận dạng chính xác tên sản phẩm, đã điền tên gợi ý theo ngành hàng."
          : "AI could not detect an exact product name, so a category-based fallback name was applied.");
      } else if (shouldWarnMismatch) {
        setMessage(language === "vi"
          ? "Ảnh và tên sản phẩm đang mâu thuẫn, vui lòng xác nhận lại trước khi áp dụng template."
          : "Image and product name conflict. Please verify before applying templates.");
        trackEvent("image.suggest.conflict_warning", {
          mode,
          suggestedCategory,
          inferredCategory
        });
      } else {
        setMessage("");
      }
    } catch (error) {
      const fallbackNote = language === "vi"
        ? "Không thể phân tích ảnh lúc này, vui lòng thử lại."
        : "Unable to analyze images right now. Please try again.";
      const rawErrorMessage = String(error?.message || "");
      const nextMessage =
        /401|unauthorized|invalid api key|expired/i.test(rawErrorMessage)
          ? (language === "vi" ? "AI key không hợp lệ hoặc đã hết hạn." : "AI key is invalid or expired.")
          : /403|forbidden/i.test(rawErrorMessage)
            ? (language === "vi" ? "AI provider từ chối truy cập (403)." : "AI provider rejected access (403).")
            : /429|rate|too many/i.test(rawErrorMessage)
              ? (language === "vi" ? "AI provider đang quá tải (429), vui lòng thử lại sau ít phút." : "AI provider rate-limited (429), please retry shortly.")
              : /5\d\d|server/i.test(rawErrorMessage)
                ? (language === "vi" ? "AI provider đang lỗi máy chủ, vui lòng thử lại sau." : "AI provider server error, please retry later.")
                : (rawErrorMessage || fallbackNote);

      setSuggestion((prev) => ({
        category: prev?.category || form.category || "other",
        tone: prev?.tone ?? form.tone ?? 0,
        channel: prev?.channel ?? form.channel ?? 2,
        mood: prev?.mood ?? form.mood ?? 0,
        brandStyle: prev?.brandStyle ?? form.brandStyle ?? 0,
        generatedProductName: language === "vi"
          ? "Không nhận dạng tên sản phẩm được"
          : "Unable to identify product name",
        targetCustomer: prev?.targetCustomer || "",
        shortDescription: prev?.shortDescription || "",
        highlights: Array.isArray(prev?.highlights) ? prev.highlights : [],
        attributes: Array.isArray(prev?.attributes) ? prev.attributes : [],
        confidence: Number.isFinite(Number(prev?.confidence)) ? Number(prev.confidence) : 0.2,
        notes: [nextMessage]
      }));
      setMessage(nextMessage);
      trackEvent("image.suggest.failed", { mode, error: error?.message || String(error) });
    } finally {
      setSuggesting(false);
    }
  }

  async function suggestFromImages() {
    await suggestFromImagesInternal(form.images, "manual");
  }

  function dismissOnboarding() {
    const nextState = { ...onboardingState, seen: true, dismissed: true };
    setOnboardingState(nextState);
    saveOnboardingState(nextState);
    trackEvent("onboarding.skipped", { page: "scriptProductInfo" });
  }

  return {
    session,
    history,
    favorites,
    loading,
    result,
    selectedVariant,
    suggestion,
    suggestionPulseToken,
    suggesting,
    message,
    activeHistoryId,
    form,
    favoriteIds: mergedFavoriteIds,
    industryPresets,
    filteredIndustryPresets,
    selectedIndustryPreset,
    industrySearchKeyword,
    categoryGroupFilter,
    advancedFieldGroup,
    brandPreset,
    variantCount,
    variantStylePresets,
    isProPlan,
    onboardingState,
    generateQuota,
    actions: {
      handleGenerate,
      applySample,
      applyIndustryPreset,
      clearDraft,
      handleCategoryChange,
      handleFieldChange,
      openHistoryItem,
      handleImageSelect,
      removeImage,
      suggestFromImages,
      copyResult,
      downloadDoc,
      saveEditedResult,
      toggleFavorite,
      deleteHistory,
      setBrandPreset,
      setVariantCount,
      setVariantStylePresetAt,
      setIndustrySearchKeyword,
        setCategoryGroupFilter: handleCategoryGroupFilterChange,
        setResult,
        setSelectedVariant,
        setActiveHistoryId,
        dismissOnboarding
      }
    };
}
