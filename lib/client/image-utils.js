function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

const BACKEND_SUPPORTED_MIME_RE = /^image\/(png|jpeg|jpg|gif|webp)$/i;
const INPUT_SUPPORTED_MIME_RE = /^image\/(png|jpeg|jpg|gif|webp|avif|heic|heif)$/i;
const INPUT_SUPPORTED_NAME_RE = /\.(png|jpe?g|gif|webp|avif|heic|heif)$/i;
const MAX_UPLOAD_FILE_BYTES = 8 * 1024 * 1024;
const MAX_IMAGE_DATA_URL_BYTES = 5_800_000;

function createRejectedFile(file, reason) {
  return {
    name: String(file?.name || ""),
    size: Number(file?.size || 0),
    type: String(file?.type || "").toLowerCase(),
    reason
  };
}

function isSupportedInputFile(file) {
  const mimeType = String(file?.type || "").toLowerCase();
  const fileName = String(file?.name || "");
  if (mimeType && INPUT_SUPPORTED_MIME_RE.test(mimeType)) return true;
  return INPUT_SUPPORTED_NAME_RE.test(fileName);
}

function extractDataUrlMimeType(dataUrl = "") {
  const match = String(dataUrl || "").match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  return String(match?.[1] || "").toLowerCase();
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = dataUrl;
  });
}

function toJpegDataUrl(image, quality = 0.9, maxEdge = 1440) {
  const width = Number(image.naturalWidth || image.width || 0);
  const height = Number(image.naturalHeight || image.height || 0);
  if (!width || !height) {
    return null;
  }

  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, targetWidth, targetHeight);

  return canvas.toDataURL("image/jpeg", quality);
}

function isLikelyTinyOrInvalidDataUrl(dataUrl = "") {
  const bytes = dataUrlByteLength(dataUrl);
  if (!bytes) return true;
  return bytes < 1400;
}

function dataUrlByteLength(dataUrl = "") {
  const base64 = String(dataUrl || "").split(",")[1] || "";
  if (!base64) return 0;
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
}

async function normalizeImageDataUrl(file, dataUrl) {
  const byteLength = dataUrlByteLength(dataUrl);
  const mimeType = String(file?.type || "").toLowerCase();
  const dataUrlMimeType = extractDataUrlMimeType(dataUrl);
  const sourceMimeType = mimeType || dataUrlMimeType;

  const isHeic = /image\/hei(c|f)/i.test(sourceMimeType);
  const isUnsupportedFormat = Boolean(sourceMimeType) && !BACKEND_SUPPORTED_MIME_RE.test(sourceMimeType);
  const isLarge = byteLength > 2.4 * 1024 * 1024;

  if (!isHeic && !isUnsupportedFormat && !isLarge) {
    return dataUrl;
  }

  try {
    const image = await loadImage(dataUrl);
    const normalized = toJpegDataUrl(image, isLarge ? 0.82 : 0.88, isLarge ? 1280 : 1440);
    return normalized || dataUrl;
  } catch {
    return dataUrl;
  }
}

export async function filesToDataImages(fileList, limit = 4) {
  const files = Array.from(fileList || []);
  const images = [];
  const rejected = [];

  for (const file of files) {
    if (images.length >= limit) {
      break;
    }

    if (!isSupportedInputFile(file)) {
      rejected.push(createRejectedFile(file, "unsupported_type"));
      continue;
    }

    if (Number(file?.size || 0) > MAX_UPLOAD_FILE_BYTES) {
      rejected.push(createRejectedFile(file, "file_too_large"));
      continue;
    }

    let rawDataUrl = "";
    try {
      rawDataUrl = await readFileAsDataUrl(file);
    } catch {
      rejected.push(createRejectedFile(file, "read_failed"));
      continue;
    }

    let src = await normalizeImageDataUrl(file, rawDataUrl);
    if (!src) {
      rejected.push(createRejectedFile(file, "normalize_failed"));
      continue;
    }

    let srcMimeType = extractDataUrlMimeType(src);
    if (!BACKEND_SUPPORTED_MIME_RE.test(srcMimeType)) {
      try {
        const image = await loadImage(src);
        const converted = toJpegDataUrl(image, 0.88, 1440);
        if (converted) {
          src = converted;
          srcMimeType = extractDataUrlMimeType(src);
        }
      } catch {
        // keep original src
      }
    }

    if (!BACKEND_SUPPORTED_MIME_RE.test(srcMimeType)) {
      rejected.push(createRejectedFile(file, "unsupported_after_normalize"));
      continue;
    }

    if (isLikelyTinyOrInvalidDataUrl(src)) {
      try {
        const image = await loadImage(src);
        const forcedJpeg = toJpegDataUrl(image, 0.9, 960);
        if (forcedJpeg) {
          src = forcedJpeg;
        }
      } catch {
        // keep original src
      }
    }

    let bytes = dataUrlByteLength(src);
    if (bytes > MAX_IMAGE_DATA_URL_BYTES) {
      try {
        const image = await loadImage(src);
        const compressed = toJpegDataUrl(image, 0.78, 1024);
        if (compressed) {
          src = compressed;
          bytes = dataUrlByteLength(src);
        }
      } catch {
        // keep original src
      }
    }

    if (bytes > MAX_IMAGE_DATA_URL_BYTES) {
      rejected.push(createRejectedFile(file, "payload_too_large"));
      continue;
    }

    images.push({
      id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name: file.name,
      src
    });
  }

  return { images, rejected };
}
