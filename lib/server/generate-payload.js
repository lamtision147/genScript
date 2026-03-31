import { categoryOptions } from "@/lib/product-config";

const CATEGORY_VALUES = new Set(categoryOptions.map((item) => item.value));
const SUPPORTED_LANG_VALUES = new Set(["vi", "en", "zh", "ja", "ko", "es", "fr", "de"]);
const IMAGE_DATA_URL_RE = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;
const MAX_IMAGES = 4;
const MAX_IMAGE_DATA_LENGTH = 8_000_000;

export class RequestValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = "RequestValidationError";
    this.status = status;
  }
}

function cleanText(value, maxLength = 280) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  return normalized.slice(0, maxLength);
}

function cleanListText(value, maxLength = 120) {
  return cleanText(value, maxLength);
}

function toInt(value, fallback = 0) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.floor(next);
}

function clampInt(value, min, max, fallback = min) {
  const next = toInt(value, fallback);
  if (next < min) return min;
  if (next > max) return max;
  return next;
}

function sanitizeHighlights(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((item) => cleanListText(item, 100))
      .filter(Boolean)
      .slice(0, 8);
  }
  return String(raw || "")
    .split(/\n|\||;/)
    .map((item) => cleanListText(item, 100))
    .filter(Boolean)
    .slice(0, 8);
}

function sanitizeAttributes(raw) {
  if (Array.isArray(raw)) {
    return raw
      .map((item, index) => ({
        type: toInt(item?.type, index),
        value: cleanListText(item?.value, 120)
      }))
      .filter((item) => item.value)
      .slice(0, 10);
  }
  return String(raw || "")
    .split("\n")
    .map((value, index) => ({ type: index, value: cleanListText(value, 120) }))
    .filter((item) => item.value)
    .slice(0, 10);
}

function sanitizeImages(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, MAX_IMAGES)
    .map((image, index) => ({
      id: cleanText(image?.id || `image_${index + 1}`, 64),
      name: cleanText(image?.name || `image-${index + 1}`, 120),
      src: String(image?.src || "").trim()
    }))
    .filter((image) => IMAGE_DATA_URL_RE.test(image.src) && image.src.length <= MAX_IMAGE_DATA_LENGTH);
}

function sanitizePreviousResult(raw) {
  if (!raw || typeof raw !== "object") return null;
  const paragraphs = Array.isArray(raw.paragraphs)
    ? raw.paragraphs.map((item) => cleanText(item, 320)).filter(Boolean).slice(0, 3)
    : [];
  const hashtags = Array.isArray(raw.hashtags)
    ? raw.hashtags.map((item) => cleanListText(item, 42)).filter(Boolean).slice(0, 8)
    : [];
  if (!paragraphs.length && !hashtags.length) return null;
  return { paragraphs, hashtags };
}

export function normalizeGeneratePayload(raw) {
  if (!raw || typeof raw !== "object") {
    throw new RequestValidationError("Payload không hợp lệ.");
  }

  const productName = cleanText(raw.productName, 140);
  if (productName.length < 2) {
    throw new RequestValidationError("Vui lòng nhập tên sản phẩm rõ ràng.");
  }

  const category = CATEGORY_VALUES.has(raw.category) ? raw.category : "other";
  const shortDescription = cleanText(raw.shortDescription, 420);
  const targetCustomer = cleanText(raw.targetCustomer, 220);
  const priceSegment = cleanText(raw.priceSegment, 120);
  const usage = cleanText(raw.usage, 220);
  const skinConcern = cleanText(raw.skinConcern, 220);
  const routineStep = cleanText(raw.routineStep, 220);
  const dimensions = cleanText(raw.dimensions, 220);
  const warranty = cleanText(raw.warranty, 220);
  const usageSpace = cleanText(raw.usageSpace, 220);
  const specs = cleanText(raw.specs, 220);
  const compatibility = cleanText(raw.compatibility, 220);
  const sizeGuide = cleanText(raw.sizeGuide, 220);
  const careGuide = cleanText(raw.careGuide, 220);
  const exchangePolicy = cleanText(raw.exchangePolicy, 220);
  const highlights = sanitizeHighlights(raw.highlights);
  const attributes = sanitizeAttributes(raw.attributes);
  const images = sanitizeImages(raw.images);

  if (
    !shortDescription &&
    !highlights.length &&
    !attributes.length &&
    !images.length &&
    !usage &&
    !skinConcern &&
    !routineStep &&
    !dimensions &&
    !warranty &&
    !usageSpace &&
    !specs &&
    !compatibility &&
    !sizeGuide &&
    !careGuide &&
    !exchangePolicy
  ) {
    throw new RequestValidationError("Hãy thêm mô tả ngắn, highlight, thuộc tính hoặc ảnh để AI tạo nội dung tốt hơn.");
  }

  const improved = Boolean(raw.improved);
  const variantCount = clampInt(raw.variantCount, 1, 2, 1);
  const brandPreset = cleanText(raw.brandPreset || "", 48).toLowerCase();

  const normalizedLangRaw = typeof raw.lang === "string" ? raw.lang.toLowerCase().trim() : "vi";
  const normalizedLang = SUPPORTED_LANG_VALUES.has(normalizedLangRaw) ? normalizedLangRaw : "vi";

  return {
    lang: normalizedLang || "vi",
    productName,
    category,
    subcategory: clampInt(raw.subcategory, 0, 99, 0),
    industryPreset: cleanText(raw.industryPreset, 72),
    channel: clampInt(raw.channel, 0, 2, 2),
    tone: clampInt(raw.tone, 0, 2, 0),
    brandStyle: clampInt(raw.brandStyle, 0, 3, 0),
    mood: clampInt(raw.mood, 0, 3, 0),
    targetCustomer,
    shortDescription,
    highlights,
    priceSegment,
    attributes,
    usage,
    skinConcern,
    routineStep,
    dimensions,
    warranty,
    usageSpace,
    specs,
    compatibility,
    sizeGuide,
    careGuide,
    exchangePolicy,
    images,
    variantCount,
    brandPreset,
    improved,
    previousResult: improved ? sanitizePreviousResult(raw.previousResult) : null
  };
}
