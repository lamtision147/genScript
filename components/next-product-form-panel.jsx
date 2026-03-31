"use client";

import NextImageUploadField from "@/components/next-image-upload-field";
import NextSelectField from "@/components/next-select-field";
import NextTextField from "@/components/next-text-field";
import NextTextareaField from "@/components/next-textarea-field";
import { getCopy } from "@/lib/i18n";

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
  if (tone === 2 && brandStyle === 1 && mood === 3) return "sales";
  if (tone === 0 && brandStyle === 1 && mood === 1) return "lifestyle";
  if (tone === 0 && brandStyle === 0 && mood === 0) return "balanced";
  return "custom";
}

function mapStylePresetValues(preset = "balanced") {
  if (preset === "expert") return { tone: 1, brandStyle: 2, mood: 3 };
  if (preset === "sales") return { tone: 2, brandStyle: 1, mood: 3 };
  if (preset === "lifestyle") return { tone: 0, brandStyle: 1, mood: 1 };
  return { tone: 0, brandStyle: 0, mood: 0 };
}

export default function NextProductFormPanel({
  form,
  categoryOptions,
  channelOptions,
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
  onGenerate,
  loading,
  language = "vi"
}) {
  const highlightsCount = textLineCount(form.highlights);
  const attributesCount = textLineCount(form.attributes);
  const copy = getCopy(language);
  const stylePresetValue = inferStylePresetValue(form);
  const stylePresetOptions = language === "vi"
    ? [
        { value: "balanced", label: "Cân bằng (gọn, an toàn)" },
        { value: "expert", label: "Chuyên gia thuyết phục" },
        { value: "sales", label: "Chốt sale mạnh" },
        { value: "lifestyle", label: "Lifestyle gần gũi" },
        { value: "custom", label: "Tùy chỉnh thủ công" }
      ]
    : [
        { value: "balanced", label: "Balanced (safe default)" },
        { value: "expert", label: "Expert persuasive" },
        { value: "sales", label: "Hard close" },
        { value: "lifestyle", label: "Warm lifestyle" },
        { value: "custom", label: "Custom manual" }
      ];

  function handleStylePresetChange(nextPreset) {
    if (nextPreset === "custom") return;
    const mapped = mapStylePresetValues(nextPreset);
    onFieldChange("tone", mapped.tone);
    onFieldChange("brandStyle", mapped.brandStyle);
    onFieldChange("mood", mapped.mood);
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
        <div className="field-helper">{language === "vi" ? "Mẹo: tải ảnh trước, bấm Gợi ý tự động để AI điền nhanh danh mục, tone và mô tả." : "Tip: upload images first, then click Auto Suggest to prefill category, tone, and description."}</div>
        <div className="field-helper">{language === "vi" ? "Shopee tip: chọn ngành hàng + template ngách để brief sát phân khúc hơn, tỉ lệ chuyển đổi tốt hơn." : "Shopee tip: pick category + niche template for sharper positioning and better conversion."}</div>
            <div className="field-helper group-filter-hint">
              {language === "vi"
                ? "Lọc danh mục theo ngành hàng lớn:"
                : "Filter categories by major vertical:"}
          <span className="tag">{language === "vi" ? "Thời trang, làm đẹp" : "Fashion and beauty"}</span>
          <span className="tag">{language === "vi" ? "Điện tử, công nghệ" : "Electronics and tech"}</span>
          <span className="tag">{language === "vi" ? "Mẹ bé, sức khỏe" : "Mother baby and health"}</span>
          <span className="tag">{language === "vi" ? "Nhà cửa, đời sống" : "Home and living"}</span>
            </div>
            {suggesting ? (
              <div className="analysis-progress-card" role="status" aria-live="polite">
                <div className="analysis-progress-visual" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="analysis-progress-copy">
                  <strong>{language === "vi" ? "Đang phân tích ảnh và đồng bộ form..." : "Analyzing images and syncing form..."}</strong>
                  <span>{language === "vi" ? "Bạn có thể chờ vài giây để AI cập nhật chính xác nhóm ngành, template và mô tả." : "Please wait a few seconds while AI updates category, template and description."}</span>
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
                value={form.subcategory}
                options={currentSubcategories}
                onChange={(value) => onFieldChange("subcategory", Number(value))}
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

        <NextSelectField
          label={copy.form.channel}
          value={form.channel}
          options={channelOptions}
          onChange={(value) => onFieldChange("channel", value)}
        />
            <NextSelectField
              label={language === "vi" ? "Mục tiêu nội dung" : "Content direction"}
              value={stylePresetValue}
              options={stylePresetOptions}
              onChange={handleStylePresetChange}
            />
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
    </section>
  );
}
