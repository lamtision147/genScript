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

function pickPhoneTabletIndustryPreset(signal = "", presets = [], fallbackValue = "") {
  if (!signal) return fallbackValue;
  const findValue = (keyword) => presets.find((item) => String(item?.value || "").includes(keyword))?.value || "";

  if (/(op\s*lung|ốp\s*lưng|phone\s*case|case\s*iphone|case\s*android|cover\s*phone|kinh\s*cuong\s*luc|man\s*hinh\s*cuong\s*luc|phu\s*kien\s*(dien\s*thoai|tablet)|magsafe|gia\s*do\s*(dien\s*thoai|tablet)|sac\s*(dien\s*thoai|tablet)|cap\s*(sac|ket\s*noi))/.test(signal)) {
    return findValue("accessories") || fallbackValue;
  }

  if (/(tablet|ipad|may\s*tinh\s*bang)/.test(signal)) {
    return findValue("tablet") || fallbackValue;
  }

  if (/(dien\s*thoai|iphone|android|smartphone)/.test(signal)) {
    return findValue("smartphone") || fallbackValue;
  }

  return fallbackValue;
}

function resolvePhoneTabletSubcategoryIndex({ signal = "", industryPreset = "", fallbackIndex = 0 } = {}) {
  const preset = String(industryPreset || "").toLowerCase();
  if (preset.includes("accessories")) return 2;
  if (preset.includes("tablet")) return 1;
  if (preset.includes("smartphone")) return 0;

  if (/(op\s*lung|ốp\s*lưng|phone\s*case|case\s*iphone|case\s*android|cover\s*phone|kinh\s*cuong\s*luc|man\s*hinh\s*cuong\s*luc|phu\s*kien\s*(dien\s*thoai|tablet)|magsafe|gia\s*do\s*(dien\s*thoai|tablet)|sac\s*(dien\s*thoai|tablet)|cap\s*(sac|ket\s*noi))/.test(signal)) return 2;
  if (/(tablet|ipad|may\s*tinh\s*bang)/.test(signal)) return 1;
  if (/(dien\s*thoai|iphone|android|smartphone)/.test(signal)) return 0;

  return Number.isFinite(Number(fallbackIndex)) ? Number(fallbackIndex) : 0;
}

function pickElectronicsIndustryPreset(signal = "", presets = [], fallbackValue = "") {
  if (!signal) return fallbackValue;
  const findValue = (keyword) => presets.find((item) => String(item?.value || "").includes(keyword))?.value || "";

  if (/(tai\s*nghe|earbud|headphone|airpod|gaming\s*headset|micro\s*thu\s*am|loa\s*(bluetooth|mini)?|speaker)/.test(signal)) {
    return findValue("audio") || fallbackValue;
  }

  if (/(camera\s*hanh\s*trinh|camera\s*an\s*ninh|camera\s*ip|cctv|drone|flycam|gimbal|may\s*anh)/.test(signal)) {
    return findValue("camera") || fallbackValue;
  }

  if (/(router|wifi|mesh|modem|network|smart\s*home|cam\s*bien|o\s*c\s*thong\s*minh|den\s*thong\s*minh)/.test(signal)) {
    return findValue("smart") || fallbackValue;
  }

  if (/(sac\s*(du\s*phong|nhanh|khong\s*day)?|charger|cap\s*(sac|usb)|power\s*bank|pin\s*du\s*phong|ga\s*n)/.test(signal)) {
    return findValue("charging") || fallbackValue;
  }

  if (/(webcam|ban\s*phim|chuot|keyboard|mouse|office\s*device|thiet\s*bi\s*van\s*phong)/.test(signal)) {
    return findValue("office") || fallbackValue;
  }

  return fallbackValue;
}

function resolveElectronicsSubcategoryIndex({ signal = "", industryPreset = "", fallbackIndex = 0 } = {}) {
  const preset = String(industryPreset || "").toLowerCase();
  if (preset.includes("audio")) return 1;
  if (preset.includes("smart")) return 2;
  if (preset.includes("charging")) return 3;
  if (preset.includes("office")) return 4;
  if (preset.includes("camera")) return 1;

  if (/(tai\s*nghe|earbud|headphone|airpod|gaming\s*headset|micro\s*thu\s*am|loa\s*(bluetooth|mini)?|speaker)/.test(signal)) return 1;
  if (/(router|wifi|mesh|modem|network|smart\s*home|cam\s*bien|o\s*c\s*thong\s*minh|den\s*thong\s*minh)/.test(signal)) return 2;
  if (/(sac\s*(du\s*phong|nhanh|khong\s*day)?|charger|cap\s*(sac|usb)|power\s*bank|pin\s*du\s*phong|ga\s*n)/.test(signal)) return 3;
  if (/(webcam|ban\s*phim|chuot|keyboard|mouse|office\s*device|thiet\s*bi\s*van\s*phong)/.test(signal)) return 4;

  return Number.isFinite(Number(fallbackIndex)) ? Number(fallbackIndex) : 0;
}

function pickFashionIndustryPreset(signal = "", presets = [], fallbackValue = "") {
  if (!signal) return fallbackValue;
  const findValue = (keyword) => presets.find((item) => String(item?.value || "").includes(keyword))?.value || "";

  if (/(do\s*ngu|sleepwear|pajama|pyjama|mac\s*nha|quan\s*ngu|ao\s*ngu)/.test(signal)) {
    return findValue("sleepwear") || fallbackValue;
  }
  if (/(bigsize|plus\s*size|oversize\s*nu|size\s*lon)/.test(signal)) {
    return findValue("plus") || fallbackValue;
  }
  if (/(streetwear|hoodie|local\s*brand|tee\s*oversize|unisex)/.test(signal)) {
    return findValue("street") || fallbackValue;
  }
  if (/(ao\s*so\s*mi\s*nam|thoi\s*trang\s*nam|quan\s*tay\s*nam|nam\s*basic)/.test(signal)) {
    return findValue("men") || fallbackValue;
  }
  if (/(dam|đầm|vay|v\s*a\s*y|chan\s*vay|cong\s*so\s*nu|nu\s*cong\s*so|ao\s*kieu\s*nu)/.test(signal)) {
    return findValue("office") || fallbackValue;
  }

  return fallbackValue;
}

function resolveFashionSubcategoryIndex({ signal = "", industryPreset = "", fallbackIndex = 0 } = {}) {
  const preset = String(industryPreset || "").toLowerCase();
  if (preset.includes("office")) return 0;
  if (preset.includes("men")) return 1;
  if (preset.includes("plus")) return 2;
  if (preset.includes("street")) return 3;
  if (preset.includes("sleepwear")) return 4;

  if (/(do\s*ngu|sleepwear|pajama|pyjama|mac\s*nha|quan\s*ngu|ao\s*ngu)/.test(signal)) return 4;
  if (/(bigsize|plus\s*size|oversize\s*nu|size\s*lon)/.test(signal)) return 2;
  if (/(streetwear|hoodie|local\s*brand|tee\s*oversize|unisex)/.test(signal)) return 3;
  if (/(ao\s*so\s*mi\s*nam|thoi\s*trang\s*nam|quan\s*tay\s*nam|nam\s*basic)/.test(signal)) return 1;
  if (/(dam|đầm|vay|v\s*a\s*y|chan\s*vay|cong\s*so\s*nu|nu\s*cong\s*so|ao\s*kieu\s*nu)/.test(signal)) return 0;

  return Number.isFinite(Number(fallbackIndex)) ? Number(fallbackIndex) : 0;
}

function pickSkincareIndustryPreset(signal = "", presets = [], fallbackValue = "") {
  if (!signal) return fallbackValue;
  const findValue = (keyword) => presets.find((item) => String(item?.value || "").includes(keyword))?.value || "";

  if (/(sua\s*rua\s*mat|cleanser|foam\s*cleanser|oil\s*cleanser)/.test(signal)) {
    return findValue("cleanser") || fallbackValue;
  }
  if (/(sun\s*screen|kem\s*chong\s*nang|chong\s*nang|uv)/.test(signal)) {
    return findValue("sunscreen") || fallbackValue;
  }
  if (/(retinol|aha|bha|nha|treatment|mụn|mun|acne)/.test(signal)) {
    return findValue("acne") || fallbackValue;
  }
  if (/(vitamin\s*c|niacinamide|bright|lam\s*sang|nam\s*tham|tham\s*nam)/.test(signal)) {
    return findValue("bright") || fallbackValue;
  }
  if (/(ceramide|b5|phuc\s*hoi|repair|barrier|phuc\s*hoi\s*da)/.test(signal)) {
    return findValue("repair") || fallbackValue;
  }

  return fallbackValue;
}

function resolveSkincareSubcategoryIndex({ signal = "", industryPreset = "", fallbackIndex = 0 } = {}) {
  const preset = String(industryPreset || "").toLowerCase();
  if (preset.includes("acne")) return 0;
  if (preset.includes("bright")) return 1;
  if (preset.includes("repair")) return 2;
  if (preset.includes("sunscreen")) return 3;
  if (preset.includes("cleanser")) return 4;

  if (/(retinol|aha|bha|nha|treatment|mụn|mun|acne)/.test(signal)) return 0;
  if (/(vitamin\s*c|niacinamide|bright|lam\s*sang|nam\s*tham|tham\s*nam)/.test(signal)) return 1;
  if (/(ceramide|b5|phuc\s*hoi|repair|barrier|phuc\s*hoi\s*da)/.test(signal)) return 2;
  if (/(sun\s*screen|kem\s*chong\s*nang|chong\s*nang|uv)/.test(signal)) return 3;
  if (/(sua\s*rua\s*mat|cleanser|foam\s*cleanser|oil\s*cleanser)/.test(signal)) return 4;

  return Number.isFinite(Number(fallbackIndex)) ? Number(fallbackIndex) : 0;
}

function pickHomeIndustryPreset(signal = "", presets = [], fallbackValue = "") {
  if (!signal) return fallbackValue;
  const findValue = (keyword) => presets.find((item) => String(item?.value || "").includes(keyword))?.value || "";

  if (/(ke\s*(de\s*ban|dung\s*do)?|hop\s*dung\s*do|storage|luu\s*tru)/.test(signal)) {
    return findValue("storage") || fallbackValue;
  }
  if (/(decor|trang\s*tri|den\s*ban|den\s*ngu|fragrance\s*home|room\s*decor)/.test(signal)) {
    return findValue("decor") || fallbackValue;
  }
  if (/(noi\s*chien|air\s*fryer|blender|may\s*xay|juicer|rice\s*cooker|noi\s*com)/.test(signal)) {
    return findValue("kitchen") || fallbackValue;
  }
  if (/(lau\s*san|ve\s*sinh|clean|dung\s*cu\s*ve\s*sinh|choi\s*lau)/.test(signal)) {
    return findValue("clean") || fallbackValue;
  }

  return fallbackValue;
}

function pickFoodIndustryPreset(signal = "", presets = [], fallbackValue = "") {
  if (!signal) return fallbackValue;
  const findValue = (keyword) => presets.find((item) => String(item?.value || "").includes(keyword))?.value || "";

  if (/(ruou|vang\b|wine|beer|bia|whisky|whiskey|vodka|champagne|sparkling|soju|sake|cocktail|do\s*uong|beverage|drink)/.test(signal)) {
    return findValue("drink") || fallbackValue;
  }

  if (/(eat\s*clean|healthy|an\s*kieng|protein|granola|yogurt|salad|low\s*cal)/.test(signal)) {
    return findValue("healthy") || fallbackValue;
  }

  if (/(snack|an\s*vat|banh|keo|chip|hat\s*dinh\s*duong)/.test(signal)) {
    return findValue("snack") || fallbackValue;
  }

  return fallbackValue;
}

function resolveFoodSubcategoryIndex({ signal = "", industryPreset = "", fallbackIndex = 0 } = {}) {
  const preset = String(industryPreset || "").toLowerCase();
  if (preset.includes("snack")) return 0;
  if (preset.includes("drink")) return 1;
  if (preset.includes("healthy")) return 2;

  if (/(snack|an\s*vat|banh|keo|chip|hat\s*dinh\s*duong)/.test(signal)) return 0;
  if (/(ruou|vang\b|wine|beer|bia|whisky|whiskey|vodka|champagne|sparkling|soju|sake|cocktail|do\s*uong|beverage|drink)/.test(signal)) return 1;
  if (/(eat\s*clean|healthy|an\s*kieng|protein|granola|yogurt|salad|low\s*cal)/.test(signal)) return 2;

  return Number.isFinite(Number(fallbackIndex)) ? Number(fallbackIndex) : 0;
}

function resolveHomeSubcategoryIndex({ signal = "", industryPreset = "", fallbackIndex = 0 } = {}) {
  const preset = String(industryPreset || "").toLowerCase();
  if (preset.includes("kitchen")) return 0;
  if (preset.includes("clean")) return 1;
  if (preset.includes("decor")) return 2;
  if (preset.includes("storage")) return 3;

  if (/(noi\s*chien|air\s*fryer|blender|may\s*xay|juicer|rice\s*cooker|noi\s*com)/.test(signal)) return 0;
  if (/(lau\s*san|ve\s*sinh|clean|dung\s*cu\s*ve\s*sinh|choi\s*lau)/.test(signal)) return 1;
  if (/(decor|trang\s*tri|den\s*ban|den\s*ngu|fragrance\s*home|room\s*decor)/.test(signal)) return 2;
  if (/(ke\s*(de\s*ban|dung\s*do)?|hop\s*dung\s*do|storage|luu\s*tru)/.test(signal)) return 3;

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

  if (category === "electronics") {
    const signal = buildSuggestionSignalText({ suggestion, productName });
    return resolveElectronicsSubcategoryIndex({
      signal,
      industryPreset,
      fallbackIndex
    });
  }

  if (category === "fashion") {
    const signal = buildSuggestionSignalText({ suggestion, productName });
    return resolveFashionSubcategoryIndex({
      signal,
      industryPreset,
      fallbackIndex
    });
  }

  if (category === "skincare") {
    const signal = buildSuggestionSignalText({ suggestion, productName });
    return resolveSkincareSubcategoryIndex({
      signal,
      industryPreset,
      fallbackIndex
    });
  }

  if (category === "home") {
    const signal = buildSuggestionSignalText({ suggestion, productName });
    return resolveHomeSubcategoryIndex({
      signal,
      industryPreset,
      fallbackIndex
    });
  }

  if (category === "food") {
    const signal = buildSuggestionSignalText({ suggestion, productName });
    return resolveFoodSubcategoryIndex({
      signal,
      industryPreset,
      fallbackIndex
    });
  }

  if (category === "phoneTablet") {
    const signal = buildSuggestionSignalText({ suggestion, productName });
    return resolvePhoneTabletSubcategoryIndex({
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
  categoryWillChange = false,
  preferSignal = false
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
  if (category === "phoneTablet") {
    preferred = pickPhoneTabletIndustryPreset(signal, presets, fallbackPreset);
  }
  if (category === "electronics") {
    preferred = pickElectronicsIndustryPreset(signal, presets, fallbackPreset);
  }
  if (category === "fashion") {
    preferred = pickFashionIndustryPreset(signal, presets, fallbackPreset);
  }
  if (category === "skincare") {
    preferred = pickSkincareIndustryPreset(signal, presets, fallbackPreset);
  }
  if (category === "home") {
    preferred = pickHomeIndustryPreset(signal, presets, fallbackPreset);
  }
  if (category === "food") {
    preferred = pickFoodIndustryPreset(signal, presets, fallbackPreset);
  }

  const isPreferredSpecific = Boolean(preferred && preferred !== fallbackPreset);
  if (preferSignal && isPreferredSpecific) {
    return preferred;
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
