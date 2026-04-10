"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import NextImageUploadField from "@/components/next-image-upload-field";
import NextSelectField from "@/components/next-select-field";
import NextTextField from "@/components/next-text-field";
import NextTextareaField from "@/components/next-textarea-field";
import { getCopy } from "@/lib/i18n";
import { routes } from "@/lib/routes";

const FREE_STYLE_PRESET_VALUES = new Set(["balanced", "expert", "lifestyle"]);

function buildGroupedStyleOptions(baseOptions = [], isPro = false, language = "vi") {
  const list = Array.isArray(baseOptions) ? baseOptions : [];
  const freeOptions = list.filter((option) => isFreeAllowedStylePreset(option.value));
  const proOptions = list
    .filter((option) => !isFreeAllowedStylePreset(option.value));

  if (isPro) {
    return [
      {
        label: language === "vi" ? "Phong cách thường" : "Free styles",
        options: freeOptions
      },
      {
        label: language === "vi" ? "Phong cách Pro" : "Pro styles",
        options: proOptions
      }
    ];
  }

  return [
    {
      label: language === "vi" ? "Phong cách thường" : "Free styles",
      options: freeOptions
    },
    {
      label: language === "vi" ? "Phong cách Pro (nâng cấp)" : "Pro styles (upgrade)",
      options: proOptions
    }
  ];
}

function textLineCount(value) {
  if (!value) return 0;
  return String(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function inferStylePresetValue(form = {}) {
  const tone = Number(form?.tone);
  const brandStyle = Number(form?.brandStyle);
  const mood = Number(form?.mood);

  if (tone === 1 && brandStyle === 2 && mood === 3) return "expert";
  if (tone === 1 && brandStyle === 0 && mood === 3) return "expert";
  if (tone === 2 && brandStyle === 1 && mood === 3) return "sales";
  if (tone === 0 && brandStyle === 1 && mood === 1) return "lifestyle";
  if (tone === 0 && brandStyle === 0 && mood === 0) return "balanced";
  return "custom";
}

function normalizeStylePresetValue(value, fallback = "balanced") {
  const normalized = String(value || "").trim().toLowerCase();
  if ([
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
    "minimalist",
    "custom"
  ].includes(normalized)) {
    return normalized;
  }
  return fallback;
}

function isFreeAllowedStylePreset(value) {
  return FREE_STYLE_PRESET_VALUES.has(normalizeStylePresetValue(value, "balanced"));
}

export default function NextProductFormPanel({
  form,
  categoryOptions,
  currentSubcategories,
  groupedSubcategories = [],
  toneOptions,
  brandStyleOptions,
  moodOptions,
  categoryHints,
  industryPresets,
  filteredIndustryPresets,
  selectedIndustryPreset,
  industrySearchKeyword,
  categoryGroupFilter,
  categoryGroupOptions,
  onApplySample,
  onApplyIndustryPreset,
  onClearDraft,
  onCategoryChange,
  onFieldChange,
  onIndustrySearchChange,
  onCategoryGroupFilterChange,
  onImageSelect,
  onRemoveImage,
  onSuggestFromImages,
  suggesting,
  suggestion,
  suggestionPulseToken = 0,
  advancedFieldGroup = "none",
  variantCount = 1,
  variantStylePresets = [],
  sessionPlan = "free",
  onVariantCountChange,
  onVariantStylePresetChange,
  onGenerate,
  loading,
  language = "vi"
}) {
  const highlightsCount = textLineCount(form.highlights);
  const attributesCount = textLineCount(form.attributes);
  const copy = getCopy(language);
  const isPro = String(sessionPlan || "free") === "pro";
  const [showProVariantPopup, setShowProVariantPopup] = useState(false);
  const [requestedProVariantCount, setRequestedProVariantCount] = useState(2);
  const stylePresetValue = inferStylePresetValue(form);
  const [portalReady, setPortalReady] = useState(false);
  const normalizedVariantCount = Math.max(1, Math.min(5, Number(variantCount) || 1));
  const stylePresetOptions = language === "vi"
    ? [
        { value: "balanced", label: "Cân bằng (gọn, an toàn)" },
        { value: "expert", label: "Chuyên gia thuyết phục" },
        { value: "sales", label: "Chốt sale mạnh" },
        { value: "lifestyle", label: "Lifestyle gần gũi" },
        { value: "storytelling", label: "Kể chuyện chân thật" },
        { value: "socialproof", label: "Chứng thực xã hội" },
        { value: "comparison", label: "So sánh trước/sau" },
        { value: "benefitstack", label: "Chuỗi lợi ích" },
        { value: "problemfirst", label: "Nỗi đau trước" },
        { value: "premium", label: "Premium sang trọng" },
        { value: "urgencysoft", label: "Khẩn nhẹ" },
        { value: "educational", label: "Giáo dục dễ hiểu" },
        { value: "community", label: "Cộng đồng tin cậy" },
        { value: "minimalist", label: "Tối giản rõ ý" },
        { value: "custom", label: "Tùy chỉnh thủ công" }
      ]
    : [
        { value: "balanced", label: "Balanced (safe default)" },
        { value: "expert", label: "Expert persuasive" },
        { value: "sales", label: "Hard close" },
        { value: "lifestyle", label: "Warm lifestyle" },
        { value: "storytelling", label: "Storytelling" },
        { value: "socialproof", label: "Social proof" },
        { value: "comparison", label: "Before/after" },
        { value: "benefitstack", label: "Benefit stack" },
        { value: "problemfirst", label: "Problem-first" },
        { value: "premium", label: "Premium" },
        { value: "urgencysoft", label: "Soft urgency" },
        { value: "educational", label: "Educational" },
        { value: "community", label: "Community" },
        { value: "minimalist", label: "Minimalist" },
        { value: "custom", label: "Custom manual" }
      ];
  const stylePresetOptionsForSelect = buildGroupedStyleOptions(stylePresetOptions, isPro, language);
  const variantStylePresetOptions = stylePresetOptions.filter((option) => option.value !== "custom");
  const resolvedVariantStylePresets = (() => {
    const targetCount = isPro ? normalizedVariantCount : 1;
    const inferred = normalizeStylePresetValue(stylePresetValue, "expert");
    const sequence = [
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
    const seed = sequence.includes(inferred) ? inferred : "expert";
    const rotation = [seed, ...sequence.filter((item) => item !== seed)];
    const next = [];

    for (let index = 0; index < targetCount; index += 1) {
      const raw = normalizeStylePresetValue(variantStylePresets?.[index], "");
      if (targetCount > 1) {
        if (sequence.includes(raw)) {
          next.push(raw);
          continue;
        }
        next.push(rotation[index % rotation.length] || "expert");
        continue;
      }
      next.push(raw || inferred);
    }

    return next;
  })();

  useEffect(() => {
    setPortalReady(true);
    return () => setPortalReady(false);
  }, []);

  useEffect(() => {
    if (!showProVariantPopup) return undefined;
    const handleEsc = (event) => {
      if (event.key === "Escape") closeProVariantPopup();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showProVariantPopup]);

  function handleVariantCountSelect(nextCount) {
    const normalized = Math.max(1, Math.min(5, Number(nextCount) || 1));
    if (!isPro && normalized > 1) {
      setRequestedProVariantCount(normalized);
      onVariantCountChange?.(1);
      openProVariantPopup();
      return;
    }
    onVariantCountChange?.(normalized);
  }

  function openProVariantPopup() {
    if (isPro) return;
    setShowProVariantPopup(true);
  }

  function closeProVariantPopup() {
    setShowProVariantPopup(false);
  }

  function handleProPopupBackdropClick(event) {
    if (event.target === event.currentTarget) {
      closeProVariantPopup();
    }
  }

  function renderProUpsellPopup() {
    if (!showProVariantPopup || !portalReady) return null;

    return createPortal(
      <div className="pro-upsell-overlay" role="presentation" onClick={handleProPopupBackdropClick}>
        <div className="pro-upsell-modal" role="dialog" aria-modal="true" aria-labelledby="pro-upsell-title">
          <button type="button" className="pro-upsell-close" onClick={closeProVariantPopup} aria-label={language === "vi" ? "Đóng" : "Close"}>×</button>
          <div className="pro-upsell-badge">
            <span className="pro-upsell-badge-dot" aria-hidden="true" />
            <span className="pro-upsell-badge-text">{language === "vi" ? "Gói PRO" : "PRO PLAN"}</span>
          </div>
          <h3 id="pro-upsell-title" className="pro-upsell-title">
            {language === "vi"
              ? (
                <>
                  Tạo nhiều bản nội dung
                  <br />
                  khác phong cách chỉ với 1 lần bấm
                </>
              )
              : (
                <>
                  Generate multiple content variants
                  <br />
                  with different styles in one click
                </>
              )}
          </h3>
          <p className="pro-upsell-subtitle">
            {language === "vi"
              ? "Để có thể tạo nhiều bản nội dung với nhiều phong cách khác nhau, hãy nâng cấp bản PRO để sử dụng."
              : `You selected ${requestedProVariantCount} variants. Upgrade to PRO to generate multiple style directions from one brief.`}
          </p>
          <ul className="pro-upsell-list">
            <li>{language === "vi" ? "Không giới hạn lượt tạo/cải tiến" : "Unlimited generate/improve requests"}</li>
            <li>{language === "vi" ? "Tạo nhiều bản nội dung với nhiều phong cách cho cùng 1 brief" : "Generate multiple style variants from the same brief"}</li>
            <li>{language === "vi" ? "So sánh theo tab, chốt nhanh bản hiệu quả nhất" : "Compare variants in tabs and pick the best performer fast"}</li>
            <li>{language === "vi" ? "Lưu trữ lịch sử nội dung không giới hạn" : "Unlimited content history storage"}</li>
          </ul>
          <div className="pro-upsell-actions">
            <a className="primary-button pro-upsell-cta" href={routes.upgrade}>
              {language === "vi" ? "Nâng cấp Pro ngay" : "Upgrade to Pro now"}
            </a>
            <button type="button" className="ghost-button" onClick={closeProVariantPopup}>
              {language === "vi" ? "Tiếp tục với 1 bản" : "Continue with 1 variant"}
            </button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="section-title">{copy.form.panelTitle}</h2>
        <div className="user-actions">
          <button type="button" className="ghost-button" onClick={onApplySample}>{copy.form.sampleData}</button>
          <button type="button" className="ghost-button" onClick={onClearDraft}>{copy.form.reset}</button>
        </div>
      </div>
      <section
        className={`panel-section strong form-stage ${suggestion ? "is-suggested" : ""} ${suggestionPulseToken ? "pulse-highlight" : ""}`}
        data-pulse-token={suggestionPulseToken || "0"}
      >
        <div className="field-helper">{language === "vi" ? "Mẹo: tải ảnh trước, bấm Gợi ý tự động để hệ thống điền nhanh danh mục, tone và mô tả." : "Tip: upload images first, then click Auto Suggest to prefill category, tone, and description."}</div>
        <div className="field-helper">{language === "vi" ? "Shopee tip: chọn ngành hàng + template ngách để brief sát phân khúc hơn, tỉ lệ chuyển đổi tốt hơn." : "Shopee tip: pick category + niche template for sharper positioning and better conversion."}</div>
            {suggesting ? (
              <div className="analysis-progress-card" role="status" aria-live="polite">
                <div className="analysis-progress-visual" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="analysis-progress-copy">
                  <strong>{language === "vi" ? "Đang phân tích ảnh và đồng bộ form..." : "Analyzing images and syncing form..."}</strong>
                  <span>{language === "vi" ? "Bạn có thể chờ vài giây để hệ thống cập nhật chính xác nhóm ngành, template và mô tả." : "Please wait a few seconds while the system updates category, template and description."}</span>
                </div>
              </div>
            ) : null}
            <NextImageUploadField
              language={language}
              images={form.images}
              onImageSelect={onImageSelect}
              onRemoveImage={onRemoveImage}
          onSuggestFromImages={onSuggestFromImages}
          suggesting={suggesting}
          suggestion={suggestion}
            />
            <fieldset className="form-lock-zone" disabled={suggesting} aria-busy={suggesting}>
              <NextTextField label={copy.form.productName} value={form.productName} onChange={(value) => onFieldChange("productName", value)} placeholder={copy.form.productNamePlaceholder} />
            <NextSelectField
              label={language === "vi" ? "Nhóm ngành" : "Category group"}
              value={categoryGroupFilter || "fashionBeauty"}
              options={categoryGroupOptions || []}
              onChange={onCategoryGroupFilterChange}
            />
            <div className="form-grid">
              <NextSelectField label={copy.form.category} value={form.category} options={categoryOptions} onChange={onCategoryChange} />
              <NextSelectField
                label={language === "vi" ? "Template ngành hàng" : "Industry template"}
                value={form.industryPreset || filteredIndustryPresets?.[0]?.value || ""}
                options={(filteredIndustryPresets || []).map((item) => ({
                  value: item.value,
                  label: item.label
                }))}
                onChange={(value) => onFieldChange("industryPreset", value)}
              />
            </div>

        <NextTextField label={copy.form.targetCustomer} value={form.targetCustomer} onChange={(value) => onFieldChange("targetCustomer", value)} placeholder={categoryHints[form.category]?.target || categoryHints.other.target} />
        <NextTextareaField label={copy.form.shortDescription} value={form.shortDescription} onChange={(value) => onFieldChange("shortDescription", value)} placeholder={categoryHints[form.category]?.short || categoryHints.other.short} />
        <NextTextareaField
          label={copy.form.highlights}
          value={form.highlights}
          onChange={(value) => onFieldChange("highlights", value)}
          placeholder={categoryHints[form.category]?.highlights || categoryHints.other.highlights}
          helper={copy.form.highlightsHelper(highlightsCount)}
        />
        <NextTextField label={copy.form.priceSegment} value={form.priceSegment} onChange={(value) => onFieldChange("priceSegment", value)} placeholder={copy.form.priceSegmentPlaceholder} />
        <NextTextareaField
          label={copy.form.attributes}
          value={form.attributes}
          onChange={(value) => onFieldChange("attributes", value)}
          placeholder={categoryHints[form.category]?.attrs || categoryHints.other.attrs}
          helper={copy.form.attributesHelper(attributesCount)}
        />
        {advancedFieldGroup === "skincare" ? (
          <>
            <div className="form-grid">
              <NextTextField
                label={copy.form.usage}
                value={form.usage || ""}
                onChange={(value) => onFieldChange("usage", value)}
                placeholder={copy.form.usagePlaceholder}
              />
              <NextTextField
                label={copy.form.skinConcern}
                value={form.skinConcern || ""}
                onChange={(value) => onFieldChange("skinConcern", value)}
                placeholder={copy.form.skinConcernPlaceholder}
              />
            </div>
            <NextTextField
              label={copy.form.routineStep}
              value={form.routineStep || ""}
              onChange={(value) => onFieldChange("routineStep", value)}
              placeholder={copy.form.routineStepPlaceholder}
            />
          </>
        ) : null}
        {advancedFieldGroup === "home" ? (
          <>
            <div className="form-grid">
              <NextTextField
                label={copy.form.dimensions}
                value={form.dimensions || ""}
                onChange={(value) => onFieldChange("dimensions", value)}
                placeholder={copy.form.dimensionsPlaceholder}
              />
              <NextTextField
                label={copy.form.warranty}
                value={form.warranty || ""}
                onChange={(value) => onFieldChange("warranty", value)}
                placeholder={copy.form.warrantyPlaceholder}
              />
            </div>
            <NextTextField
              label={copy.form.usageSpace}
              value={form.usageSpace || ""}
              onChange={(value) => onFieldChange("usageSpace", value)}
              placeholder={copy.form.usageSpacePlaceholder}
            />
          </>
        ) : null}
        {advancedFieldGroup === "electronics" ? (
          <>
            <div className="form-grid">
              <NextTextField
                label={copy.form.specs}
                value={form.specs || ""}
                onChange={(value) => onFieldChange("specs", value)}
                placeholder={copy.form.specsPlaceholder}
              />
              <NextTextField
                label={copy.form.compatibility}
                value={form.compatibility || ""}
                onChange={(value) => onFieldChange("compatibility", value)}
                placeholder={copy.form.compatibilityPlaceholder}
              />
            </div>
            <NextTextField
              label={copy.form.warranty}
              value={form.warranty || ""}
              onChange={(value) => onFieldChange("warranty", value)}
              placeholder={copy.form.warrantyPlaceholder}
            />
          </>
        ) : null}
        {advancedFieldGroup === "fashion" ? (
          <div className="form-grid">
            <NextTextField
              label={copy.form.sizeGuide}
              value={form.sizeGuide || ""}
              onChange={(value) => onFieldChange("sizeGuide", value)}
              placeholder={copy.form.sizeGuidePlaceholder}
            />
            <NextTextField
              label={copy.form.careGuide}
              value={form.careGuide || ""}
              onChange={(value) => onFieldChange("careGuide", value)}
              placeholder={copy.form.careGuidePlaceholder}
            />
          </div>
        ) : null}
        {advancedFieldGroup === "fashion" ? (
          <NextTextField
            label={copy.form.exchangePolicy}
            value={form.exchangePolicy || ""}
            onChange={(value) => onFieldChange("exchangePolicy", value)}
            placeholder={copy.form.exchangePolicyPlaceholder}
          />
        ) : null}

            <div className="variant-inline-control">
              <NextSelectField
                label={language === "vi" ? "Số bản nội dung" : "Content variants"}
                value={String(normalizedVariantCount)}
                options={[
                  { value: "1", label: language === "vi" ? "1 bản" : "1 variant" },
                  { value: "2", label: language === "vi" ? "2 bản (Pro)" : "2 variants (Pro)" },
                  { value: "3", label: language === "vi" ? "3 bản (Pro)" : "3 variants (Pro)" },
                  { value: "4", label: language === "vi" ? "4 bản (Pro)" : "4 variants (Pro)" },
                  { value: "5", label: language === "vi" ? "5 bản (Pro)" : "5 variants (Pro)" }
                ]}
                onChange={(value) => handleVariantCountSelect(Number(value))}
              />

              {isPro && normalizedVariantCount > 1
                ? Array.from({ length: normalizedVariantCount }).map((_, index) => (
                  <NextSelectField
                    key={`variant-style-${index + 1}`}
                    label={language === "vi" ? `Phong cách nội dung bản ${index + 1}` : `Variant ${index + 1} style`}
                    value={resolvedVariantStylePresets[index] || "balanced"}
                    options={variantStylePresetOptions}
                    onChange={(value) => onVariantStylePresetChange?.(index, value)}
                  />
                ))
                : (
                  <NextSelectField
                    label={language === "vi" ? "Phong cách nội dung" : "Content style"}
                    value={resolvedVariantStylePresets[0] || "expert"}
                    options={stylePresetOptionsForSelect}
                    onChange={(value) => {
                      const normalizedValue = normalizeStylePresetValue(value, "balanced");
                      if (!isPro && !isFreeAllowedStylePreset(normalizedValue)) {
                        openProVariantPopup();
                        return;
                      }
                      onVariantStylePresetChange?.(0, normalizedValue);
                    }}
                  />
                )}

              {!isPro ? (
                <p className="field-helper">
                  {language === "vi"
                    ? "Gói Free: dùng 1 bản và 3 phong cách (Cân bằng, Chuyên gia, Lifestyle). Chọn phong cách gắn (Pro) sẽ mở popup nâng cấp."
                    : "Free plan: 1 variant and 3 styles (Balanced, Expert, Lifestyle). Selecting a (Pro) style opens the upgrade popup."}
                </p>
              ) : (
                <p className="field-helper">
                  {language === "vi" ? `Pro: đang tạo ${normalizedVariantCount} bản nội dung.` : `Pro: generating ${normalizedVariantCount} content variants.`}
                </p>
              )}
            </div>

            <details className="advanced-style-details">
              <summary>{language === "vi" ? "Tùy chỉnh nâng cao: Phong cách / Thương hiệu / Mood" : "Advanced: Tone / Brand style / Mood"}</summary>
              <div className="form-grid">
                <NextSelectField label={copy.form.tone} value={form.tone} options={toneOptions} onChange={(value) => onFieldChange("tone", Number(value))} />
                <NextSelectField label={copy.form.brandStyle} value={form.brandStyle} options={brandStyleOptions} onChange={(value) => onFieldChange("brandStyle", Number(value))} />
                <NextSelectField label={copy.form.mood} value={form.mood} options={moodOptions} onChange={(value) => onFieldChange("mood", Number(value))} />
              </div>
            </details>

            </fieldset>
      </section>
      <div className="submit-wrap">
        <button className="primary-button" type="button" onClick={onGenerate}>{loading ? copy.form.generating : copy.form.generate}</button>
      </div>
      {renderProUpsellPopup()}
    </section>
  );
}
