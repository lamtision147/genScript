export const LANGUAGE_STORAGE_KEY = "seller-studio-ui-lang";

export const LANGUAGE_OPTIONS = [
  { value: "vi", label: "Tiếng Việt" },
  { value: "en", label: "English" },
  { value: "zh", label: "中文" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" }
];

const SUPPORTED_LANGUAGES = new Set(LANGUAGE_OPTIONS.map((item) => item.value));

export function normalizeLanguage(input) {
  const lang = String(input || "vi").toLowerCase().trim();
  return SUPPORTED_LANGUAGES.has(lang) ? lang : "vi";
}

export function toAiLang(language) {
  return normalizeLanguage(language);
}
