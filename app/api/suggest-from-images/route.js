import { NextResponse } from "next/server";
import { suggestProductFromImages } from "@/lib/server/ai-service";
import { getCategoryGroupValue, getMarketplaceDefaults } from "@/lib/category-marketplace-presets";
import { inferCategoryFromProductName } from "@/lib/category-inference";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

const SUGGEST_ERROR_NOTE_BY_LANG = {
  vi: "Không thể phân tích ảnh lúc này, vui lòng thử lại.",
  en: "Unable to analyze images right now. Please try again.",
  zh: "当前无法分析图片，请稍后重试。",
  ja: "現在画像を分析できません。後で再試行してください。",
  ko: "지금은 이미지를 분석할 수 없습니다. 잠시 후 다시 시도해 주세요.",
  es: "No se pueden analizar las imagenes en este momento. Intentalo de nuevo.",
  fr: "Impossible d'analyser les images pour le moment. Reessayez plus tard.",
  de: "Bilder koennen momentan nicht analysiert werden. Bitte spaeter erneut versuchen."
};

function normalizeLang(value) {
  const normalized = String(value || "vi").toLowerCase().trim();
  return SUGGEST_ERROR_NOTE_BY_LANG[normalized] ? normalized : "vi";
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/suggest-from-images");
  let lang = "vi";
  try {
    const payload = await request.json().catch(() => ({}));
    lang = normalizeLang(payload.lang);
    const images = Array.isArray(payload.images) ? payload.images : [];

    const hasAnyImagePayload = images.some((image) => {
      const src = String(image?.src || "");
      return /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i.test(src) && src.length > 1500;
    });

    if (!hasAnyImagePayload) {
      const inferredCategory = inferCategoryFromProductName(payload.productName || "") || "other";
      const defaults = getMarketplaceDefaults(inferredCategory, undefined);
      const inferredName = String(payload.productName || "").trim();

      return withRequestId(NextResponse.json({
        suggestion: {
          category: inferredCategory,
          group: getCategoryGroupValue(inferredCategory),
          tone: defaults.tone,
          channel: defaults.channel,
          mood: defaults.mood,
          brandStyle: defaults.brandStyle,
          generatedProductName: inferredCategory !== "other" && inferredName
            ? inferredName
            : (lang === "vi" ? "Không nhận dạng tên sản phẩm được" : "Unable to identify product name"),
          targetCustomer: lang === "vi"
            ? "Khách mua online cần sản phẩm đúng nhu cầu thực tế"
            : "Online buyers looking for practical fit",
          shortDescription: lang === "vi"
            ? "Ảnh tải lên chưa đủ dữ liệu, tạm suy luận theo tên sản phẩm."
            : "Image data is insufficient; inferred conservatively from product name.",
          highlights: [],
          attributes: [],
          confidence: inferredCategory === "other" ? 0.2 : 0.72,
          notes: [lang === "vi"
            ? "Ảnh tải lên chưa đủ dữ liệu để phân tích. Vui lòng dùng ảnh thật sản phẩm, rõ chủ thể."
            : "Uploaded image does not contain enough data for analysis. Please use a clear real product photo."]
        }
      }), ctx);
    }

    const emptyName = String(payload.productName || "").trim() === "";
    if (emptyName) {
      const imageNameHints = images
        .map((image) => String(image?.name || "").toLowerCase())
        .join(" ");

      const guessedCategory = /monitor|man\s*hinh|display|screen/.test(imageNameHints)
        ? "computerOffice"
        : /headphone|earbud|tai\s*nghe|audio/.test(imageNameHints)
          ? "electronics"
          : /pajama|pyjama|sleepwear|quan\s*ngu|do\s*ngu/.test(imageNameHints)
            ? "fashion"
            : "other";

      if (guessedCategory !== "other") {
        return withRequestId(NextResponse.json({
          suggestion: {
            category: guessedCategory,
            group: getCategoryGroupValue(guessedCategory),
            tone: guessedCategory === "fashion" ? 0 : 1,
            channel: guessedCategory === "fashion" ? 0 : 1,
            mood: guessedCategory === "fashion" ? 2 : 3,
            brandStyle: guessedCategory === "fashion" ? 1 : 2,
            generatedProductName: guessedCategory === "computerOffice"
              ? (lang === "vi" ? "Màn hình máy tính" : "Computer monitor")
              : guessedCategory === "electronics"
                ? (lang === "vi" ? "Tai nghe không dây" : "Wireless headphones")
                : (lang === "vi" ? "Bộ quần áo ngủ" : "Sleepwear set"),
            targetCustomer: lang === "vi"
              ? "Khách mua online cần sản phẩm đúng nhu cầu thực tế"
              : "Online buyers looking for practical fit",
            shortDescription: lang === "vi"
              ? "Suy luận tạm từ metadata ảnh do chưa có tên sản phẩm đầu vào."
              : "Temporary inference from image metadata because product name was empty.",
            highlights: [],
            attributes: [],
            confidence: 0.52,
            notes: [lang === "vi"
              ? "Đã suy luận từ metadata ảnh (tên file) do chưa có tên sản phẩm."
              : "Inferred from image metadata (file name) because product name was empty."]
          }
        }), ctx);
      }
    }

    const result = await suggestProductFromImages({
      images,
      productName: payload.productName || "",
      lang
    });

    logInfo(ctx, "suggest.from-images.success", {
      confidence: result?.confidence ?? null,
      category: result?.category || "other",
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({
      suggestion: {
        ...result,
        group: getCategoryGroupValue(result?.category || "other")
      }
    }), ctx);
  } catch (error) {
    const statusCode = Number(error?.statusCode || error?.status || 0);
    const publicReason = statusCode === 401
      ? (lang === "vi" ? "AI key không hợp lệ hoặc đã hết hạn." : "AI key is invalid or expired.")
      : statusCode === 403
        ? (lang === "vi" ? "AI provider từ chối truy cập (403)." : "AI provider rejected access (403).")
        : statusCode === 429
          ? (lang === "vi" ? "AI provider đang quá tải (429), vui lòng thử lại sau ít phút." : "AI provider rate-limited (429), please retry shortly.")
          : statusCode >= 500
            ? (lang === "vi" ? "AI provider đang lỗi máy chủ, vui lòng thử lại sau." : "AI provider server error, please retry later.")
            : null;

    logError(ctx, "suggest.from-images.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({
      suggestion: {
        category: "other",
        group: getCategoryGroupValue("other"),
        tone: 0,
        channel: 2,
        mood: 0,
        brandStyle: 0,
        generatedProductName: lang === "vi"
          ? "Không nhận dạng tên sản phẩm được"
          : "Unable to identify product name",
        targetCustomer: "",
        shortDescription: "",
        highlights: [],
        attributes: [],
        confidence: 0.2,
        notes: [publicReason || SUGGEST_ERROR_NOTE_BY_LANG[lang] || SUGGEST_ERROR_NOTE_BY_LANG.vi]
      }
    }, {
      status: statusCode >= 400 ? statusCode : 200
    }), ctx);
  }
}
