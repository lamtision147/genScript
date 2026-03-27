"use client";

export default function NextImageUploadField({ images, onImageSelect, onRemoveImage }) {
  const imageCount = images.length;

  return (
    <div className="field upload-field">
      <div className="upload-field-head">
        <label>Bộ ảnh sản phẩm</label>
        <span className="upload-counter">{imageCount}/4 ảnh</span>
      </div>
      <label className="upload-dropzone">
        <input type="file" accept="image/*" multiple onChange={onImageSelect} />
        <span className="upload-dropzone-copy">
          <strong>{imageCount ? "Thay đổi hoặc thêm ảnh" : "Kéo thả ảnh hoặc bấm để tải lên"}</strong>
          <small>Ảnh rõ sản phẩm giúp AI viết tự nhiên và đúng ngữ cảnh hơn.</small>
        </span>
      </label>
      {images.length ? (
        <div className="thumb-grid">
          {images.map((image) => (
            <figure key={image.id} className="upload-thumb filled">
              <img src={image.src} alt={image.name} />
              <figcaption>{image.name}</figcaption>
              <button type="button" className="upload-thumb-remove" onClick={() => onRemoveImage(image.id)} aria-label={`Xóa ${image.name}`}>&times;</button>
            </figure>
          ))}
        </div>
      ) : null}
    </div>
  );
}
