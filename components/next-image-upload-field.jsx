"use client";

import { getCopy } from "@/lib/i18n";

const SUGGEST_ERROR_PATTERN = /(kh[oô]ng th[eể]|kh[oô]ng h[oơ]p l[eệ]|h[eế]t h[aạ]n|unable|cannot|failed|error|invalid|expired|rate-limited|qu[aá] t[aả]i|t[uừ] ch[oố]i|khong the|khong hop le|het han)/i;
const SUGGEST_IMAGE_QUALITY_PATTERN = /(khong du du lieu anh|kh[oô]ng \u0111[uủ] d[uữ] li[eệ]u [aả]nh|check image|ki[eể]m tra l[aạ]i [aả]nh|valid image|kh[oô]ng th[eể] ph[aâ]n t[ií]ch [aả]nh)/i;

export default function NextImageUploadField({ images, onImageSelect, onRemoveImage, language = "vi", onSuggestFromImages, suggesting = false, suggestion = null }) {
  const imageCount = images.length;
  const copy = getCopy(language);
  const canAddMore = imageCount > 0 && imageCount < 4;
  const suggestLabel = suggesting
    ? (copy.form.analyzing || "Analyzing...")
    : (copy.form.autoSuggestOptions || "Auto Suggest Options");
  const addMoreLabel = copy.form.addImageShort || (language === "vi" ? "Thêm ảnh" : "Add image");
  const confidenceLabel = copy.form.confidenceLabel || "Confidence";
  const hasSuggestionError = Array.isArray(suggestion?.notes)
    && suggestion.notes.some((note) => SUGGEST_ERROR_PATTERN.test(String(note || "")));
  const generatedProductName = String(suggestion?.generatedProductName || "").trim();

  return (
    <div className="field upload-field">
      <div className="upload-field-head">
        <label>{copy.form.imageSet}</label>
        <span className="upload-counter">{copy.form.imageCounter(imageCount)}</span>
      </div>

      {!images.length ? (
        <label className={`upload-dropzone ${suggesting ? "is-analyzing" : ""}`}>
          <input type="file" accept="image/*" multiple onChange={onImageSelect} disabled={suggesting} />
          <span className="upload-dropzone-copy">
            <strong>{copy.form.imageDropEmpty}</strong>
            <small>{copy.form.imageHint}</small>
          </span>
          {suggesting ? <span className="upload-dropzone-scanner" aria-hidden="true" /> : null}
        </label>
      ) : null}

      {images.length ? (
        <>
          <div className="upload-suggest-row">
            {suggestion ? (
              <span className={`inline-note upload-confidence-note ${hasSuggestionError ? "is-error" : ""}`}>
                {confidenceLabel}: {Math.round((suggestion.confidence || 0) * 100)}%
              </span>
            ) : null}
            <div className="upload-suggest-actions">
              <button type="button" className="ghost-button upload-suggest-button" onClick={onSuggestFromImages} disabled={suggesting}>{suggestLabel}</button>
            </div>
          </div>

          <div className="thumb-grid thumb-grid-compact">
            {images.map((image) => (
              <figure key={image.id} className="upload-thumb filled">
                <img src={image.src} alt={image.name} />
                <figcaption title={image.name}>{image.name}</figcaption>
                <button type="button" className="upload-thumb-remove" onClick={() => onRemoveImage(image.id)} aria-label={`Remove ${image.name}`} disabled={suggesting}>&times;</button>
              </figure>
            ))}
            {canAddMore ? (
              <label className="upload-thumb-add" aria-label={addMoreLabel}>
                <input type="file" accept="image/*" multiple onChange={onImageSelect} disabled={suggesting} />
                <span className="upload-thumb-add-content">
                  <span className="upload-thumb-add-plus" aria-hidden="true">+</span>
                  <span className="upload-thumb-add-text">{addMoreLabel}</span>
                </span>
              </label>
            ) : null}
          </div>

          {suggestion?.notes?.length ? <div className={`field-helper ${hasSuggestionError ? "error-text" : ""}`}>{suggestion.notes.join(" · ")}</div> : null}
          {generatedProductName ? (
            <div className="field-helper">
              {language === "vi" ? "Tên nhận dạng từ ảnh:" : "Detected product name:"} {generatedProductName}
            </div>
          ) : null}
          {suggestion?.notes?.length && suggestion.notes.some((note) => SUGGEST_IMAGE_QUALITY_PATTERN.test(String(note || ""))) ? (
            <div className="field-helper">
              {language === "vi"
                ? "Mẹo: dùng ảnh chụp thật sản phẩm, rõ chủ thể, tránh ảnh screenshot hoặc ảnh quá nhỏ."
                : "Tip: use a real product photo with a clear subject; avoid screenshots or tiny images."}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
