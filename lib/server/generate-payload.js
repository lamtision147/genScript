import { categoryOptions } from "@/lib/product-config";

const CATEGORY_VALUES = new Set(categoryOptions.map((item) => item.value));
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
  const highlights = sanitizeHighlights(raw.highlights);
  const attributes = sanitizeAttributes(raw.attributes);
  const images = sanitizeImages(raw.images);

  if (!shortDescription && !highlights.length && !attributes.length && !images.length) {
    throw new RequestValidationError("Hãy thêm mô tả ngắn, highlight, thuộc tính hoặc ảnh để AI tạo nội dung tốt hơn.");
  }

  const improved = Boolean(raw.improved);

  return {
    lang: raw.lang === "en" ? "en" : "vi",
    productName,
    category,
    subcategory: clampInt(raw.subcategory, 0, 99, 0),
    channel: clampInt(raw.channel, 0, 2, 2),
    tone: clampInt(raw.tone, 0, 2, 0),
    brandStyle: clampInt(raw.brandStyle, 0, 3, 0),
    mood: clampInt(raw.mood, 0, 3, 0),
    targetCustomer,
    shortDescription,
    highlights,
    priceSegment,
    attributes,
    images,
    improved,
    previousResult: improved ? sanitizePreviousResult(raw.previousResult) : null
  };
}
