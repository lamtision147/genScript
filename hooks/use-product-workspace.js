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

const DRAFT_KEY = "seller-studio-next-product-draft";
const MAX_IMAGE_COUNT = 4;
const ONBOARDING_STATE_KEY = "seller-studio-onboarding-state";

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

function normalizeTextForCategoryCheck(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}

function inferCategoryFromProductName(name = "") {
  const normalized = normalizeTextForCategoryCheck(name);
  if (!normalized) return "";

  const has = (pattern) => pattern.test(normalized);

  if (has(/voucher|gift\s*card|license|template|preset|khoa\s*hoc\s*online|digital\b/)) return "digitalGoods";
  if (has(/camera\s*hanh\s*trinh|dash\s*cam|phu\s*kien\s*xe|oto|xe\s*may|moto|o\s*to/)) return "autoMoto";
  if (has(/drone|flycam|mirrorless|dslr|may\s*anh|camera\b|gimbal/)) return "cameraDrone";

  if (has(/dien\s*thoai|smartphone|iphone|android\b|may\s*tinh\s*bang|tablet|ipad/)) return "phoneTablet";
  if (has(/balo|backpack|tote|handbag|tui\b/)) return "bags";

  if (has(/laptop|monitor|man\s*hinh|keyboard|ban\s*phim|mouse|chuot|router|wifi|printer|may\s*in|webcam|micro|pc\b/)) return "computerOffice";
  if (has(/tai\s*nghe|headphone|earbud|loa|speaker|sac|charger|power\s*bank|pin\s*du\s*phong/)) return "electronics";

  if (has(/may\s*rua\s*mat|may\s*say\s*toc|hair\s*dryer|uon\s*toc|straightener|makeup\s*brush|co\s*trang\s*diem|triet\s*long/)) return "beautyTools";
  if (has(/serum|kem\s*chong\s*nang|sunscreen|sua\s*rua\s*mat|cleanser|toner|kem\s*duong|moisturizer|my\s*pham|skincare/)) return "skincare";
  if (has(/nuoc\s*hoa|fragrance|perfume|body\s*mist/)) return "fragrance";

  if (has(/binh\s*sua|ta\s*quan|bim|sosinh|baby|me\s*be/)) return "motherBaby";
  if (has(/huyet\s*ap|vitamin|supplement|suc\s*khoe|health\s*care|thermometer/)) return "healthCare";

  if (has(/\bao\b|dam\s*cong\s*so|dam\s*du\s*tiec|dam\s*nu|\bvay\b|so\s*mi|hoodie|\bquan\b|sleepwear|pajama|pyjama|do\s*ngu|quan\s*ngu|shorts?/)) return "fashion";
  if (has(/giay|sneaker|sandal|dep\b|boots/)) return "footwear";
  if (has(/wallet|that\s*lung|belt|khuyen\s*tai|vong\b|phu\s*kien|accessor/)) return "accessories";

  if (has(/noi\s*chien|air\s*fryer|may\s*hut\s*bui|vacuum|may\s*loc\s*khong\s*khi|air\s*purifier|may\s*xay|blender|juicer|home\s*appliance/)) return "homeAppliances";
  if (has(/vien\s*giat|nuoc\s*giat|detergent|lau\s*san|floor\s*cleaner|tissue|giay\s*ve\s*sinh|dishwash/)) return "householdEssentials";
  if (has(/ke\s*bep|gia\s*vi|hop\s*dung|do\s*bep|houseware|gia\s*dung|kitchenware/)) return "home";
  if (has(/sofa|ban\s*tra|\bke\b|shelf|\btu\b|chair|den\s*decor|decor|noi\s*that|furniture/)) return "furnitureDecor";

  if (has(/yen\s*mach|granola|snack|do\s*uong|thuc\s*pham|food|an\s*kieng/)) return "food";
  if (has(/pate|thuc\s*an\s*cho|thuc\s*an\s*meo|cat\s*litter|pet\b|thu\s*cung|dog|cat/)) return "pet";
  if (has(/yoga|gym|running|dumbbell|resistance|the\s*thao/)) return "sports";
  if (has(/planner|but\b|notebook|sach\b|stationery|van\s*phong\s*pham|book\b/)) return "booksStationery";
  if (has(/lego|board\s*game|do\s*choi|toy\b|game\b/)) return "toysGames";
  if (has(/may\s*khoan|khoan\b|tua\s*vit|dung\s*cu|tool|hardware|do\s*nghe/)) return "toolsHardware";

  return "";
}

function shouldRequireVisionName(name = "") {
  return !String(name || "").trim();
}

const CANONICAL_CATEGORY_VALUES = new Set([
  "fashion",
  "skincare",
  "beautyTools",
  "home",
  "furnitureDecor",
  "electronics",
  "food",
  "householdEssentials",
  "footwear",
  "bags",
  "accessories",
  "fragrance",
  "pet",
  "sports",
  "motherBaby",
  "healthCare",
  "booksStationery",
  "toysGames",
  "autoMoto",
  "phoneTablet",
  "computerOffice",
  "cameraDrone",
  "homeAppliances",
  "toolsHardware",
  "digitalGoods",
  "other"
]);

function normalizeSuggestedCategory(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "other";
  if (CANONICAL_CATEGORY_VALUES.has(raw)) return raw;

  const normalized = normalizeTextForCategoryCheck(raw).replace(/\s+/g, "");
  const aliasMap = {
    khac: "other",
    other: "other",
    unknown: "other",
    fashion: "fashion",
    thoitrang: "fashion",
    skincare: "skincare",
    mypham: "skincare",
    beautytools: "beautyTools",
    dungculamdep: "beautyTools",
    thietbichamsoccanhan: "beautyTools",
    home: "home",
    giadung: "home",
    furnituredecor: "furnitureDecor",
    noithat: "furnitureDecor",
    trangtri: "furnitureDecor",
    electronics: "electronics",
    dientu: "electronics",
    food: "food",
    thucpham: "food",
    householdessentials: "householdEssentials",
    tieudungnhanh: "householdEssentials",
    hoapham: "householdEssentials",
    footwear: "footwear",
    giaydep: "footwear",
    bags: "bags",
    tuixach: "bags",
    accessories: "accessories",
    phukien: "accessories",
    fragrance: "fragrance",
    nuochoa: "fragrance",
    pet: "pet",
    thucung: "pet",
    sports: "sports",
    thethao: "sports",
    motherbaby: "motherBaby",
    mevabe: "motherBaby",
    healthcare: "healthCare",
    suckhoe: "healthCare",
    booksstationery: "booksStationery",
    sachvanphongpham: "booksStationery",
    toysgames: "toysGames",
    dochoi: "toysGames",
    automoto: "autoMoto",
    otoxemay: "autoMoto",
    phonetablet: "phoneTablet",
    dienthoaitablet: "phoneTablet",
    computeroffice: "computerOffice",
    maytinhvanphong: "computerOffice",
    cameradrone: "cameraDrone",
    mayanhdrone: "cameraDrone",
    homeappliances: "homeAppliances",
    diengiadung: "homeAppliances",
    toolshardware: "toolsHardware",
    dungcu: "toolsHardware",
    digitalgoods: "digitalGoods",
    sanphamsovoucher: "digitalGoods",
    voucher: "digitalGoods",
    noithat: "furnitureDecor",
    tieudungnhanh: "householdEssentials"
  };

  return aliasMap[normalized] || "other";
}

function isUnknownGeneratedProductName(value = "") {
  const normalized = normalizeTextForCategoryCheck(value);
  if (!normalized) return true;
  return /khong nhan dang|khong xac dinh|unable to identify|cannot identify/.test(normalized);
}

const CATEGORY_FALLBACK_NAMES_BY_LANG = {
  vi: {
    fashion: "Sản phẩm thời trang",
    skincare: "Sản phẩm skincare",
    beautyTools: "Dụng cụ làm đẹp",
    home: "Sản phẩm gia dụng",
    furnitureDecor: "Sản phẩm nội thất trang trí",
    electronics: "Thiết bị điện tử",
    food: "Sản phẩm thực phẩm",
    householdEssentials: "Sản phẩm tiêu dùng nhanh",
    footwear: "Giày dép",
    bags: "Túi xách",
    accessories: "Phụ kiện",
    fragrance: "Nước hoa",
    pet: "Sản phẩm thú cưng",
    sports: "Sản phẩm thể thao",
    motherBaby: "Sản phẩm mẹ và bé",
    healthCare: "Sản phẩm chăm sóc sức khỏe",
    booksStationery: "Sách và văn phòng phẩm",
    toysGames: "Đồ chơi",
    autoMoto: "Phụ kiện ô tô xe máy",
    phoneTablet: "Điện thoại hoặc máy tính bảng",
    computerOffice: "Thiết bị máy tính văn phòng",
    cameraDrone: "Thiết bị camera drone",
    homeAppliances: "Điện gia dụng",
    toolsHardware: "Dụng cụ và phụ kiện",
    digitalGoods: "Sản phẩm số",
    other: "Sản phẩm"
  },
  en: {
    fashion: "Fashion product",
    skincare: "Skincare product",
    beautyTools: "Beauty tools product",
    home: "Home product",
    furnitureDecor: "Furniture decor product",
    electronics: "Electronic device",
    food: "Food product",
    householdEssentials: "Household essentials product",
    footwear: "Footwear product",
    bags: "Bag product",
    accessories: "Accessory product",
    fragrance: "Fragrance product",
    pet: "Pet product",
    sports: "Sports product",
    motherBaby: "Mother and baby product",
    healthCare: "Health care product",
    booksStationery: "Books and stationery product",
    toysGames: "Toys and games product",
    autoMoto: "Auto and moto accessory",
    phoneTablet: "Phone or tablet",
    computerOffice: "Computer office device",
    cameraDrone: "Camera drone device",
    homeAppliances: "Home appliance",
    toolsHardware: "Tools and hardware product",
    digitalGoods: "Digital goods product",
    other: "Product"
  }
};

function buildCategoryFallbackProductName(category = "other", language = "vi") {
  const langKey = language === "vi" ? "vi" : "en";
  const dict = CATEGORY_FALLBACK_NAMES_BY_LANG[langKey] || CATEGORY_FALLBACK_NAMES_BY_LANG.en;
  return dict[category] || dict.other;
}

function buildSuggestionSignalText({ suggestion, productName = "" } = {}) {
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

function resolveSuggestedSubcategoryIndex({
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

function applyIndustryPresetToForm(prev, preset) {
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

function resolveSuggestedIndustryPresetValue({
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

function enforceGroupScopedCategory(formState, groupFilter) {
  const allowed = getCategoryValuesByGroup(groupFilter);
  const nextCategory = allowed.includes(formState?.category) ? formState.category : (allowed[0] || "other");
  return {
    ...formState,
    category: nextCategory
  };
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
  const [variantCount, setVariantCount] = useState(1);
  const [industrySearchKeyword, setIndustrySearchKeyword] = useState("");
  const [categoryGroupFilter, setCategoryGroupFilter] = useState("fashionBeauty");
  const [onboardingState, setOnboardingState] = useState(() => getOnboardingState());

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
      apiGet(`${routes.api.history}?type=product_copy`, { items: [] }),
      apiGet(`${routes.api.favorites}?type=product_copy`, { items: [] })
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
    apiGet(`${routes.api.history}/${initialHistoryId}`).then((data) => {
      if (data?.item) openHistoryItem(data.item);
    }).catch(() => {});
  }, [initialHistoryId]);

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
      const data = await apiPost(routes.api.generate, {
        ...form,
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
        variantCount,
        improved,
        previousResult: improved && result
          ? { paragraphs: result.paragraphs || [], hashtags: result.hashtags || [] }
          : null
      });
      const normalizedResult = {
        ...data,
        variants: Array.isArray(data.variants) && data.variants.length ? data.variants : [data],
        selectedVariant: data.selectedVariant ?? 0
      };
      setResult(normalizedResult);
      setSelectedVariant(normalizedResult.selectedVariant);
      setActiveHistoryId(data.historyId || null);
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
      trackEvent("generate.failed", { error: raw, category: form.category });
    } finally {
      setLoading(false);
    }
  }

  function applySample() {
    const preset = samplePresets[form.category] || samplePresets.fashion;
    setForm((prev) => ({ ...createEmptyProductForm(), ...preset, images: prev.images }));
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
    setVariantCount(1);
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
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openHistoryItem(item) {
    const nextResult = item.result ? {
      ...item.result,
      variants: Array.isArray(item.result.variants) && item.result.variants.length ? item.result.variants : [item.result],
      selectedVariant: Number.isFinite(Number(item.result.selectedVariant)) ? Number(item.result.selectedVariant) : 0,
      historyId: item.id,
      title: item.title,
      variantLabel: item.variantLabel
    } : null;
    setResult(nextResult);
    setSelectedVariant(nextResult?.selectedVariant ?? 0);
    setActiveHistoryId(item.id || null);
    setForm(restoreProductFormFromHistoryItem(item));
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
    if (exists) {
      setFavorites((prev) => prev.filter((item) => item.id !== historyId));
    } else {
      const historyItem = history.find((item) => item.id === historyId);
      if (historyItem) setFavorites((prev) => [historyItem, ...prev]);
    }
    await apiPost(routes.api.toggleFavorite, { historyId });
    await refreshUserData();
    trackEvent("favorite.toggle", { historyId, nextState: !exists });
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
      } else if (inferredCategory && inferredCategory !== suggestedCategory) {
        const suggestedGroup = getCategoryGroupValue(suggestedCategory);
        const inferredGroup = getCategoryGroupValue(inferredCategory);
        const isSpecificTechCorrection =
          new Set(["electronics", "computerOffice", "phoneTablet"]).has(inferredCategory);

        if (suggestedGroup !== inferredGroup || isSpecificTechCorrection) {
          resolvedCategory = inferredCategory;
        }
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

  async function submitFeedback({ type = "general", rating = 0, message: rawMessage = "" } = {}) {
    const payload = {
      type: String(type || "general").slice(0, 48),
      rating: Number.isFinite(Number(rating)) ? Number(rating) : 0,
      message: String(rawMessage || "").trim().slice(0, 1200),
      page: "scriptProductInfo",
      category: form.category,
      hasImages: Array.isArray(form.images) && form.images.length > 0,
      hasSuggestion: Boolean(suggestion),
      hasResult: Boolean(result),
      language: toAiLang(language)
    };

    await apiPost(routes.api.feedback, payload);
    trackEvent("feedback.submit", {
      type: payload.type,
      rating: payload.rating,
      page: payload.page,
      category: payload.category
    });
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
    onboardingState,
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
      toggleFavorite,
      deleteHistory,
      setBrandPreset,
      setVariantCount,
      setIndustrySearchKeyword,
      setCategoryGroupFilter: handleCategoryGroupFilterChange,
      setResult,
      setSelectedVariant,
      dismissOnboarding,
      submitFeedback
    }
  };
}
