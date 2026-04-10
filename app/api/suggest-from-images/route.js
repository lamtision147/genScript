import { NextResponse } from "next/server";
import { getCategoryGroupValue, getMarketplaceDefaults } from "@/lib/category-marketplace-presets";
import { inferCategoryFromProductName } from "@/lib/category-inference";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

const SUGGEST_ERROR_NOTE_BY_LANG = {
  vi: "Không thể phân tích ảnh lúc này, vui lòng thử lại.",
  en: "Unable to analyze images right now. Please try again.",
  zh: "当前无法分析图片，请稍后重试。",
  ja: "現在画像を分析できません。後で再試行してください。",
  ko: "지금은 이미지를 분석할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  es: "No se pueden analizar las imagenes en este momento. Intentalo de nuevo.",
  fr: "Impossible d'analyser les images pour le moment. Reessayez plus tard.",
  de: "Bilder koennen momentan nicht analysiert werden. Bitte spaeter erneut versuchen."
};

const MIN_IMAGE_DATA_URL_LENGTH = 1200;
const MIN_STRONG_IMAGE_DATA_URL_LENGTH = 2200;
const VALID_SUGGEST_CATEGORIES = new Set([
  "fashion", "skincare", "beautyTools", "home", "furnitureDecor", "electronics", "food", "householdEssentials",
  "footwear", "bags", "accessories", "fragrance", "pet", "sports", "motherBaby", "healthCare",
  "booksStationery", "toysGames", "autoMoto", "phoneTablet", "computerOffice", "cameraDrone",
  "homeAppliances", "toolsHardware", "digitalGoods", "other"
]);

const SUGGEST_ANALYSIS_NOTE_BY_LANG = {
  vi: {
    weak: "Ảnh chưa đủ tín hiệu mạnh. Đã gợi ý template gần nhất để bạn chỉnh nhanh.",
    success: "Đã phân tích ảnh và tự động điền nhanh các trường cơ bản."
  },
  en: {
    weak: "Image signal is weak. Applied nearest template suggestion so you can refine quickly.",
    success: "Image analyzed; core form fields were auto-filled for quick editing."
  },
  zh: {
    weak: "图片信号偏弱，系统已套用最接近模板，方便你快速调整。",
    success: "图片已分析，基础表单字段已自动填充，便于快速编辑。"
  },
  ja: {
    weak: "画像の信号が弱いため、近いテンプレートを適用しました。すぐに調整できます。",
    success: "画像を分析し、基本フォーム項目を自動入力しました。"
  },
  ko: {
    weak: "이미지 신호가 약해 가장 가까운 템플릿을 적용했습니다. 빠르게 수정할 수 있어요.",
    success: "이미지를 분석해 핵심 폼 항목을 자동으로 채웠습니다."
  },
  es: {
    weak: "La señal de imagen es debil. Se aplico la plantilla mas cercana para que edites rapido.",
    success: "Imagen analizada; los campos basicos del formulario se autocompletaron para editar rapido."
  },
  fr: {
    weak: "Le signal image est faible. Le template le plus proche a ete applique pour une retouche rapide.",
    success: "Image analysee : les champs de base du formulaire ont ete remplis automatiquement."
  },
  de: {
    weak: "Das Bildsignal ist schwach. Die naechste passende Vorlage wurde fuer schnelle Anpassung angewendet.",
    success: "Bild analysiert; die wichtigsten Formularfelder wurden automatisch ausgefuellt."
  }
};

function getSuggestAnalysisNote(lang = "vi", type = "success") {
  const langKey = SUGGEST_ANALYSIS_NOTE_BY_LANG[lang] ? lang : "vi";
  const noteSet = SUGGEST_ANALYSIS_NOTE_BY_LANG[langKey] || SUGGEST_ANALYSIS_NOTE_BY_LANG.vi;
  return noteSet?.[type] || SUGGEST_ANALYSIS_NOTE_BY_LANG.vi.success;
}

function getUnknownGeneratedName(lang = "vi") {
  return lang === "vi" ? "Không nhận dạng tên sản phẩm được" : "Unable to identify product name";
}

function normalizeForSignal(text = "") {
  return String(text || "")
    .replace(/[đĐ]/g, "d")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function hasNoDataLikeNotes(notes = []) {
  const markers = [
    "khong du du lieu",
    "khong the phan tich",
    "anh tai len chua du",
    "not enough image data",
    "insufficient image",
    "unable to analyze images",
    "uploaded image does not contain enough data"
  ];
  return (Array.isArray(notes) ? notes : []).some((note) => {
    const normalized = normalizeForSignal(note || "");
    if (!normalized) return false;
    return markers.some((marker) => normalized.includes(marker));
  });
}

function dropNoDataLikeNotes(notes = []) {
  const markers = [
    "khong du du lieu",
    "khong the phan tich",
    "anh tai len chua du",
    "not enough image data",
    "insufficient image",
    "unable to analyze images",
    "uploaded image does not contain enough data"
  ];
  return (Array.isArray(notes) ? notes : []).filter((note) => {
    const normalized = normalizeForSignal(note || "");
    if (!normalized) return false;
    return !markers.some((marker) => normalized.includes(marker));
  });
}

function clampNumber(value, min, max, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

function sanitizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sanitizeStringArray(value, max = 5, maxLength = 90) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => sanitizeText(item).slice(0, maxLength))
    .filter(Boolean)
    .slice(0, max);
}

function sanitizeAttributes(value, max = 5) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => ({
      type: clampNumber(item?.type, 0, 5, index),
      value: sanitizeText(item?.value || "")
    }))
    .filter((item) => item.value)
    .slice(0, max);
}

const SUGGEST_ADVANCED_KEYS = [
  "usage",
  "skinConcern",
  "routineStep",
  "dimensions",
  "warranty",
  "usageSpace",
  "specs",
  "compatibility",
  "sizeGuide",
  "careGuide",
  "exchangePolicy"
];

function sanitizeFacts(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const advancedSource = source.advanced && typeof source.advanced === "object" ? source.advanced : {};
  const facts = {
    brandName: sanitizeText(source.brandName || "").slice(0, 90),
    modelName: sanitizeText(source.modelName || "").slice(0, 90),
    color: sanitizeText(source.color || "").slice(0, 90),
    sizeInfo: sanitizeText(source.sizeInfo || "").slice(0, 90),
    material: sanitizeText(source.material || "").slice(0, 90),
    packSize: sanitizeText(source.packSize || "").slice(0, 90),
    condition: sanitizeText(source.condition || "").slice(0, 90),
    targetUseContext: sanitizeText(source.targetUseContext || "").slice(0, 140),
    keySpecs: sanitizeStringArray(source.keySpecs, 6, 120),
    specialFeatures: sanitizeStringArray(source.specialFeatures, 6, 120),
    evidenceLevel: ["high", "medium", "low"].includes(String(source.evidenceLevel || "").toLowerCase())
      ? String(source.evidenceLevel).toLowerCase()
      : "low",
    advanced: {}
  };

  for (const key of SUGGEST_ADVANCED_KEYS) {
    facts.advanced[key] = sanitizeText(advancedSource[key] || "").slice(0, 180);
  }

  return facts;
}

function parseFactsAttributeLines(attributes = []) {
  const normalized = {};
  const lines = Array.isArray(attributes)
    ? attributes
        .map((item) => sanitizeText(item?.value || ""))
        .filter(Boolean)
    : [];

  for (const line of lines) {
    const lowered = normalizeForSignal(line);
    if (!normalized.brandName && /^(thuong hieu|brand)\s*:\s*/.test(lowered)) {
      normalized.brandName = line.replace(/^[^:]+:\s*/i, "").trim();
      continue;
    }
    if (!normalized.modelName && /^model\s*:\s*/.test(lowered)) {
      normalized.modelName = line.replace(/^[^:]+:\s*/i, "").trim();
      continue;
    }
    if (!normalized.color && /^(mau sac|color)\s*:\s*/.test(lowered)) {
      normalized.color = line.replace(/^[^:]+:\s*/i, "").trim();
      continue;
    }
    if (!normalized.sizeInfo && /^(kich thuoc|size)\s*:\s*/.test(lowered)) {
      normalized.sizeInfo = line.replace(/^[^:]+:\s*/i, "").trim();
      continue;
    }
    if (!normalized.material && /^(chat lieu|material)\s*:\s*/.test(lowered)) {
      normalized.material = line.replace(/^[^:]+:\s*/i, "").trim();
      continue;
    }
    if (!normalized.packSize && /^(quy cach|pack size)\s*:\s*/.test(lowered)) {
      normalized.packSize = line.replace(/^[^:]+:\s*/i, "").trim();
      continue;
    }
    if (!normalized.condition && /^(tinh trang|condition)\s*:\s*/.test(lowered)) {
      normalized.condition = line.replace(/^[^:]+:\s*/i, "").trim();
      continue;
    }
  }

  return normalized;
}

function buildFactsFromSuggestion({ suggestion = {}, category = "other", lang = "vi", images = [] }) {
  const rawFacts = sanitizeFacts(suggestion?.facts || {});
  const parsedFromAttributes = parseFactsAttributeLines(sanitizeAttributes(suggestion?.attributes, 8));
  const merged = {
    ...rawFacts,
    ...parsedFromAttributes,
    keySpecs: rawFacts.keySpecs,
    specialFeatures: rawFacts.specialFeatures,
    advanced: rawFacts.advanced
  };

  if (!merged.brandName) {
    const generatedName = sanitizeText(suggestion?.generatedProductName || "");
    const brandCandidate = generatedName.split(/\s+/)[0] || "";
    if (/^[A-Za-z][A-Za-z0-9-]{2,16}$/.test(brandCandidate)) {
      merged.brandName = brandCandidate;
    }
  }

  if (!merged.sizeInfo) {
    const fromAttrs = (Array.isArray(suggestion?.attributes) ? suggestion.attributes : [])
      .map((item) => sanitizeText(item?.value || ""))
      .find((line) => /\b\d{1,4}\s?(?:inch|in|"|cm|mm|m|ml|l|kg|g|hz|mah|w)\b/i.test(line));
    if (fromAttrs) {
      merged.sizeInfo = fromAttrs.match(/\b\d{1,4}\s?(?:inch|in|"|cm|mm|m|ml|l|kg|g|hz|mah|w)\b/i)?.[0] || "";
    }
  }

  if (!merged.targetUseContext) {
    merged.targetUseContext = sanitizeText(suggestion?.targetCustomer || "").slice(0, 140);
  }

  if (normalizeCategory(category, "other") === "fragrance") {
    const isVi = lang === "vi";
    if (!merged.targetUseContext) {
      merged.targetUseContext = isVi
        ? "Người dùng cần mùi hương dùng hằng ngày hoặc đi làm/đi chơi"
        : "Users seeking a daily or occasion-ready fragrance";
    }
    if (!merged.specialFeatures.length) {
      merged.specialFeatures = sanitizeStringArray([
        isVi ? "Mùi hương dễ dùng" : "Wearable fragrance profile",
        isVi ? "Phù hợp nhiều dịp" : "Suitable for multiple occasions"
      ], 4, 120);
    }
    if (!merged.keySpecs.length) {
      merged.keySpecs = sanitizeStringArray([
        isVi ? "Ưu tiên cảm nhận mùi trong thực tế sử dụng" : "Focus on practical scent experience"
      ], 4, 120);
    }
  }

  if ((!merged.keySpecs || !merged.keySpecs.length) && Array.isArray(suggestion?.highlights)) {
    merged.keySpecs = sanitizeStringArray(suggestion.highlights, 4, 120);
  }

  if ((!merged.specialFeatures || !merged.specialFeatures.length) && Array.isArray(suggestion?.attributes)) {
    merged.specialFeatures = sanitizeStringArray(
      suggestion.attributes.map((item) => sanitizeText(item?.value || "")),
      4,
      120
    );
  }

  if (!SUGGEST_ADVANCED_KEYS.some((key) => sanitizeText(merged.advanced?.[key] || ""))) {
    const safeCategory = normalizeCategory(category, "other");
    const isVi = lang === "vi";
    if (["electronics", "computerOffice", "phoneTablet", "cameraDrone", "autoMoto", "digitalGoods"].includes(safeCategory)) {
      merged.advanced.specs = sanitizeText((merged.keySpecs || []).join("; ")).slice(0, 180);
      merged.advanced.compatibility = merged.targetUseContext || (isVi ? "Phù hợp nhu cầu dùng hằng ngày" : "Fits everyday usage needs");
      merged.advanced.warranty = merged.condition || "";
    } else if (["home", "furnitureDecor", "homeAppliances", "toolsHardware", "householdEssentials"].includes(safeCategory)) {
      merged.advanced.dimensions = merged.sizeInfo || "";
      merged.advanced.usageSpace = merged.targetUseContext || "";
      merged.advanced.warranty = merged.condition || "";
    } else if (["skincare", "beautyTools", "healthCare", "motherBaby"].includes(safeCategory)) {
      merged.advanced.usage = merged.targetUseContext || "";
      merged.advanced.skinConcern = sanitizeText((merged.specialFeatures || [])[0] || "");
      merged.advanced.routineStep = sanitizeText((merged.keySpecs || [])[0] || "");
    } else if (["fashion", "footwear", "bags", "accessories", "fragrance"].includes(safeCategory)) {
      merged.advanced.sizeGuide = merged.sizeInfo || "";
      merged.advanced.careGuide = merged.material
        ? (isVi ? `Chất liệu tham chiếu: ${merged.material}` : `Material reference: ${merged.material}`)
        : "";
      merged.advanced.exchangePolicy = merged.condition || "";
    }
  }

  const evidenceScore = Number(suggestion?.confidence || 0);
  merged.evidenceLevel = evidenceScore >= 0.76 ? "high" : evidenceScore >= 0.56 ? "medium" : "low";
  return sanitizeFacts(merged);
}

function normalizeCategory(value, fallback = "other") {
  const category = sanitizeText(value);
  return VALID_SUGGEST_CATEGORIES.has(category) ? category : fallback;
}

function isUnknownName(name = "") {
  const normalized = normalizeForSignal(name);
  if (!normalized) return true;
  return /khong nhan dang ten san pham duoc|unable to identify product name|khong xac dinh duoc ten san pham/.test(normalized);
}

const GENERIC_GENERATED_NAME_MARKERS = new Set([
  "san pham",
  "product",
  "item",
  "mat hang",
  "hang hoa",
  "device",
  "thiet bi"
]);

function isLikelyGenericGeneratedName(name = "") {
  const normalized = normalizeForSignal(name);
  if (!normalized) return true;
  if (isUnknownName(normalized)) return true;
  if (GENERIC_GENERATED_NAME_MARKERS.has(normalized)) return true;

  const tokenCount = normalized.split(/\s+/).filter(Boolean).length;
  if (tokenCount <= 2 && GENERIC_GENERATED_NAME_MARKERS.has(normalized)) {
    return true;
  }

  return false;
}

function buildFactBasedGeneratedName({ facts = {}, category = "other", lang = "vi" } = {}) {
  const source = sanitizeFacts(facts || {});
  const brand = sanitizeText(source.brandName || "");
  const model = sanitizeText(source.modelName || "");
  const sizeInfo = sanitizeText(source.sizeInfo || "");
  const color = sanitizeText(source.color || "");
  const material = sanitizeText(source.material || "");

  const hasIdentitySignal = Boolean(brand || model);
  const hasSizeSignal = Boolean(sizeInfo && /\d/.test(sizeInfo));
  if (!hasIdentitySignal && !hasSizeSignal) {
    return "";
  }

  const brandKey = normalizeForSignal(brand);
  const modelKey = normalizeForSignal(model);
  const modelContainsBrand = Boolean(brandKey && modelKey && modelKey.includes(brandKey));

  const parts = [];
  const seen = new Set();
  const pushUnique = (value) => {
    const clean = sanitizeText(value || "");
    if (!clean) return;
    const key = normalizeForSignal(clean);
    if (!key || seen.has(key)) return;
    seen.add(key);
    parts.push(clean);
  };

  if (!modelContainsBrand) pushUnique(brand);
  pushUnique(model);

  if (hasSizeSignal) {
    pushUnique(sizeInfo);
  }
  pushUnique(color);
  if (!hasSizeSignal && !color && material && hasIdentitySignal) {
    pushUnique(material);
  }

  let candidate = sanitizeText(parts.join(" ")).slice(0, 120);
  if ((!candidate || isLikelyGenericGeneratedName(candidate)) && hasIdentitySignal) {
    const identityOnly = sanitizeText([
      modelContainsBrand ? "" : brand,
      model,
      hasSizeSignal ? sizeInfo : "",
      color
    ].filter(Boolean).join(" ")).slice(0, 120);
    if (identityOnly && !isLikelyGenericGeneratedName(identityOnly)) {
      candidate = identityOnly;
    }
  }

  if (!candidate || isUnknownName(candidate) || isLikelyGenericGeneratedName(candidate)) {
    return "";
  }

  return candidate;
}

function buildBestEffortPrefill(category, lang) {
  const isVi = lang === "vi";
  if (["electronics", "phoneTablet", "computerOffice", "cameraDrone"].includes(category)) {
    return {
      targetCustomer: isVi ? "Người mua online cần sản phẩm công nghệ dùng thực tế mỗi ngày" : "Online buyers looking for practical daily tech usage",
      shortDescription: isVi ? "Ưu tiên trải nghiệm dùng thực tế, dễ hiểu và dễ so sánh trước khi mua." : "Prioritize practical day-to-day usage and easy comparison before purchase.",
      highlights: isVi
        ? ["Nhấn vào lợi ích dùng thật", "Ưu tiên thông tin dễ hiểu", "Tối ưu quyết định mua nhanh"]
        : ["Focus on real usage benefits", "Keep details easy to understand", "Optimize quick buying decisions"],
      attributes: isVi
        ? [{ type: 0, value: "Công năng chính" }, { type: 1, value: "Trải nghiệm thực tế" }, { type: 2, value: "Độ phù hợp nhu cầu" }]
        : [{ type: 0, value: "Core function" }, { type: 1, value: "Real-world experience" }, { type: 2, value: "Need fit" }]
    };
  }

  if (["fashion", "footwear", "bags", "accessories"].includes(category)) {
    return {
      targetCustomer: isVi ? "Khách hàng muốn món đồ dễ phối, dễ mặc và hợp nhu cầu hằng ngày" : "Buyers who want easy-to-style, everyday-friendly items",
      shortDescription: isVi ? "Ưu tiên cảm giác sử dụng và khả năng phối đồ trong bối cảnh thực tế." : "Focus on wearing comfort and practical styling in real contexts.",
      highlights: isVi
        ? ["Dễ phối nhiều hoàn cảnh", "Nhấn vào cảm giác dùng thật", "Giữ mô tả ngắn và cuốn"]
        : ["Easy to style in many contexts", "Highlight real usage feel", "Keep copy concise and catchy"],
      attributes: isVi
        ? [{ type: 0, value: "Form/kiểu dáng" }, { type: 1, value: "Chất liệu/cảm giác" }, { type: 2, value: "Ngữ cảnh sử dụng" }]
        : [{ type: 0, value: "Fit/style" }, { type: 1, value: "Material/feel" }, { type: 2, value: "Use context" }]
    };
  }

  return {
    targetCustomer: isVi ? "Khách mua online cần thông tin rõ, dễ hiểu và đúng nhu cầu thực tế" : "Online buyers who need clear, practical product information",
    shortDescription: isVi ? "Gợi ý theo hướng thực dụng để bạn chỉnh nhanh thành bản mô tả phù hợp." : "Practical best-effort suggestion so you can quickly refine your final copy.",
    highlights: isVi
      ? ["Giữ thông tin rõ ràng", "Ưu tiên lợi ích chính", "Tối ưu để chỉnh sửa nhanh"]
      : ["Keep information clear", "Prioritize key benefits", "Optimize for quick refinement"],
    attributes: isVi
      ? [{ type: 0, value: "Đặc điểm chính" }, { type: 1, value: "Lợi ích sử dụng" }, { type: 2, value: "Đối tượng phù hợp" }]
      : [{ type: 0, value: "Core trait" }, { type: 1, value: "Usage benefit" }, { type: 2, value: "Best-fit audience" }]
  };
}

function getImageNameSignalText(images = []) {
  return (Array.isArray(images) ? images : [])
    .map((image) => normalizeForSignal(String(image?.name || "").replace(/[_-]+/g, " ")))
    .filter(Boolean)
    .join(" ");
}

function toBrandDisplayName(raw = "") {
  const value = String(raw || "").trim();
  if (!value) return "";
  if (value.toLowerCase() === "ysl") return "YSL";
  if (value.toLowerCase() === "mac") return "MAC";
  if (value.toLowerCase() === "msi") return "MSI";
  if (value.toLowerCase() === "lg") return "LG";
  if (value.toLowerCase() === "hp") return "HP";
  if (value.toLowerCase() === "aoc") return "AOC";
  return value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
}

function escapeRegex(value = "") {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function combineNameWithBrand(baseName = "", brand = "", lang = "vi") {
  const name = sanitizeText(baseName || "");
  const safeBrand = sanitizeText(brand || "");
  if (!safeBrand) return name;
  if (!name) return safeBrand;
  if (new RegExp(`\\b${escapeRegex(safeBrand)}\\b`, "i").test(name)) {
    return name;
  }
  return lang === "vi" ? `${name} ${safeBrand}` : `${safeBrand} ${name}`;
}

function inferBrandFromImageFileName(images = []) {
  const signal = getImageNameSignalText(images);
  if (!signal) return "";
  const tokens = signal.split(/[^a-z0-9]+/).filter(Boolean);
  const hints = [...IMAGE_FILE_BRAND_HINTS].sort((left, right) => right.length - left.length);

  for (const hint of hints) {
    const escaped = escapeRegex(hint);
    const regex = new RegExp(`(^|\\b)${escaped}(\\b|$)`, "i");
    if (regex.test(signal)) {
      return toBrandDisplayName(hint);
    }

    const fromToken = tokens.find((token) => {
      if (token === hint) return true;
      if (!token.startsWith(hint)) return false;
      const suffix = token.slice(hint.length);
      if (!suffix) return false;
      return /^\d{1,4}[a-z0-9]*$/i.test(suffix);
    });
    if (fromToken) {
      return toBrandDisplayName(hint);
    }
  }
  return "";
}

function inferColorFromImageFileName(images = [], lang = "vi") {
  const signal = getImageNameSignalText(images);
  if (!signal) return "";
  const isVi = lang === "vi";
  const colors = [
    { pattern: /\bblack\b|\bden\b/, vi: "Đen", en: "Black" },
    { pattern: /\bwhite\b|\btrang\b/, vi: "Trắng", en: "White" },
    { pattern: /\bgray\b|\bgrey\b|\bxam\b/, vi: "Xám", en: "Gray" },
    { pattern: /\bblue\b|\bxanh\s*duong\b|\bxanhduong\b/, vi: "Xanh dương", en: "Blue" },
    { pattern: /\bred\b|\bdo\b/, vi: "Đỏ", en: "Red" },
    { pattern: /\bpink\b|\bhong\b/, vi: "Hồng", en: "Pink" },
    { pattern: /\bgold\b|\bvang\b/, vi: "Vàng", en: "Gold" },
    { pattern: /\bsilver\b|\bbac\b/, vi: "Bạc", en: "Silver" }
  ];
  for (const item of colors) {
    if (item.pattern.test(signal)) {
      return isVi ? item.vi : item.en;
    }
  }
  return "";
}

function inferSizeFromImageFileName(images = []) {
  const signal = getImageNameSignalText(images);
  if (!signal) return "";
  const directMatch = signal.match(/\b\d{1,3}(?:[.,]\d{1,2})?\s?(?:inch|in|cm|mm|ml|l|kg|g|hz|mah|w)\b/i);
  if (directMatch?.[0]) {
    return directMatch[0].replace(/\s+/g, " ").trim();
  }
  return "";
}

function inferProductNameFromImageFileName(images = [], lang = "vi", categoryHint = "other") {
  const signal = getImageNameSignalText(images);
  const isVi = lang === "vi";
  const brand = inferBrandFromImageFileName(images);
  if (!signal) {
    return "";
  }

  if (IMAGE_FILE_HINT_PATTERNS.monitor.test(signal)) {
    return combineNameWithBrand(isVi ? "Màn hình máy tính" : "Computer monitor", brand, lang);
  }
  if (IMAGE_FILE_HINT_PATTERNS.headphone.test(signal)) {
    return combineNameWithBrand(isVi ? "Tai nghe không dây" : "Wireless headphones", brand, lang);
  }
  if (IMAGE_FILE_HINT_PATTERNS.keyboard.test(signal)) {
    return combineNameWithBrand(isVi ? "Bàn phím máy tính" : "Computer keyboard", brand, lang);
  }
  if (IMAGE_FILE_HINT_PATTERNS.mouse.test(signal)) {
    return combineNameWithBrand(isVi ? "Chuột máy tính" : "Computer mouse", brand, lang);
  }
  if (IMAGE_FILE_HINT_PATTERNS.laptop.test(signal)) {
    return combineNameWithBrand(isVi ? "Laptop" : "Laptop", brand, lang);
  }
  if (IMAGE_FILE_HINT_PATTERNS.phone.test(signal)) {
    return combineNameWithBrand(isVi ? "Điện thoại thông minh" : "Smartphone", brand, lang);
  }
  if (IMAGE_FILE_HINT_PATTERNS.sleepwear.test(signal)) {
    return combineNameWithBrand(isVi ? "Bộ quần áo ngủ" : "Sleepwear set", brand, lang);
  }
  if (IMAGE_FILE_HINT_PATTERNS.skincare.test(signal)) {
    return combineNameWithBrand(isVi ? "Sản phẩm chăm sóc da" : "Skincare product", brand, lang);
  }
  if (/guerlain|chanel|dior|ysl|perfume|fragrance|nuoc\s*hoa/.test(signal)) {
    return combineNameWithBrand(isVi ? "Nước hoa" : "Perfume", brand || "Guerlain", lang);
  }

  if (categoryHint && categoryHint !== "other") {
    return combineNameWithBrand(buildGeneratedNameFallback(categoryHint, lang), brand, lang);
  }
  return combineNameWithBrand(isVi ? "Sản phẩm" : "Product", brand, lang);
}

function buildSignalAwareBestEffortPrefill(category, lang, images = []) {
  const base = buildBestEffortPrefill(category, lang);
  const signal = getImageNameSignalText(images);
  const isVi = lang === "vi";

  if (category === "computerOffice" && IMAGE_FILE_HINT_PATTERNS.monitor.test(signal)) {
    return {
      targetCustomer: isVi
        ? "Nhân viên văn phòng, designer và creator cần màn hình rõ nét để làm việc lâu không mỏi mắt"
        : "Office workers, designers, and creators needing clear display quality for long sessions",
      shortDescription: isVi
        ? "Định hướng nội dung theo trải nghiệm hiển thị thực tế: rõ chữ, dễ nhìn lâu, và dễ ghép setup làm việc."
        : "Position around real display usage: clear text, comfortable long viewing, and easy desk setup fit.",
      highlights: isVi
        ? ["Nhấn lợi ích hiển thị rõ và dễ nhìn lâu", "Đưa bối cảnh dùng thật: làm việc, học tập, giải trí", "Tập trung sự tiện khi kết nối vào setup sẵn có"]
        : ["Emphasize clear visuals and long-view comfort", "Anchor copy in real usage contexts", "Highlight easy integration into existing setups"],
      attributes: isVi
        ? [{ type: 0, value: "Trải nghiệm hiển thị thực tế" }, { type: 1, value: "Độ phù hợp góc làm việc" }, { type: 2, value: "Sự tiện khi kết nối và sử dụng" }]
        : [{ type: 0, value: "Real display experience" }, { type: 1, value: "Workspace fit" }, { type: 2, value: "Connection and usage convenience" }]
    };
  }

  if (category === "electronics" && IMAGE_FILE_HINT_PATTERNS.headphone.test(signal)) {
    return {
      targetCustomer: isVi
        ? "Người dùng di chuyển nhiều cần tai nghe gọn nhẹ, đeo thoải mái và nghe rõ mỗi ngày"
        : "On-the-go users needing compact, comfortable headphones with reliable daily audio",
      shortDescription: isVi
        ? "Ưu tiên lợi ích nghe thực tế: rõ tiếng, đeo lâu dễ chịu, tiện mang theo khi làm việc và di chuyển."
        : "Focus on practical audio benefits: clarity, long-wear comfort, and portability for daily movement.",
      highlights: isVi
        ? ["Nhấn trải nghiệm nghe rõ trong ngữ cảnh hằng ngày", "Tập trung cảm giác đeo và độ tiện mang theo", "Giữ thông điệp gọn, dễ hiểu, dễ chốt nhanh"]
        : ["Emphasize clarity in real-life listening contexts", "Highlight comfort and portability", "Keep messaging concise and conversion-friendly"],
      attributes: isVi
        ? [{ type: 0, value: "Độ rõ trải nghiệm âm thanh" }, { type: 1, value: "Cảm giác đeo khi dùng lâu" }, { type: 2, value: "Tính tiện khi di chuyển" }]
        : [{ type: 0, value: "Audio clarity experience" }, { type: 1, value: "Long-wear comfort" }, { type: 2, value: "On-the-go convenience" }]
    };
  }

  if (category === "fashion" && IMAGE_FILE_HINT_PATTERNS.sleepwear.test(signal)) {
    return {
      targetCustomer: isVi
        ? "Khách hàng cần đồ mặc nhà thoải mái, dễ vận động và hợp dùng mỗi ngày"
        : "Shoppers needing comfortable, easy-moving homewear for daily use",
      shortDescription: isVi
        ? "Định hướng theo cảm giác mặc thực tế: thoải mái, dễ chịu, và dễ dùng trong sinh hoạt tại nhà."
        : "Position around real wearing comfort: ease, softness, and practical daily home use.",
      highlights: isVi
        ? ["Nhấn cảm giác mặc thoải mái trong sinh hoạt hằng ngày", "Giữ mô tả ngắn, tập trung trải nghiệm dùng thật", "Tối ưu thông điệp dễ hiểu và dễ chốt"]
        : ["Emphasize comfort in real daily routines", "Keep copy concise and experience-focused", "Optimize for clear, easy purchase decisions"],
      attributes: isVi
        ? [{ type: 0, value: "Cảm giác mặc khi dùng hằng ngày" }, { type: 1, value: "Độ linh hoạt khi vận động" }, { type: 2, value: "Bối cảnh sử dụng tại nhà" }]
        : [{ type: 0, value: "Daily wearing comfort" }, { type: 1, value: "Movement flexibility" }, { type: 2, value: "Home usage context" }]
    };
  }

  return base;
}

function buildNormalizedSuggestion({ aiSuggestion, inferredCategory, productName, lang, isWeakSignal, images = [] }) {
  const categoryFromAi = normalizeCategory(aiSuggestion?.category || "", "other");
  let finalCategory = categoryFromAi !== "other"
    ? categoryFromAi
    : (inferredCategory || "other");
  if (isWeakSignal && inferredCategory && inferredCategory !== "other") {
    finalCategory = inferredCategory;
  }
  const defaults = getMarketplaceDefaults(finalCategory, undefined);
  const bestEffort = buildBestEffortPrefill(finalCategory, lang);
  const generatedName = sanitizeText(aiSuggestion?.generatedProductName || "");

  const notes = dropNoDataLikeNotes(aiSuggestion?.notes || []);
  const weakSignalNote = getSuggestAnalysisNote(lang, "weak");
  const successNote = getSuggestAnalysisNote(lang, "success");

  const normalized = {
    category: finalCategory,
    group: getCategoryGroupValue(finalCategory),
    tone: clampNumber(aiSuggestion?.tone, 0, 3, defaults.tone),
    channel: clampNumber(aiSuggestion?.channel, 0, 3, defaults.channel),
    mood: clampNumber(aiSuggestion?.mood, 0, 3, defaults.mood),
    brandStyle: clampNumber(aiSuggestion?.brandStyle, 0, 3, defaults.brandStyle),
    generatedProductName: !isUnknownName(generatedName)
      ? generatedName
      : (sanitizeText(productName) || getUnknownGeneratedName(lang)),
    targetCustomer: sanitizeText(aiSuggestion?.targetCustomer || "") || bestEffort.targetCustomer,
    shortDescription: sanitizeText(aiSuggestion?.shortDescription || "") || bestEffort.shortDescription,
    highlights: sanitizeStringArray(aiSuggestion?.highlights, 5, 90).length
      ? sanitizeStringArray(aiSuggestion?.highlights, 5, 90)
      : bestEffort.highlights,
    attributes: sanitizeAttributes(aiSuggestion?.attributes, 5).length
      ? sanitizeAttributes(aiSuggestion?.attributes, 5)
      : bestEffort.attributes,
    confidence: clampNumber(aiSuggestion?.confidence, 0, 1, isWeakSignal ? 0.48 : 0.62),
    analysisState: isWeakSignal ? "best_effort" : "ok",
    notes: (isWeakSignal ? [weakSignalNote, ...notes] : [successNote, ...notes]).slice(0, 4)
  };

  if (finalCategory === "phoneTablet" && shouldPreferPhoneAccessoryPreset({
    productName,
    generatedProductName: normalized.generatedProductName,
    shortDescription: normalized.shortDescription,
    highlights: normalized.highlights,
    attributes: normalized.attributes
  })) {
    normalized.notes = [
      ...(Array.isArray(normalized.notes) ? normalized.notes : []),
      lang === "vi"
        ? "Đã ưu tiên template phụ kiện điện thoại/tablet theo tín hiệu ốp/kính/sạc từ ảnh và tên sản phẩm."
        : "Preferred phone/tablet accessories template based on case/screen/charging signals from image and product name."
    ].slice(0, 4);
  }

  normalized.facts = buildFactsFromSuggestion({
    suggestion: {
      ...normalized,
      facts: aiSuggestion?.facts || {}
    },
    category: normalized.category,
    lang,
    images
  });
  return finalizeSuggestionByImageSignals(normalized, { images, lang });
}

function buildRuntimeHeuristicSuggestion({ productName = "", lang = "vi", inferredCategory = "other" }) {
  const category = VALID_SUGGEST_CATEGORIES.has(inferredCategory) ? inferredCategory : "other";
  const defaults = getMarketplaceDefaults(category, undefined);
  const bestEffort = buildBestEffortPrefill(category, lang);

  const suggestion = {
    category,
    group: getCategoryGroupValue(category),
    tone: clampNumber(defaults.tone, 0, 3, 0),
    channel: clampNumber(defaults.channel, 0, 3, 2),
    mood: clampNumber(defaults.mood, 0, 3, 0),
    brandStyle: clampNumber(defaults.brandStyle, 0, 3, 0),
    generatedProductName: sanitizeText(productName) || getUnknownGeneratedName(lang),
    targetCustomer: bestEffort.targetCustomer,
    shortDescription: bestEffort.shortDescription,
    highlights: bestEffort.highlights,
    attributes: bestEffort.attributes,
    confidence: category === "other" ? 0.42 : 0.56,
    analysisState: "best_effort",
    notes: [
      getSuggestAnalysisNote(lang, "weak")
    ]
  };
  suggestion.facts = buildFactsFromSuggestion({ suggestion, category: suggestion.category, lang, images: [] });
  return finalizeSuggestionByImageSignals(suggestion, { images: [], lang });
}

function applySuggestionFactsToAdvancedFields(suggestion = {}, category = "other") {
  const source = suggestion && typeof suggestion === "object" ? suggestion : {};
  const facts = source.facts && typeof source.facts === "object" ? source.facts : sanitizeFacts({});
  const advanced = facts.advanced && typeof facts.advanced === "object" ? facts.advanced : {};

  const specsParts = [
    sanitizeText(advanced.specs || ""),
    sanitizeText(Array.isArray(facts.keySpecs) ? facts.keySpecs.join("; ") : "")
  ].filter(Boolean);
  const uniqueSpecsParts = [];
  const seenSpecs = new Set();
  for (const part of specsParts) {
    const key = normalizeForSignal(part);
    if (!key || seenSpecs.has(key)) continue;
    seenSpecs.add(key);
    uniqueSpecsParts.push(part);
  }
  const specsMerged = sanitizeText(uniqueSpecsParts.join("; "));

  return {
    ...source,
    usage: sanitizeText(advanced.usage || source.usage || ""),
    skinConcern: sanitizeText(advanced.skinConcern || source.skinConcern || ""),
    routineStep: sanitizeText(advanced.routineStep || source.routineStep || ""),
    dimensions: sanitizeText(advanced.dimensions || source.dimensions || facts.sizeInfo || ""),
    warranty: sanitizeText(advanced.warranty || source.warranty || facts.condition || ""),
    usageSpace: sanitizeText(advanced.usageSpace || source.usageSpace || facts.targetUseContext || ""),
    specs: specsMerged,
    compatibility: sanitizeText(advanced.compatibility || source.compatibility || ""),
    sizeGuide: sanitizeText(advanced.sizeGuide || source.sizeGuide || facts.sizeInfo || ""),
    careGuide: sanitizeText(advanced.careGuide || source.careGuide || facts.material || ""),
    exchangePolicy: sanitizeText(advanced.exchangePolicy || source.exchangePolicy || "")
  };
}

function clearPrefillWhenNameUnknown(suggestion = {}, lang = "vi") {
  const source = suggestion && typeof suggestion === "object" ? suggestion : {};
  if (!isUnknownName(source.generatedProductName || "")) {
    return source;
  }

  const cleared = {
    ...source,
    generatedProductName: getUnknownGeneratedName(lang),
    highlights: [],
    attributes: [],
    facts: sanitizeFacts({}),
    confidence: Math.min(clampNumber(source?.confidence, 0, 1, 0.28), 0.36),
    analysisState: "no_data",
    notes: [
      lang === "vi"
        ? "Chưa nhận dạng được tên sản phẩm từ ảnh. Vui lòng thêm ảnh rõ nét hơn."
        : "Could not identify the product name from the image yet. Please upload clearer photos."
    ]
  };

  return {
    ...cleared,
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
}

function finalizeSuggestionByImageSignals(suggestion = {}, { images = [], lang = "vi" } = {}) {
  const source = suggestion && typeof suggestion === "object" ? suggestion : {};
  const withFacts = {
    ...source,
    facts: buildFactsFromSuggestion({
      suggestion: source,
      category: source.category || "other",
      lang,
      images
    })
  };

  const shaped = applySuggestionFactsToAdvancedFields(withFacts, withFacts.category || "other");
  if (isUnknownName(shaped.generatedProductName || "") || isLikelyGenericGeneratedName(shaped.generatedProductName || "")) {
    const factBasedName = buildFactBasedGeneratedName({
      facts: shaped.facts,
      category: shaped.category || "other",
      lang
    });
    if (factBasedName) {
      shaped.generatedProductName = factBasedName;
    }
  }
  if (isUnknownName(shaped.generatedProductName || "")) {
    return clearPrefillWhenNameUnknown(shaped, lang);
  }
  const hasBrand = Boolean(sanitizeText(shaped?.facts?.brandName || ""));
  const hasColor = Boolean(sanitizeText(shaped?.facts?.color || ""));
  const hasSize = Boolean(sanitizeText(shaped?.facts?.sizeInfo || ""));
  const hasSpecs = Boolean(Array.isArray(shaped?.facts?.keySpecs) && shaped.facts.keySpecs.length > 0);
  const hasSpecial = Boolean(Array.isArray(shaped?.facts?.specialFeatures) && shaped.facts.specialFeatures.length > 0);

  if (hasBrand && !isUnknownName(shaped.generatedProductName || "")) {
    shaped.generatedProductName = combineNameWithBrand(shaped.generatedProductName || "", shaped.facts.brandName, lang);
  }

  const detailCount = Number(hasBrand) + Number(hasColor) + Number(hasSize) + Number(hasSpecs) + Number(hasSpecial);
  const confidenceBoost = Math.min(0.22, detailCount * 0.04);
  const boosted = clampNumber((Number(shaped.confidence || 0) + confidenceBoost), 0, 1, Number(shaped.confidence || 0));
  const floorByDetail = detailCount >= 4 ? 0.78 : detailCount >= 3 ? 0.72 : detailCount >= 2 ? 0.66 : 0.58;
  const cappedConfidence = shaped.category === "other" && detailCount < 3
    ? Math.min(Math.max(boosted, floorByDetail), 0.68)
    : Math.max(boosted, floorByDetail);
  shaped.confidence = cappedConfidence;

  const detailNote = lang === "vi"
    ? `Độ chi tiết nhận diện: ${detailCount}/5 (thương hiệu, màu sắc, kích thước, thông số, thuộc tính).`
    : `Detail coverage: ${detailCount}/5 (brand, color, size, specs, features).`;
  const notes = Array.isArray(shaped.notes) ? shaped.notes : [];
  const hasDetailNote = notes.some((item) => normalizeForSignal(item || "").includes("do chi tiet nhan dien") || normalizeForSignal(item || "").includes("detail coverage"));
  shaped.notes = [
    ...notes,
    ...(hasDetailNote ? [] : [detailNote])
  ].filter(Boolean).slice(0, 4);

  return shaped;
}

function buildAiNameDrivenSuggestion({ rawSuggestion = {}, lang = "vi", images = [], forceNoData = false } = {}) {
  const source = rawSuggestion && typeof rawSuggestion === "object" ? rawSuggestion : {};
  const aiName = sanitizeText(source.generatedProductName || "");
  const sourceNotes = Array.isArray(source.notes)
    ? source.notes.map((item) => sanitizeText(item || "")).filter(Boolean).slice(0, 2)
    : [];
  const unknownName = getUnknownGeneratedName(lang);
  const hasDetectedName = !forceNoData
    && Boolean(aiName)
    && normalizeForSignal(aiName) !== normalizeForSignal(unknownName)
    && !isUnknownName(aiName)
    && !isLikelyGenericGeneratedName(aiName);

  const inferredFromName = hasDetectedName
    ? (inferCategoryFromProductName(aiName) || "")
    : "";
  const finalCategory = normalizeCategory(inferredFromName || "other", "other");
  const defaults = getMarketplaceDefaults(finalCategory, undefined);
  const rawConfidence = clampNumber(source?.confidence, 0, 1, hasDetectedName ? 0.78 : 0.22);

  const baseNotes = hasDetectedName
    ? [lang === "vi"
      ? "Đã nhận dạng tên sản phẩm từ ảnh."
      : "Detected the product name from the image."]
    : [lang === "vi"
      ? "Chưa nhận dạng được tên sản phẩm từ ảnh. Vui lòng thêm ảnh rõ hơn."
      : "Could not identify the product name from the image yet. Please add clearer images."];

  const suggestion = {
    category: finalCategory,
    group: getCategoryGroupValue(finalCategory),
    tone: defaults.tone,
    channel: defaults.channel,
    mood: defaults.mood,
    brandStyle: defaults.brandStyle,
    generatedProductName: hasDetectedName ? aiName : getUnknownGeneratedName(lang),
    targetCustomer: "",
    shortDescription: "",
    highlights: [],
    attributes: [],
    confidence: hasDetectedName
      ? Math.max(rawConfidence, 0.72)
      : Math.min(rawConfidence, 0.36),
    analysisState: hasDetectedName ? "name_detected" : "no_data",
    notes: [...baseNotes, ...sourceNotes].slice(0, 3)
  };

  const sourceFacts = hasDetectedName && source.facts && typeof source.facts === "object"
    ? source.facts
    : {};
  suggestion.facts = buildFactsFromSuggestion({
    suggestion: {
      ...suggestion,
      facts: sourceFacts
    },
    category: suggestion.category,
    lang,
    images
  });

  return finalizeSuggestionByImageSignals(suggestion, { images, lang });
}

function buildRichImageNameFallbackSuggestion({ images = [], lang = "vi", inferredCategory = "other", productName = "" }) {
  const safeCategory = inferredCategory && inferredCategory !== "other" ? inferredCategory : "other";
  const defaults = getMarketplaceDefaults(safeCategory, undefined);
  const prefill = buildBestEffortPrefill(safeCategory, lang);
  const nextName = sanitizeText(productName) || getUnknownGeneratedName(lang);
  const suggestion = {
    category: safeCategory,
    group: getCategoryGroupValue(safeCategory),
    tone: clampNumber(defaults.tone, 0, 3, 0),
    channel: clampNumber(defaults.channel, 0, 3, 2),
    mood: clampNumber(defaults.mood, 0, 3, 0),
    brandStyle: clampNumber(defaults.brandStyle, 0, 3, 0),
    generatedProductName: nextName,
    targetCustomer: prefill.targetCustomer,
    shortDescription: prefill.shortDescription,
    highlights: prefill.highlights,
    attributes: prefill.attributes,
    confidence: safeCategory === "other" ? 0.46 : 0.58,
    analysisState: "best_effort",
    notes: [getSuggestAnalysisNote(lang, "weak")]
  };
  suggestion.facts = buildFactsFromSuggestion({ suggestion, category: suggestion.category, lang, images });
  return finalizeSuggestionByImageSignals(suggestion, { images, lang });
}

function resolveCategorySignals(payload = {}, images = []) {
  const productName = sanitizeText(payload?.productName || "");
  const inferredFromProductName = inferCategoryFromProductName(productName) || "";
  const inferredCategory = inferredFromProductName || "other";
  return {
    inferredCategory,
    inferredFromProductName,
    inferredFromImageName: "",
    inferredFromFileName: "",
    imageNameSignal: ""
  };
}

function resolveFileHintSignals(images = []) {
  const signal = `${getImageNameSignalText(images)} ${getImagePixelSignalText(images)}`.trim();
  if (!signal) {
    return {
      isMonitorLike: false,
      isHeadphoneLike: false,
      isKeyboardLike: false,
      isMouseLike: false,
      isLaptopLike: false,
      isPhoneLike: false,
      isSleepwearLike: false,
      isSkincareLike: false,
      hasComputerDeskCluster: false,
      hasComputerLikeSignal: false
    };
  }

  const isMonitorLike = IMAGE_FILE_HINT_PATTERNS.monitor.test(signal);
  const isHeadphoneLike = IMAGE_FILE_HINT_PATTERNS.headphone.test(signal);
  const isKeyboardLike = IMAGE_FILE_HINT_PATTERNS.keyboard.test(signal);
  const isMouseLike = IMAGE_FILE_HINT_PATTERNS.mouse.test(signal);
  const isLaptopLike = IMAGE_FILE_HINT_PATTERNS.laptop.test(signal);
  const isPhoneLike = IMAGE_FILE_HINT_PATTERNS.phone.test(signal);
  const isSleepwearLike = IMAGE_FILE_HINT_PATTERNS.sleepwear.test(signal);
  const isSkincareLike = IMAGE_FILE_HINT_PATTERNS.skincare.test(signal);
  const hasComputerDeskCluster = isMonitorLike || ((isKeyboardLike || isMouseLike) && (isLaptopLike || isMonitorLike));
  const hasComputerLikeSignal = hasComputerDeskCluster || isMonitorLike || isLaptopLike;

  return {
    isMonitorLike,
    isHeadphoneLike,
    isKeyboardLike,
    isMouseLike,
    isLaptopLike,
    isPhoneLike,
    isSleepwearLike,
    isSkincareLike,
    hasComputerDeskCluster,
    hasComputerLikeSignal
  };
}

function buildFileSignalEvidenceNotes(fileSignals = {}, lang = "vi") {
  const isVi = lang === "vi";
  const entries = [];

  if (fileSignals?.hasComputerLikeSignal) {
    entries.push(isVi
      ? "Tín hiệu nhận diện: tên ảnh có cụm liên quan màn hình/laptop/setup máy tính."
      : "Detection signal: file name includes monitor/laptop/computer-setup terms.");
  }
  if (fileSignals?.isHeadphoneLike) {
    entries.push(isVi
      ? "Tín hiệu nhận diện: tên ảnh có từ khóa tai nghe/audio."
      : "Detection signal: file name includes headphone/audio keywords.");
  }
  if (fileSignals?.isPhoneLike) {
    entries.push(isVi
      ? "Tín hiệu nhận diện: tên ảnh có từ khóa điện thoại/tablet."
      : "Detection signal: file name includes phone/tablet keywords.");
  }
  if (fileSignals?.isSleepwearLike) {
    entries.push(isVi
      ? "Tín hiệu nhận diện: tên ảnh có từ khóa đồ ngủ/sleepwear."
      : "Detection signal: file name includes sleepwear keywords.");
  }
  if (fileSignals?.isSkincareLike) {
    entries.push(isVi
      ? "Tín hiệu nhận diện: tên ảnh có từ khóa skincare/serum/cleanser."
      : "Detection signal: file name includes skincare/serum/cleanser keywords.");
  }

  return entries.slice(0, 2);
}

function refineAiSuggestedCategoryWithFileSignals({ suggestedCategory = "other", inferredCategory = "", fileSignals = {} }) {
  let nextCategory = suggestedCategory || "other";

  if (fileSignals?.hasComputerLikeSignal && ["other", "electronics"].includes(nextCategory)) {
    nextCategory = "computerOffice";
  }

  if (fileSignals?.isHeadphoneLike && ["other", "computerOffice", "phoneTablet"].includes(nextCategory)) {
    nextCategory = "electronics";
  }

  if (fileSignals?.isPhoneLike && ["other", "electronics", "computerOffice"].includes(nextCategory)) {
    nextCategory = "phoneTablet";
  }

  if (fileSignals?.isSleepwearLike && ["other", "home"].includes(nextCategory)) {
    nextCategory = "fashion";
  }

  if (fileSignals?.isSkincareLike && ["other", "beautyTools"].includes(nextCategory)) {
    nextCategory = "skincare";
  }

  if (nextCategory === "other" && inferredCategory && inferredCategory !== "other") {
    nextCategory = inferredCategory;
  }

  return nextCategory;
}

function shouldPreferPhoneAccessoryPreset({ productName = "", highlights = [], attributes = [], shortDescription = "", generatedProductName = "" } = {}) {
  const signal = normalizeForSignal([
    productName,
    generatedProductName,
    shortDescription,
    ...(Array.isArray(highlights) ? highlights : []),
    ...(Array.isArray(attributes) ? attributes.map((item) => (typeof item === "string" ? item : item?.value || "")) : [])
  ].join(" "));

  if (!signal) return false;

  return /(op\s*lung|ốp\s*lưng|phone\s*case|case\s*iphone|case\s*android|cover\s*phone|kinh\s*cuong\s*luc|man\s*hinh\s*cuong\s*luc|phu\s*kien\s*(dien\s*thoai|tablet)|magsafe|gia\s*do\s*(dien\s*thoai|tablet)|sac\s*(dien\s*thoai|tablet)|cap\s*(sac|ket\s*noi))/.test(signal);
}

function buildGeneratedNameFallback(category = "other", lang = "vi") {
  const vi = {
    fashion: "Trang phục thời trang",
    skincare: "Sản phẩm chăm sóc da",
    beautyTools: "Dụng cụ làm đẹp",
    home: "Sản phẩm gia dụng",
    furnitureDecor: "Nội thất và trang trí",
    electronics: "Thiết bị điện tử",
    food: "Sản phẩm thực phẩm",
    footwear: "Giày dép",
    bags: "Túi xách",
    accessories: "Phụ kiện",
    phoneTablet: "Thiết bị điện thoại",
    computerOffice: "Thiết bị máy tính"
  };
  const en = {
    fashion: "Fashion item",
    skincare: "Skincare product",
    beautyTools: "Beauty tool",
    home: "Home product",
    furnitureDecor: "Furniture and decor",
    electronics: "Electronics product",
    food: "Food product",
    footwear: "Footwear",
    bags: "Bag",
    accessories: "Accessory",
    phoneTablet: "Phone or tablet product",
    computerOffice: "Computer office device"
  };

  if (lang === "vi") {
    return vi[category] || "Sản phẩm";
  }
  return en[category] || "Product";
}

function inferCategoryFromImageFileName(images = []) {
  const text = (Array.isArray(images) ? images : [])
    .map((image) => normalizeForSignal(String(image?.name || "").replace(/[_-]+/g, " ")))
    .join(" ")
    .toLowerCase();

  if (!text) return "";
  if (/(monitor|man\s*hinh|manhinh|mahinh|display|screen|lcd|led)/.test(text)) return "computerOffice";
  if (/(shirt|ao|tee|tshirt|thun|hoodie|jacket|dam|vay|dress|quan|jean|skirt)/.test(text)) return "fashion";
  if (/(shoe|sneaker|boot|sandal|giay|dep)/.test(text)) return "footwear";
  if (/(bag|tui|wallet|vi|backpack)/.test(text)) return "bags";
  if (/(earbud|headphone|tai-nghe|tai nghe|speaker|loa)/.test(text)) return "electronics";
  if (/(phone|iphone|android|tablet|ipad|case|op-lung|op lung)/.test(text)) return "phoneTablet";
  if (/(laptop|keyboard|mouse|monitor|pc|office)/.test(text)) return "computerOffice";
  if (/(guerlain|chanel|dior|ysl|perfume|fragrance|nuoc-hoa|nuoc hoa)/.test(text)) return "fragrance";
  if (/(cream|serum|sua-rua|sua rua|skincare|cleanser|toner)/.test(text)) return "skincare";
  if (/(food|snack|coffee|tra|tea|thuc-pham|thuc pham)/.test(text)) return "food";
  if (/(pet|dog|cat|cho|meo)/.test(text)) return "pet";
  if (/(toy|lego|do-choi|do choi)/.test(text)) return "toysGames";
  return "";
}

function estimateImageSignal(image = {}) {
  const src = String(image?.src || "");
  const name = String(image?.name || "").toLowerCase();
  const validDataUrl = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(src) && src.length > MIN_IMAGE_DATA_URL_LENGTH;
  const screenshotLike = /(screenshot|screen-shot|screen_shot|zalo|messenger|facebook|chrome|safari|desktop|capture)/i.test(name);
  const tiny = src.length > 0 && src.length < MIN_STRONG_IMAGE_DATA_URL_LENGTH;
  return {
    validDataUrl,
    screenshotLike,
    tiny,
    strong: validDataUrl && !tiny
  };
}

function extractOpenAiResponseText(response = null) {
  if (!response || typeof response !== "object") {
    return "";
  }

  const output = Array.isArray(response.output) ? response.output : [];
  const textParts = [];

  for (const item of output) {
    if (!item || item.type !== "message") continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!part || part.type !== "output_text") continue;
      const text = sanitizeText(part.text || "");
      if (text) textParts.push(text);
    }
  }

  const fallbackText = sanitizeText(response.output_text || "");
  const merged = sanitizeText([...textParts, fallbackText].filter(Boolean).join("\n"));
  return merged;
}

function parseJsonFromLooseText(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return null;

  const candidates = [
    raw,
    raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // noop
    }
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const snippet = raw.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(snippet);
    } catch {
      return null;
    }
  }

  return null;
}

function parseSseOutputText(rawSseText = "") {
  const source = String(rawSseText || "");
  if (!source || !source.includes("event:")) {
    return "";
  }

  let currentEvent = "";
  let collected = "";
  const lines = source.split(/\r?\n/);

  for (const line of lines) {
    const text = String(line || "");
    if (!text) continue;

    if (text.startsWith("event:")) {
      currentEvent = text.slice(6).trim();
      continue;
    }

    if (!text.startsWith("data:")) {
      continue;
    }

    const payload = text.slice(5).trim();
    if (!payload || payload === "[DONE]") {
      continue;
    }

    let parsed = null;
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }

    const eventType = sanitizeText(parsed?.type || currentEvent);
    if (eventType === "response.output_text.delta") {
      collected += String(parsed?.delta || "");
      continue;
    }

    if (eventType === "response.output_text.done" && !collected) {
      collected = String(parsed?.text || "");
    }
  }

  return sanitizeText(collected);
}

async function fetchModelNameFromImage({ images = [], lang = "vi", requestProductName = "" } = {}) {
  const apiBase = sanitizeText(process.env.AI_API_BASE || "");
  const apiKey = sanitizeText(process.env.AI_API_KEY || "");
  const preferredModel = sanitizeText(process.env.AI_MODEL || "cx/gpt-5.1");
  const modelCandidates = Array.from(new Set([
    preferredModel,
    "cx/gpt-5.1",
    "cx/gpt-5.1-codex",
    "cx/gpt-5.1-codex-max",
    "cx/gpt-5.1-codex-mini-high"
  ].map((item) => sanitizeText(item)).filter(Boolean)));

  if (!apiBase || !apiKey) {
    return {
      generatedProductName: getUnknownGeneratedName(lang),
      confidence: 0.2,
      notes: [lang === "vi"
        ? "Thiếu cấu hình dịch vụ tạo nội dung."
        : "Missing generation service configuration."]
    };
  }

  const validImages = (Array.isArray(images) ? images : [])
    .map((image) => ({
      id: sanitizeText(image?.id || ""),
      name: sanitizeText(image?.name || ""),
      src: sanitizeText(image?.src || "")
    }))
    .filter((image) => /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(image.src))
    .slice(0, 4);

  if (!validImages.length) {
    return {
      generatedProductName: getUnknownGeneratedName(lang),
      confidence: 0.2,
      notes: [lang === "vi"
        ? "Không có ảnh hợp lệ để phân tích."
        : "No valid images available for analysis."]
    };
  }

  const content = [
    {
      type: "input_text",
      text: lang === "vi"
        ? `Phân tích ảnh sản phẩm và trả về JSON hợp lệ theo schema:
{"generatedProductName":"...","confidence":0.0,"notes":["..."]}

Quy tắc:
- Chỉ dựa vào nội dung ảnh.
- Nếu nhận dạng được, generatedProductName phải là tên sản phẩm cụ thể, ngắn gọn.
- Nếu không chắc chắn, generatedProductName phải chính xác là "Không nhận dạng tên sản phẩm được".
- confidence trong khoảng 0..1.
- notes tối đa 2 ý, ngắn gọn.
- Chỉ trả JSON, không thêm text ngoài JSON.
Tên sản phẩm người dùng đã nhập (nếu có): ${requestProductName || "N/A"}`
        : `Analyze product image(s) and return valid JSON using schema:
{"generatedProductName":"...","confidence":0.0,"notes":["..."]}

Rules:
- Use only image evidence.
- If identifiable, generatedProductName must be a concise specific product name.
- If uncertain, generatedProductName must be exactly "Unable to identify product name".
- confidence must be 0..1.
- notes max 2 short items.
- Return JSON only.
User provided product name (if any): ${requestProductName || "N/A"}`
    }
  ];

  for (const image of validImages) {
    content.push({ type: "input_image", image_url: image.src });
  }

  const endpoint = `${apiBase.replace(/\/$/, "")}/responses`;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json"
  };

  if (/openrouter\.ai/i.test(apiBase)) {
    if (process.env.PUBLIC_BASE_URL) {
      headers["HTTP-Referer"] = process.env.PUBLIC_BASE_URL;
    }
    headers["X-Title"] = "gen-script";
  }

  const parseSuggestionFromResponse = (response) => {
    const outputText = extractOpenAiResponseText(response);
    const parsed = parseJsonFromLooseText(outputText);
    const generatedProductName = sanitizeText(parsed?.generatedProductName || "");
    const confidence = clampNumber(parsed?.confidence, 0, 1, 0.2);
    const notes = Array.isArray(parsed?.notes)
      ? parsed.notes.map((item) => sanitizeText(item || "")).filter(Boolean).slice(0, 2)
      : [];

    return {
      generatedProductName,
      confidence,
      notes
    };
  };

  let lastErrorStatus = 0;
  let lastErrorNote = "";
  let lastParsed = null;

  for (const model of modelCandidates) {
    const body = {
      model,
      store: false,
      stream: true,
      instructions: "You are a strict product visual classifier.",
      input: [{ role: "user", content }]
    };

    try {
      const raw = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(body)
      });
      const text = await raw.text();

      if (!raw.ok) {
        lastErrorStatus = Number(raw.status || 0);
        lastErrorNote = lang === "vi"
          ? `Dịch vụ lỗi ${raw.status} khi phân tích ảnh (model: ${model}).`
          : `Service returned ${raw.status} while analyzing image (model: ${model}).`;
        continue;
      }

      let response = null;
      if (text && /^\s*\{/.test(text)) {
        try {
          response = JSON.parse(text);
        } catch {
          response = null;
        }
      }
      const sseOutputText = parseSseOutputText(text);

      const parsed = parseSuggestionFromResponse(response);
      if (!parsed.generatedProductName && sseOutputText) {
        const parsedSseJson = parseJsonFromLooseText(sseOutputText);
        if (parsedSseJson && typeof parsedSseJson === "object") {
          parsed.generatedProductName = sanitizeText(parsedSseJson.generatedProductName || "");
          parsed.confidence = clampNumber(parsedSseJson.confidence, 0, 1, parsed.confidence || 0.2);
          parsed.notes = Array.isArray(parsedSseJson.notes)
            ? parsedSseJson.notes.map((item) => sanitizeText(item || "")).filter(Boolean).slice(0, 2)
            : parsed.notes;
        } else {
          const plainTextName = sanitizeText(sseOutputText).replace(/^['"]+|['"]+$/g, "");
          if (plainTextName && plainTextName.length <= 120) {
            parsed.generatedProductName = plainTextName;
          }
        }
      }
      lastParsed = parsed;

      if (parsed.generatedProductName) {
        return parsed;
      }
    } catch {
      lastErrorStatus = 0;
      lastErrorNote = lang === "vi"
        ? `Không kết nối được dịch vụ để phân tích ảnh (model: ${model}).`
        : `Could not reach the service for image analysis (model: ${model}).`;
    }
  }

  if (lastParsed && lastParsed.generatedProductName) {
    return lastParsed;
  }

  return {
    generatedProductName: getUnknownGeneratedName(lang),
    confidence: 0.2,
    notes: [
      lastErrorNote || (lastErrorStatus
        ? (lang === "vi" ? `Dịch vụ lỗi ${lastErrorStatus} khi phân tích ảnh.` : `Service returned ${lastErrorStatus} while analyzing image.`)
        : (lang === "vi" ? "Dịch vụ không trả về tên sản phẩm hợp lệ." : "Service did not return a valid product name."))
    ]
  };
}

function normalizeLang(value) {
  const normalized = String(value || "vi").toLowerCase().trim();
  return SUGGEST_ERROR_NOTE_BY_LANG[normalized] ? normalized : "vi";
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/suggest-from-images");
  let lang = "vi";
  try {
    const payload = await request.json().catch(() => ({}));
    lang = normalizeLang(payload.lang);
    const images = Array.isArray(payload.images) ? payload.images : [];

    const qualityEntries = images.map((image) => estimateImageSignal(image));
    const hasAnyImagePayload = qualityEntries.some((item) => item.validDataUrl);

    if (!hasAnyImagePayload) {
      const noDataSuggestion = buildAiNameDrivenSuggestion({
        rawSuggestion: {},
        lang,
        images,
        forceNoData: true
      });
      return withRequestId(NextResponse.json({
        suggestion: noDataSuggestion
      }), ctx);
    }

    const scoredEntries = qualityEntries
      .map((quality, index) => ({ quality, image: images[index] }))
      .filter((item) => item.quality.validDataUrl)
      .sort((left, right) => {
        const scoreOf = (quality) => {
          if (!quality) return 0;
          return (quality.validDataUrl ? 1 : 0)
            + (quality.strong ? 1 : 0)
            + (quality.screenshotLike ? 0 : 1)
            + (quality.tiny ? 0 : 1);
        };
        const leftScore = scoreOf(left.quality);
        const rightScore = scoreOf(right.quality);
        return rightScore - leftScore;
      });

    const forwardedImages = scoredEntries.map((item) => item.image).slice(0, 4);

    const rawResult = await fetchModelNameFromImage({
      images: forwardedImages,
      requestProductName: sanitizeText(payload.productName || ""),
      lang
    });

    const result = buildAiNameDrivenSuggestion({
      rawSuggestion: rawResult,
      lang,
      images
    });

    logInfo(ctx, "suggest.from-images.success", {
      confidence: result?.confidence ?? null,
      category: result?.category || "other",
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({ suggestion: result }), ctx);
  } catch (error) {
    const statusCode = Number(error?.statusCode || error?.status || 0);
    const publicReason = statusCode === 401
      ? (lang === "vi" ? "Khóa dịch vụ không hợp lệ hoặc đã hết hạn." : "Service key is invalid or expired.")
      : statusCode === 403
        ? (lang === "vi" ? "Dịch vụ từ chối truy cập (403)." : "Service rejected access (403).")
        : statusCode === 429
          ? (lang === "vi" ? "Dịch vụ đang quá tải (429), vui lòng thử lại sau ít phút." : "Service rate-limited (429), please retry shortly.")
          : statusCode >= 500
            ? (lang === "vi" ? "Dịch vụ đang lỗi máy chủ, vui lòng thử lại sau." : "Service server error, please retry later.")
            : null;

    logError(ctx, "suggest.from-images.failed", error, { ms: elapsedMs(ctx) });
    const baseFallback = buildAiNameDrivenSuggestion({
      rawSuggestion: {},
      lang,
      images: [],
      forceNoData: true
    });
    const enrichedFallbackSuggestion = {
      ...baseFallback,
      notes: [publicReason || SUGGEST_ERROR_NOTE_BY_LANG[lang] || SUGGEST_ERROR_NOTE_BY_LANG.vi]
    };

    return withRequestId(NextResponse.json({
      suggestion: enrichedFallbackSuggestion
    }, {
      status: statusCode >= 400 ? statusCode : 200
    }), ctx);
  }
}
