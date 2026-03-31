import { NextResponse } from "next/server";
import { suggestProductFromImages } from "@/lib/server/ai-service";
import { getCategoryGroupValue, getMarketplaceDefaults } from "@/lib/category-marketplace-presets";
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

function inferFallbackCategoryFromName(name = "") {
  const normalized = String(name || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();

  const has = (pattern) => pattern.test(normalized);

  if (!normalized) return "other";

  if (has(/voucher|gift\s*card|license|template|preset|khoa\s*hoc\s*online|digital\s*goods|digital\b/)) return "digitalGoods";

  if (has(/camera\s*hanh\s*trinh|dash\s*cam|phu\s*kien\s*xe|oto|xe\s*may|moto|o\s*to/)) return "autoMoto";
  if (has(/drone|flycam|mirrorless|dslr|may\s*anh|camera\b|gimbal/)) return "cameraDrone";

  if (has(/dien\s*thoai|smartphone|iphone|android\b|may\s*tinh\s*bang|tablet|ipad/)) return "phoneTablet";

  if (has(/balo|backpack|tote|handbag|tui\b/)) return "bags";

  if (has(/laptop|monitor|man\s*hinh|keyboard|ban\s*phim|mouse|chuot|router|wifi|printer|may\s*in|webcam|micro|pc\b|desk\s*setup/)) return "computerOffice";
  if (has(/tai\s*nghe|headphone|earbud|loa|speaker|sac|charger|power\s*bank|pin\s*du\s*phong/)) return "electronics";

  if (has(/may\s*rua\s*mat|may\s*say\s*toc|hair\s*dryer|uon\s*toc|straightener|makeup\s*brush|co\s*trang\s*diem|triet\s*long/)) return "beautyTools";
  if (has(/serum|kem\s*chong\s*nang|sunscreen|sua\s*rua\s*mat|cleanser|toner|kem\s*duong|moisturizer|my\s*pham|skincare/)) return "skincare";
  if (has(/nuoc\s*hoa|fragrance|perfume|body\s*mist/)) return "fragrance";

  if (has(/binh\s*sua|ta\s*quan|bim|sosinh|baby|me\s*be/)) return "motherBaby";
  if (has(/huyet\s*ap|vitamin|supplement|suc\s*khoe|health\s*care|thermometer/)) return "healthCare";

  if (has(/\bao\b|dam\s*cong\s*so|dam\s*du\s*tiec|dam\s*nu|\bvay\b|so\s*mi|hoodie|\bquan\b|sleepwear|pajama|pyjama|do\s*ngu|quan\s*ngu/)) return "fashion";
  if (has(/giay|sneaker|sandal|dep\b|boots/)) return "footwear";
  if (has(/wallet|that\s*lung|belt|khuyen\s*tai|vong\b|phu\s*kien|accessor/)) return "accessories";

  if (has(/noi\s*chien|air\s*fryer|may\s*hut\s*bui|vacuum|may\s*loc\s*khong\s*khi|air\s*purifier|may\s*xay|blender|juicer|home\s*appliance/)) return "homeAppliances";
  if (has(/vien\s*giat|nuoc\s*giat|detergent|lau\s*san|floor\s*cleaner|tissue|giay\s*ve\s*sinh|dishwash|hat\s*cho\s*cho|hat\s*cho\s*meo/)) return "householdEssentials";
  if (has(/ke\s*bep|gia\s*vi|hop\s*dung|do\s*bep|houseware|gia\s*dung|kitchenware/)) return "home";
  if (has(/sofa|ban\s*tra|\bke\b|shelf|\btu\b|chair|den\s*decor|decor|noi\s*that|furniture/)) return "furnitureDecor";

  if (has(/yen\s*mach|granola|snack|do\s*uong|thuc\s*pham|food|an\s*kieng/)) return "food";
  if (has(/pate|thuc\s*an\s*cho|thuc\s*an\s*meo|cat\s*litter|pet\b|thu\s*cung|dog|cat/)) return "pet";
  if (has(/yoga|gym|running|dumbbell|resistance|the\s*thao/)) return "sports";
  if (has(/planner|but\b|notebook|sach\b|stationery|van\s*phong\s*pham|book\b/)) return "booksStationery";
  if (has(/lego|board\s*game|do\s*choi|toy\b|game\b/)) return "toysGames";

  if (has(/may\s*khoan|khoan\b|tua\s*vit|dung\s*cu|tool|hardware|do\s*nghe/)) return "toolsHardware";

  return "other";
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
      const inferredCategory = inferFallbackCategoryFromName(payload.productName || "");
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
