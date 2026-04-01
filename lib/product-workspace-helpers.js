import { getCategoryValuesByGroup } from "@/lib/category-marketplace-presets";
import { normalizeTextForCategoryCheck } from "@/lib/category-inference";
import { getProductIndustryPresets } from "@/lib/product-industry-templates";

export function shouldRequireVisionName(name = "") {
  return !String(name || "").trim();
}

export function buildSuggestionSignalText({ suggestion, productName = "" } = {}) {
  const chunks = [productName, suggestion?.generatedProductName, suggestion?.targetCustomer, suggestion?.shortDescription];

  if (Array.isArray(suggestion?.highlights)) {
    chunks.push(...suggestion.highlights);
  }
  if (Array.isArray(suggestion?.notes)) {
    chunks.push(...suggestion.notes);
  }
  if (Array.isArray(suggestion?.attributes)) {
    for (const item of suggestion.attributes) {
      if (typeof item === "string") {
        chunks.push(item);
      } else {
        chunks.push(item?.value || "");
      }
    }
  }

  return normalizeTextForCategoryCheck(chunks.filter(Boolean).join(" "));
}

function pickComputerOfficeIndustryPreset(signal = "", presets = [], fallbackValue = "") {
  if (!signal) return fallbackValue;
  const findValue = (keyword) => presets.find((item) => String(item?.value || "").includes(keyword))?.value || "";

  if (/\b(man hinh|monitor|display|screen|ultrawide|ips|hz|inch)\b/.test(signal)) {
    return findValue("monitor") || fallbackValue;
  }

  if (/\b(ban phim|chuot|keyboard|mouse|keycap|switch)\b/.test(signal)) {
    return findValue("input") || fallbackValue;
  }

  if (/\b(router|wifi|network|mesh|modem|mang)\b/.test(signal)) {
    return findValue("network") || fallbackValue;
  }

  return fallbackValue;
}

function resolveComputerOfficeSubcategoryIndex({ signal = "", industryPreset = "", fallbackIndex = 0 } = {}) {
  const preset = String(industryPreset || "").toLowerCase();
  if (preset.includes("monitor")) return 1;
  if (preset.includes("input")) return 2;
  if (preset.includes("network")) return 3;

  if (/\b(man hinh|monitor|display|screen|ultrawide|ips|hz|inch)\b/.test(signal)) return 1;
  if (/\b(ban phim|chuot|keyboard|mouse|keycap|switch)\b/.test(signal)) return 2;
  if (/\b(router|wifi|network|mesh|modem|mang)\b/.test(signal)) return 3;
  if (/\b(laptop|may tinh|macbook|notebook)\b/.test(signal)) return 0;

  return Number.isFinite(Number(fallbackIndex)) ? Number(fallbackIndex) : 0;
}

export function resolveSuggestedSubcategoryIndex({
  category = "other",
  suggestion = null,
  productName = "",
  currentSubcategory = 0,
  categoryWillChange = false,
  industryPreset = ""
} = {}) {
  const fallbackIndex = categoryWillChange
    ? 0
    : (Number.isFinite(Number(currentSubcategory)) ? Number(currentSubcategory) : 0);

  if (category === "computerOffice") {
    const signal = buildSuggestionSignalText({ suggestion, productName });
    return resolveComputerOfficeSubcategoryIndex({
      signal,
      industryPreset,
      fallbackIndex
    });
  }

  return fallbackIndex;
}

export function applyIndustryPresetToForm(prev, preset) {
  if (!preset) return prev;

  return {
    ...prev,
    industryPreset: preset.value,
    targetCustomer: preset.targetCustomer || prev.targetCustomer,
    shortDescription: preset.shortDescription || prev.shortDescription,
    highlights: preset.highlights || prev.highlights,
    attributes: preset.attributes || prev.attributes,
    priceSegment: preset.priceSegment || prev.priceSegment,
    usage: preset.usage || prev.usage,
    skinConcern: preset.skinConcern || prev.skinConcern,
    routineStep: preset.routineStep || prev.routineStep,
    dimensions: preset.dimensions || prev.dimensions,
    warranty: preset.warranty || prev.warranty,
    usageSpace: preset.usageSpace || prev.usageSpace,
    specs: preset.specs || prev.specs,
    compatibility: preset.compatibility || prev.compatibility,
    sizeGuide: preset.sizeGuide || prev.sizeGuide,
    careGuide: preset.careGuide || prev.careGuide,
    exchangePolicy: preset.exchangePolicy || prev.exchangePolicy,
    tone: Number.isFinite(Number(preset.tone)) ? Number(preset.tone) : prev.tone,
    brandStyle: Number.isFinite(Number(preset.brandStyle)) ? Number(preset.brandStyle) : prev.brandStyle,
    mood: Number.isFinite(Number(preset.mood)) ? Number(preset.mood) : prev.mood,
    channel: Number.isFinite(Number(preset.channel)) ? Number(preset.channel) : prev.channel
  };
}

export function resolveSuggestedIndustryPresetValue({
  category = "other",
  suggestion = null,
  productName = "",
  currentPreset = "",
  categoryWillChange = false
} = {}) {
  const presets = getProductIndustryPresets(category);
  if (!presets.length) return String(currentPreset || "");

  const fallbackPreset = String(presets[0]?.value || "");
  const current = String(currentPreset || "");
  const signal = buildSuggestionSignalText({ suggestion, productName });

  let preferred = fallbackPreset;
  if (category === "computerOffice") {
    preferred = pickComputerOfficeIndustryPreset(signal, presets, fallbackPreset);
  }

  const isCurrentValid = presets.some((item) => item.value === current);
  const keepCurrent = Boolean(current && isCurrentValid && !categoryWillChange && current !== fallbackPreset);
  if (keepCurrent) {
    return current;
  }

  return preferred || fallbackPreset || current;
}

export function enforceGroupScopedCategory(formState, groupFilter) {
  const allowed = getCategoryValuesByGroup(groupFilter);
  const nextCategory = allowed.includes(formState?.category) ? formState.category : (allowed[0] || "other");
  return {
    ...formState,
    category: nextCategory
  };
}
