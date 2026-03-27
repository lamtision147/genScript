"use client";

import NextImageUploadField from "@/components/next-image-upload-field";
import NextSelectField from "@/components/next-select-field";
import NextTextField from "@/components/next-text-field";
import NextTextareaField from "@/components/next-textarea-field";

function textLineCount(value) {
  if (!value) return 0;
  return String(value)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean).length;
}

export default function NextProductFormPanel({
  form,
  categoryOptions,
  channelOptions,
  currentSubcategories,
  toneOptions,
  brandStyleOptions,
  moodOptions,
  categoryHints,
  onApplySample,
  onClearDraft,
  onCategoryChange,
  onFieldChange,
  onImageSelect,
  onRemoveImage,
  onGenerate,
  loading
}) {
  const highlightsCount = textLineCount(form.highlights);
  const attributesCount = textLineCount(form.attributes);

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="section-title">Nhập dữ liệu sản phẩm</h2>
        <div className="user-actions">
          <button type="button" className="ghost-button" onClick={onApplySample}>Dữ liệu mẫu</button>
          <button type="button" className="ghost-button" onClick={onClearDraft}>Làm mới</button>
        </div>
      </div>
      <section className="panel-section strong">
        <NextImageUploadField images={form.images} onImageSelect={onImageSelect} onRemoveImage={onRemoveImage} />
        <NextTextField label="Tên sản phẩm" value={form.productName} onChange={(value) => onFieldChange("productName", value)} placeholder="Ví dụ: Set áo cổ sen phối ren và chân váy chữ A" />
        <NextSelectField label="Danh mục sản phẩm" value={form.category} options={categoryOptions} onChange={onCategoryChange} />
        <NextSelectField label="Dòng sản phẩm" value={form.subcategory} options={currentSubcategories} onChange={(value) => onFieldChange("subcategory", Number(value))} />
        <NextSelectField label="Kênh bán" value={form.channel} options={channelOptions} onChange={(value) => onFieldChange("channel", Number(value))} />
        <div className="form-grid">
          <NextSelectField label="Phong cách" value={form.tone} options={toneOptions} onChange={(value) => onFieldChange("tone", Number(value))} />
          <NextSelectField label="Phong cách thương hiệu" value={form.brandStyle} options={brandStyleOptions} onChange={(value) => onFieldChange("brandStyle", Number(value))} />
          <NextSelectField label="Mood nội dung" value={form.mood} options={moodOptions} onChange={(value) => onFieldChange("mood", Number(value))} />
        </div>
        <NextTextField label="Khách hàng mục tiêu" value={form.targetCustomer} onChange={(value) => onFieldChange("targetCustomer", value)} placeholder={categoryHints[form.category]?.target || categoryHints.other.target} />
        <NextTextareaField label="Mô tả ngắn sản phẩm" value={form.shortDescription} onChange={(value) => onFieldChange("shortDescription", value)} placeholder={categoryHints[form.category]?.short || categoryHints.other.short} />
        <NextTextareaField
          label="Điểm nổi bật"
          value={form.highlights}
          onChange={(value) => onFieldChange("highlights", value)}
          placeholder={categoryHints[form.category]?.highlights || categoryHints.other.highlights}
          helper={`Tách mỗi highlight trên 1 dòng (${highlightsCount}/8)`}
        />
        <NextTextField label="Phân khúc giá" value={form.priceSegment} onChange={(value) => onFieldChange("priceSegment", value)} placeholder="Ví dụ: 329k / phân khúc trung cao" />
        <NextTextareaField
          label="Thuộc tính bổ sung"
          value={form.attributes}
          onChange={(value) => onFieldChange("attributes", value)}
          placeholder={categoryHints[form.category]?.attrs || categoryHints.other.attrs}
          helper={`Mỗi dòng là một thuộc tính (${attributesCount}/10)`}
        />
      </section>
      <div className="submit-wrap">
        <button className="primary-button" type="button" onClick={onGenerate}>{loading ? "Đang tạo..." : "Tạo nội dung"}</button>
      </div>
    </section>
  );
}
