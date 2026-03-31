"use client";

import { getCopy } from "@/lib/i18n";

const BRAND_PRESETS = [
  { value: "minimalist", labels: { vi: "Tối giản", en: "Minimalist" } },
  { value: "premium", labels: { vi: "Cao cấp", en: "Premium" } },
  { value: "conversion", labels: { vi: "Chốt sale", en: "Conversion" } }
];

export default function NextGenerationControls({
  language = "vi",
  brandPreset = "minimalist",
  variantCount = 1,
  onBrandPresetChange,
  onVariantCountChange
}) {
  const copy = getCopy(language);
  const isVi = language === "vi";

  return (
    <section className="generation-controls">
      <div className="generation-control-item">
        <label className="mini-label">{isVi ? "Preset thương hiệu" : "Brand preset"}</label>
        <div className="generation-chip-group">
          {BRAND_PRESETS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              className={`ghost-button generation-chip ${brandPreset === preset.value ? "active" : ""}`}
              onClick={() => onBrandPresetChange?.(preset.value)}
            >
              {preset.labels[language] || preset.labels.en}
            </button>
          ))}
        </div>
      </div>

      <div className="generation-control-item">
        <label className="mini-label">{isVi ? "Số biến thể" : "Variant count"}</label>
        <div className="generation-chip-group">
          {[1, 2].map((count) => (
            <button
              key={count}
              type="button"
              className={`ghost-button generation-chip ${variantCount === count ? "active" : ""}`}
              onClick={() => onVariantCountChange?.(count)}
            >
              {count === 1 ? (isVi ? "1 bản" : "1 variant") : (isVi ? "2 bản A/B" : "2 variants A/B")}
            </button>
          ))}
        </div>
        <p className="field-helper">
          {variantCount === 2
            ? (isVi ? "Hệ thống sẽ tạo 2 bản và chọn bản điểm cao hơn làm kết quả chính." : "System generates 2 variants and auto-picks the higher quality one.")
            : (isVi ? "Tạo 1 bản nhanh theo preset hiện tại." : "Generate a single variant based on current preset.")}
        </p>
      </div>
    </section>
  );
}
