const VIDEO_STYLE_PRESET_SEQUENCE = [
  "balanced",
  "expert",
  "sales",
  "lifestyle",
  "storytelling",
  "socialproof",
  "comparison",
  "benefitstack",
  "problemfirst",
  "premium",
  "urgencysoft",
  "educational",
  "community",
  "minimalist"
];

const VIDEO_FREE_ALLOWED_STYLE_PRESETS = new Set(["balanced", "expert", "lifestyle"]);

const VIDEO_OPENING_STYLE_BY_PRESET = {
  balanced: 0,
  expert: 4,
  sales: 2,
  lifestyle: 3,
  storytelling: 3,
  socialproof: 4,
  comparison: 1,
  benefitstack: 2,
  problemfirst: 0,
  premium: 4,
  urgencysoft: 2,
  educational: 1,
  community: 4,
  minimalist: 0
};

const VIDEO_DEFAULT_PRESET_BY_OPENING = ["balanced", "comparison", "sales", "storytelling", "socialproof"];

const VIDEO_STYLE_PRESET_LABELS = {
  vi: {
    balanced: "Cân bằng (gọn, an toàn)",
    expert: "Chuyên gia thuyết phục",
    sales: "Chốt sale mạnh",
    lifestyle: "Lifestyle gần gũi",
    storytelling: "Kể chuyện chân thật",
    socialproof: "Chứng thực xã hội",
    comparison: "So sánh trước/sau",
    benefitstack: "Chuỗi lợi ích",
    problemfirst: "Nỗi đau trước",
    premium: "Premium sang trọng",
    urgencysoft: "Khẩn nhẹ",
    educational: "Giáo dục dễ hiểu",
    community: "Cộng đồng tin cậy",
    minimalist: "Tối giản rõ ý"
  },
  en: {
    balanced: "Balanced (safe default)",
    expert: "Expert persuasive",
    sales: "Hard close",
    lifestyle: "Warm lifestyle",
    storytelling: "Storytelling",
    socialproof: "Social proof",
    comparison: "Before/after",
    benefitstack: "Benefit stack",
    problemfirst: "Problem-first",
    premium: "Premium",
    urgencysoft: "Soft urgency",
    educational: "Educational",
    community: "Community",
    minimalist: "Minimalist"
  }
};

function clipInt(value, min = 0, max = 4, fallback = min) {
  const parsed = Number(value);
  const safe = Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
  if (safe < min) return min;
  if (safe > max) return max;
  return safe;
}

function normalizeVideoStylePreset(value, fallback = "balanced") {
  const normalized = String(value || "").trim().toLowerCase();
  if (VIDEO_STYLE_PRESET_SEQUENCE.includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function videoOpeningStyleToPreset(openingStyle = 0) {
  return VIDEO_DEFAULT_PRESET_BY_OPENING[clipInt(openingStyle, 0, 4, 0)] || "balanced";
}

function videoStylePresetToOpeningStyle(stylePreset = "balanced", fallbackOpeningStyle = 0) {
  const normalized = normalizeVideoStylePreset(stylePreset, videoOpeningStyleToPreset(fallbackOpeningStyle));
  const mapped = VIDEO_OPENING_STYLE_BY_PRESET[normalized];
  if (Number.isFinite(Number(mapped))) {
    return clipInt(mapped, 0, 4, 0);
  }
  return clipInt(fallbackOpeningStyle, 0, 4, 0);
}

function coerceVideoStylePresetForPlan(stylePreset = "balanced", isPro = false, fallback = "balanced") {
  const normalized = normalizeVideoStylePreset(stylePreset, fallback);
  if (isPro) return normalized;
  return VIDEO_FREE_ALLOWED_STYLE_PRESETS.has(normalized) ? normalized : "balanced";
}

function coerceVideoStylePresetListForPlan(list = [], isPro = false, fallback = "balanced") {
  const source = Array.isArray(list) ? list : [];
  return source.map((item) => coerceVideoStylePresetForPlan(item, isPro, fallback));
}

function getVideoStylePresetLabel(stylePreset = "balanced", language = "vi") {
  const langKey = language === "vi" ? "vi" : "en";
  const labels = VIDEO_STYLE_PRESET_LABELS[langKey] || VIDEO_STYLE_PRESET_LABELS.vi;
  const normalized = normalizeVideoStylePreset(stylePreset, "balanced");
  return labels[normalized] || labels.balanced;
}

function getVideoStylePresetOptions(language = "vi") {
  return VIDEO_STYLE_PRESET_SEQUENCE.map((preset) => ({
    value: preset,
    label: getVideoStylePresetLabel(preset, language)
  }));
}

export {
  VIDEO_STYLE_PRESET_SEQUENCE,
  VIDEO_FREE_ALLOWED_STYLE_PRESETS,
  normalizeVideoStylePreset,
  videoOpeningStyleToPreset,
  videoStylePresetToOpeningStyle,
  coerceVideoStylePresetForPlan,
  coerceVideoStylePresetListForPlan,
  getVideoStylePresetLabel,
  getVideoStylePresetOptions
};
