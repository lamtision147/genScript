"use client";

import { useEffect, useMemo, useState } from "react";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";
import { apiGet, apiPost } from "@/lib/client/api";
import { filesToDataImages } from "@/lib/client/image-utils";
import { routes } from "@/lib/routes";
import { getCopy, getLocalizedProductConfig, localizeKnownMessage, toAiLang } from "@/lib/i18n";
import { trackEvent } from "@/lib/client/telemetry";
import { useVideoScriptHistory } from "@/hooks/use-video-script-history";
import { getProductIndustryPresets } from "@/lib/product-industry-templates";
import { getCategoryGroupValue, getCategoryValuesByGroup, getMarketplaceDefaults } from "@/lib/category-marketplace-presets";
import {
  inferCategoryFromProductName,
  isUnknownGeneratedProductName,
  normalizeSuggestedCategory,
  shouldPreferInferredCategory
} from "@/lib/category-inference";
import { normalizeTextForCategoryCheck } from "@/lib/category-inference";
import { enforceGroupScopedCategory } from "@/lib/product-workspace-helpers";

const MAX_IMAGE_COUNT = 4;

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function splitLines(value) {
  return String(value || "")
    .split(/\n|\||;/)
    .map((item) => cleanText(item))
    .filter(Boolean)
    .slice(0, 8);
}

function serializeHighlights(value) {
  if (Array.isArray(value)) return value.join("\n");
  return String(value || "");
}

function sanitizeDurationPreset(value) {
  const allowed = [15, 30, 45, 60, 90];
  const next = Number(value);
  return allowed.includes(next) ? next : 45;
}

function normalizePriceSegment(value) {
  const safe = String(value || "").toLowerCase().trim();
  if (["low", "mid", "high"].includes(safe)) return safe;
  return "mid";
}

function isLowSignalSuggestion(suggestion = null) {
  const confidence = Number(suggestion?.confidence || 0);
  const noteText = Array.isArray(suggestion?.notes) ? suggestion.notes.join(" ") : "";
  const noDataPattern = /khong du du lieu|chua du du lieu|insufficient|not enough image|uploaded image does not contain enough data|metadata|temporary inference|suy luan tam/i;
  return confidence <= 0.58 && noDataPattern.test(noteText);
}

function mapSuggestMoodLabel(language = "vi", moodValue = 2) {
  const vi = ["Tinh gọn sang trọng", "Ấm áp gần gũi", "Năng động cuốn hút", "Tự tin thuyết phục"];
  const en = ["Refined luxury", "Warm and close", "Energetic and catchy", "Confident and persuasive"];
  const idx = Math.max(0, Math.min(3, Number(moodValue) || 0));
  return language === "vi" ? vi[idx] : en[idx];
}

function toVideoSuggestHighlights(value) {
  if (Array.isArray(value)) return value.map((item) => cleanText(item)).filter(Boolean).slice(0, 6);
  return [];
}

function tokenizeForSuggest(value = "") {
  return normalizeTextForCategoryCheck(value)
    .split(/[^a-z0-9]+/g)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);
}

function buildSuggestionSignal(suggestion = null, productName = "") {
  const chunks = [
    productName,
    suggestion?.generatedProductName,
    suggestion?.targetCustomer,
    suggestion?.shortDescription,
    ...(Array.isArray(suggestion?.highlights) ? suggestion.highlights : []),
    ...(Array.isArray(suggestion?.notes) ? suggestion.notes : []),
    ...(Array.isArray(suggestion?.attributes)
      ? suggestion.attributes.map((item) => (typeof item === "string" ? item : item?.value || ""))
      : [])
  ];
  return chunks.map((item) => cleanText(item)).filter(Boolean).join(" ");
}

function pickPresetBySignal(presets = [], suggestion = null, productName = "") {
  if (!Array.isArray(presets) || !presets.length) return null;

  const signal = buildSuggestionSignal(suggestion, productName);
  const normalizedSignal = normalizeTextForCategoryCheck(signal);
  if (!normalizedSignal) return presets[0];

  const hasMenSignal = /\b(nam|men|male|boy)\b/.test(normalizedSignal);
  const hasWomenSignal = /\b(nu|women|female|girl)\b/.test(normalizedSignal);

  const signalTokens = new Set(tokenizeForSuggest(signal));

  const hasPresetToken = (value = "", token = "") => {
    const escaped = String(token).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(?:^|[-_])${escaped}(?:$|[-_])`).test(String(value || "").toLowerCase());
  };

  const scorePreset = (preset) => {
    const text = [preset.label, preset.targetCustomer, preset.painPoint, preset.highlights, preset.proofPoint].join(" ");
    const tokens = tokenizeForSuggest(text);
    let score = 0;

    for (const token of tokens) {
      if (signalTokens.has(token)) score += 1;
    }

    const value = String(preset?.value || "").toLowerCase();
    if (/\b(man hinh|monitor|display|screen|ultrawide)\b/.test(normalizedSignal) && value.includes("monitor")) score += 8;
    if (/\b(ban phim|chuot|keyboard|mouse)\b/.test(normalizedSignal) && value.includes("input")) score += 8;
    if (/\b(router|wifi|network|mesh|modem)\b/.test(normalizedSignal) && value.includes("network")) score += 8;
    if (/\b(laptop|macbook|notebook)\b/.test(normalizedSignal) && value.includes("laptop")) score += 7;
    if (hasMenSignal && hasPresetToken(value, "men")) score += 12;
    if (hasWomenSignal && hasPresetToken(value, "women")) score += 12;
    if (/\b(nam|men|short|shorts)\b/.test(normalizedSignal) && hasPresetToken(value, "men")) score += 6;
    if (/\b(bigsize|plus)\b/.test(normalizedSignal) && value.includes("bigsize")) score += 6;
    if (/\b(mun|sensitive|acne)\b/.test(normalizedSignal) && value.includes("acne")) score += 6;

    return score;
  };

  let best = presets[0];
  let bestScore = scorePreset(best);
  for (const preset of presets.slice(1)) {
    const score = scorePreset(preset);
    if (score > bestScore) {
      best = preset;
      bestScore = score;
    }
  }
  return best;
}

function getDefaultVideoForm(category = "fashion") {
  const defaults = getMarketplaceDefaults(category);
  const moodByIndexVi = ["Tinh gọn sang trọng", "Ấm áp gần gũi", "Năng động cuốn hút", "Tự tin thuyết phục"];
  const moodByIndexEn = ["Refined luxury", "Warm and close", "Energetic and catchy", "Confident and persuasive"];
  const moodVi = moodByIndexVi[Math.max(0, Math.min(3, Number(defaults.mood) || 0))] || moodByIndexVi[2];
  const moodEn = moodByIndexEn[Math.max(0, Math.min(3, Number(defaults.mood) || 0))] || moodByIndexEn[2];

  return {
    category,
    channel: defaults.channel,
    openingStyle: Math.max(0, Math.min(2, Number(defaults.tone) || 0)),
    moodVi,
    moodEn
  };
}

const INDUSTRY_TEMPLATE_BY_LANG = {
  vi: {
    fashion: [
      { value: "fashion-women-office", label: "Thời trang nữ công sở", targetCustomer: "Nữ 22-35 đi làm văn phòng", painPoint: "Mặc công sở dễ đứng tuổi, lên hình thiếu điểm nhấn", highlights: "Tôn dáng\nVải ít nhăn\nDễ phối blazer", proofPoint: "Quay trong ánh sáng văn phòng vẫn tôn dáng và gọn form", mood: "Tự tin thuyết phục", openingStyle: 1, durationSec: 30, scriptMode: "standard" },
      { value: "fashion-men-basic", label: "Thời trang nam basic", targetCustomer: "Nam 18-30 thích gọn, dễ mặc", painPoint: "Mặc basic dễ nhạt, khó lên chất streetwear", highlights: "Form đứng\nChất vải dày dặn\nDễ phối quần jean", proofPoint: "Quay outfit 7 ngày liên tục vẫn giữ phom và sạch vibe", priceSegment: "mid", mood: "Năng động cuốn hút", openingStyle: 2, durationSec: 30, scriptMode: "standard" },
      { value: "fashion-bigsize", label: "Thời trang bigsize", targetCustomer: "Khách cần size lớn, ưu tiên thoải mái", painPoint: "Đồ bigsize thường dễ nuốt dáng và thiếu tinh tế", highlights: "Size rộng thực\nVải mềm thoáng\nChe khuyết điểm tốt", proofPoint: "Người mặc size lớn lên form vẫn gọn và cân đối", priceSegment: "mid", mood: "Ấm áp gần gũi", openingStyle: 0, durationSec: 45, scriptMode: "standard" }
    ],
    skincare: [
      { value: "skincare-acne-sensitive", label: "Skincare da mụn nhạy cảm", targetCustomer: "Da dầu mụn, dễ kích ứng", painPoint: "Dùng sai sản phẩm dễ châm chích, mụn lên nhiều hơn", highlights: "Làm dịu nhanh\nKết cấu nhẹ\nKhông bí da", proofPoint: "Sau 7 ngày da bớt đỏ và makeup bám nền hơn", mood: "Ấm áp gần gũi", openingStyle: 0, durationSec: 45, scriptMode: "standard" },
      { value: "skincare-brightening", label: "Skincare làm sáng da", targetCustomer: "Nữ 20-35 muốn da đều màu", painPoint: "Da xỉn màu, quay gần dễ lộ mảng không đều", highlights: "Thấm nhanh\nDễ layer\nHỗ trợ da sáng", proofPoint: "Quay camera thường sau 2 tuần thấy da đều màu rõ hơn", mood: "Tự tin thuyết phục", openingStyle: 1, durationSec: 45, scriptMode: "standard" },
      { value: "skincare-repair", label: "Phục hồi hàng rào da", targetCustomer: "Da yếu sau treatment", painPoint: "Da căng rát, bong nhẹ, dùng gì cũng sợ kích ứng", highlights: "Phục hồi ẩm\nDịu da\nDùng sáng tối", proofPoint: "Sau 5-7 ngày da bớt rát và nhìn khỏe hơn rõ", mood: "Ấm áp gần gũi", openingStyle: 0, durationSec: 60, scriptMode: "teleprompter" }
    ],
    home: [
      { value: "home-kitchen", label: "Đồ gia dụng nhà bếp", targetCustomer: "Gia đình trẻ, người bận rộn", painPoint: "Nấu ăn mất thời gian, bếp nhanh bừa", highlights: "Dùng nhanh\nTiết kiệm diện tích\nDễ rửa", proofPoint: "Dùng 1 tuần thấy thao tác bếp nhanh và gọn hơn hẳn", mood: "Tự tin thuyết phục", openingStyle: 2, durationSec: 30, scriptMode: "teleprompter" },
      { value: "home-cleaning", label: "Đồ vệ sinh nhà cửa", targetCustomer: "Người cần dọn nhà nhanh", painPoint: "Dọn mãi không sạch sâu, tốn công", highlights: "Tiết kiệm sức\nSạch nhanh\nĐỡ mỏi tay", proofPoint: "Test trên vết bẩn cứng và thấy sạch rõ ngay lượt đầu", mood: "Năng động cuốn hút", openingStyle: 1, durationSec: 30, scriptMode: "teleprompter" },
      { value: "home-decor", label: "Đồ decor phòng", targetCustomer: "Khách thích setup góc sống ảo", painPoint: "Phòng trống, lên ảnh thiếu điểm nhấn", highlights: "Dễ phối màu\nLên ảnh đẹp\nLắp đặt đơn giản", proofPoint: "Quay trước/sau góc phòng thấy khác vibe ngay", mood: "Năng động cuốn hút", openingStyle: 1, durationSec: 30, scriptMode: "standard" }
    ],
    electronics: [
      { value: "elec-phone-accessory", label: "Phụ kiện điện thoại", targetCustomer: "Người dùng smartphone hằng ngày", painPoint: "Phụ kiện rẻ thường nhanh hỏng, dùng không ổn định", highlights: "Tương thích tốt\nDễ dùng\nĐộ bền khá", proofPoint: "Dùng liên tục nhiều ngày vẫn ổn định, không lỗi vặt", mood: "Năng động cuốn hút", openingStyle: 2, durationSec: 45, scriptMode: "teleprompter" },
      { value: "elec-audio-gaming", label: "Tai nghe / gaming gear", targetCustomer: "Game thủ, creator livestream", painPoint: "Âm thanh delay, mic lẫn tạp âm", highlights: "Âm rõ\nĐeo êm\nMic bắt giọng tốt", proofPoint: "Quay test mic trực tiếp, giọng thu rõ hơn thấy ngay", mood: "Tự tin thuyết phục", openingStyle: 1, durationSec: 45, scriptMode: "teleprompter" },
      { value: "elec-smart-home", label: "Thiết bị nhà thông minh", targetCustomer: "Người muốn tự động hóa cơ bản", painPoint: "Nhà thông minh nhưng thao tác app rối", highlights: "Kết nối nhanh\nĐiều khiển dễ\nDùng ổn định", proofPoint: "Setup 1 lần, dùng hằng ngày mượt và tiện hơn hẳn", mood: "Tự tin thuyết phục", openingStyle: 2, durationSec: 60, scriptMode: "teleprompter" }
    ],
    food: [
      { value: "food-snack", label: "Đồ ăn vặt", targetCustomer: "Học sinh, sinh viên, dân văn phòng", painPoint: "Ăn vặt dễ ngấy, nhiều món ngọt gắt", highlights: "Vị dễ ăn\nÍt ngấy\nĐóng gói tiện", proofPoint: "Ăn thử nhiều ngày vẫn hợp vị, không nhanh chán", mood: "Năng động cuốn hút", openingStyle: 1, durationSec: 30, scriptMode: "standard" },
      { value: "food-drink", label: "Đồ uống pha sẵn", targetCustomer: "Người bận rộn cần tiện lợi", painPoint: "Muốn uống ngon nhưng pha chế mất thời gian", highlights: "Pha nhanh\nVị cân bằng\nMang đi tiện", proofPoint: "Test giờ cao điểm buổi sáng vẫn chuẩn vị và nhanh", mood: "Năng động cuốn hút", openingStyle: 0, durationSec: 30, scriptMode: "standard" },
      { value: "food-healthy", label: "Thực phẩm eat-clean", targetCustomer: "Người tập luyện/ăn kiểm soát", painPoint: "Đồ healthy thường khó ăn và thiếu tiện", highlights: "Dễ ăn\nKhẩu phần rõ\nMang theo gọn", proofPoint: "Dùng suốt tuần làm việc vẫn duy trì được routine", mood: "Tự tin thuyết phục", openingStyle: 2, durationSec: 45, scriptMode: "standard" }
    ],
    footwear: [
      { value: "footwear-sneaker", label: "Sneaker đi học/đi làm", targetCustomer: "Nam nữ trẻ ưu tiên thoải mái", painPoint: "Giày đẹp nhưng đi lâu đau chân", highlights: "Đệm êm\nForm gọn\nDễ phối outfit", proofPoint: "Đi bộ cả ngày vẫn êm chân, không cấn mũi", mood: "Năng động cuốn hút", openingStyle: 1, durationSec: 30, scriptMode: "standard" },
      { value: "footwear-sandal", label: "Sandal đi chơi", targetCustomer: "Nữ 18-30", painPoint: "Sandal dễ trơn trượt và đau gót", highlights: "Đế bám\nDây êm\nLên chân xinh", proofPoint: "Đi ngoài trời nóng vẫn thoải mái và chắc chân", mood: "Ấm áp gần gũi", openingStyle: 0, durationSec: 30, scriptMode: "standard" },
      { value: "footwear-running", label: "Giày chạy bộ", targetCustomer: "Người mới chạy đến bán chuyên", painPoint: "Chạy 2-3km đã mỏi bàn chân", highlights: "Nhẹ chân\nĐộ nảy tốt\nBám đường", proofPoint: "Test chạy liên tục cho cảm giác ổn định hơn rõ", mood: "Tự tin thuyết phục", openingStyle: 2, durationSec: 45, scriptMode: "teleprompter" }
    ],
    bags: [
      { value: "bags-office", label: "Túi công sở", targetCustomer: "Nữ đi làm cần lịch sự", painPoint: "Túi đẹp nhưng thiếu ngăn, đeo nhanh mỏi", highlights: "Ngăn hợp lý\nForm cứng cáp\nDễ phối đồ", proofPoint: "Đựng đủ đồ đi làm hằng ngày vẫn gọn và đẹp form", mood: "Tự tin thuyết phục", openingStyle: 1, durationSec: 30, scriptMode: "standard" },
      { value: "bags-mini", label: "Túi mini đi chơi", targetCustomer: "Nữ trẻ thích phong cách", painPoint: "Túi mini thường chỉ đẹp nhưng kém tiện", highlights: "Nhỏ gọn\nĐủ đồ cơ bản\nLên ảnh xinh", proofPoint: "Quay lên outfit giúp tổng thể nhìn có điểm nhấn ngay", mood: "Năng động cuốn hút", openingStyle: 1, durationSec: 30, scriptMode: "standard" },
      { value: "bags-backpack", label: "Balo đi học/đi làm", targetCustomer: "Sinh viên, dân văn phòng", painPoint: "Balo dễ nặng vai, chia ngăn kém", highlights: "Quai êm\nNhiều ngăn\nMang laptop ổn", proofPoint: "Dùng cả tuần đi làm vẫn đeo thoải mái", mood: "Tự tin thuyết phục", openingStyle: 2, durationSec: 45, scriptMode: "teleprompter" }
    ],
    accessories: [
      { value: "acc-jewelry", label: "Trang sức thời trang", targetCustomer: "Nữ 18-30", painPoint: "Phụ kiện dễ xỉn hoặc nhìn rẻ khi lên hình gần", highlights: "Thiết kế tinh tế\nDễ phối\nTạo điểm nhấn", proofPoint: "Quay cận vẫn lên chi tiết đẹp, outfit nâng tầm rõ", mood: "Năng động cuốn hút", openingStyle: 1, durationSec: 30, scriptMode: "standard" },
      { value: "acc-hat-glasses", label: "Mũ nón / kính", targetCustomer: "Người hay đi nắng, thích phối đồ", painPoint: "Đội mũ hoặc đeo kính dễ dìm mặt", highlights: "Dễ hợp khuôn mặt\nForm ổn\nPhối nhanh", proofPoint: "Quay trước/sau thấy tổng thể outfit sáng hơn", mood: "Ấm áp gần gũi", openingStyle: 0, durationSec: 30, scriptMode: "standard" },
      { value: "acc-belt-scarf", label: "Thắt lưng / khăn", targetCustomer: "Người thích styling chi tiết", painPoint: "Outfit thiếu điểm nhấn nên nhìn nhạt", highlights: "Tạo điểm nhấn nhanh\nDễ mix\nNhiều dịp dùng", proofPoint: "Thêm một chi tiết là outfit trông chỉn chu hơn hẳn", mood: "Tự tin thuyết phục", openingStyle: 2, durationSec: 30, scriptMode: "standard" }
    ],
    fragrance: [
      { value: "frag-women", label: "Nước hoa nữ", targetCustomer: "Nữ 20-35", painPoint: "Mùi đầu gắt hoặc nhanh bay", highlights: "Mùi dễ chịu\nGiữ mùi khá\nDễ dùng hằng ngày", proofPoint: "Xịt từ sáng đến chiều vẫn còn mùi nền nhẹ", mood: "Ấm áp gần gũi", openingStyle: 0, durationSec: 45, scriptMode: "standard" },
      { value: "frag-men", label: "Nước hoa nam", targetCustomer: "Nam 20-35", painPoint: "Nhiều mùi nam quá nồng, khó dùng đi làm", highlights: "Mùi nam tính\nKhông gắt\nHợp môi trường văn phòng", proofPoint: "Test ở không gian kín vẫn dễ chịu, không gây khó chịu", mood: "Tự tin thuyết phục", openingStyle: 1, durationSec: 45, scriptMode: "standard" },
      { value: "frag-room", label: "Hương thơm phòng", targetCustomer: "Người thích không gian thơm dễ chịu", painPoint: "Không gian bí, dễ có mùi khó chịu", highlights: "Mùi dịu\nLan tỏa vừa\nDùng tiện", proofPoint: "Bật thử trong phòng nhỏ, mùi dễ chịu rõ chỉ sau vài phút", mood: "Ấm áp gần gũi", openingStyle: 0, durationSec: 30, scriptMode: "standard" }
    ],
    pet: [
      { value: "pet-cat-food", label: "Mèo - thức ăn/snack", targetCustomer: "Chủ mèo bận rộn", painPoint: "Boss kén ăn, đổi đồ là bỏ bữa", highlights: "Dễ ăn\nMùi thơm vừa\nTiện chia phần", proofPoint: "Test vài ngày liên tục, bé ăn ổn định hơn", mood: "Ấm áp gần gũi", openingStyle: 0, durationSec: 30, scriptMode: "standard" },
      { value: "pet-dog-care", label: "Chó - chăm sóc", targetCustomer: "Chủ chó muốn chăm lông/da tốt", painPoint: "Lông rụng nhiều, mùi cơ thể khó xử lý", highlights: "Dễ dùng\nÊm dịu\nHỗ trợ sạch mùi", proofPoint: "Sau 1 tuần tắm/chăm đều, lông mềm và thơm hơn rõ", mood: "Ấm áp gần gũi", openingStyle: 1, durationSec: 45, scriptMode: "standard" },
      { value: "pet-accessories", label: "Phụ kiện thú cưng", targetCustomer: "Chủ thú cưng thích đồ tiện", painPoint: "Phụ kiện đẹp nhưng dùng bất tiện", highlights: "Dễ đeo\nBền\nAn toàn", proofPoint: "Dùng khi đi dạo hằng ngày vẫn chắc và gọn", mood: "Năng động cuốn hút", openingStyle: 2, durationSec: 30, scriptMode: "standard" }
    ],
    sports: [
      { value: "sports-gym", label: "Gym / tập lực", targetCustomer: "Người tập gym 3-5 buổi/tuần", painPoint: "Dụng cụ kém bền, tập không vào nhóm cơ", highlights: "Bền\nDễ tập\nTăng hiệu quả", proofPoint: "Test nhiều buổi liên tục vẫn ổn và cho cảm giác vào cơ tốt", mood: "Tự tin thuyết phục", openingStyle: 2, durationSec: 45, scriptMode: "teleprompter" },
      { value: "sports-yoga", label: "Yoga / pilates", targetCustomer: "Nữ thích tập tại nhà", painPoint: "Thảm/phụ kiện dễ trơn, khó giữ form", highlights: "Độ bám tốt\nÊm\nDễ vệ sinh", proofPoint: "Quay bài tập thực tế, giữ tư thế chắc hơn rõ", mood: "Ấm áp gần gũi", openingStyle: 0, durationSec: 45, scriptMode: "teleprompter" },
      { value: "sports-running", label: "Running", targetCustomer: "Người chạy bộ mỗi tuần", painPoint: "Đồ chạy nóng bí hoặc thiếu hỗ trợ", highlights: "Thoáng\nNhẹ\nHỗ trợ tốt", proofPoint: "Test nhiều km liên tục vẫn thoải mái và ổn định", mood: "Năng động cuốn hút", openingStyle: 1, durationSec: 45, scriptMode: "teleprompter" }
    ],
    other: [
      { value: "other-generic", label: "Sản phẩm phổ thông", targetCustomer: "Khách mua theo nhu cầu thực tế", painPoint: "Chưa chắc sản phẩm có đáng tiền hay không", highlights: "Dễ dùng\nHiệu quả rõ\nChi phí hợp lý", proofPoint: "Test bối cảnh dùng thật thấy cải thiện rõ ngay", mood: "Tự tin thuyết phục", openingStyle: 0, durationSec: 45, scriptMode: "standard" },
      { value: "other-seasonal", label: "Sản phẩm theo mùa", targetCustomer: "Khách mua theo thời điểm", painPoint: "Đến mùa mới mua thì thường chọn sai", highlights: "Đúng nhu cầu mùa\nDùng tiện\nHiệu quả nhanh", proofPoint: "Dùng đúng thời điểm giúp xử lý vấn đề nhanh hơn", mood: "Năng động cuốn hút", openingStyle: 1, durationSec: 30, scriptMode: "standard" },
      { value: "other-gift", label: "Quà tặng", targetCustomer: "Người mua quà cần đẹp và thực dụng", painPoint: "Mua quà dễ lệch gu, tặng xong ít dùng", highlights: "Đẹp\nDễ dùng\nĐóng gói ổn", proofPoint: "Tặng thử nhiều dịp đều nhận phản hồi tích cực", mood: "Ấm áp gần gũi", openingStyle: 0, durationSec: 30, scriptMode: "standard" }
    ]
  },
  en: {
    fashion: [
      { value: "fashion-women-office", label: "Women office wear", targetCustomer: "Women 22-35 office workers", painPoint: "Office outfits often look plain on camera", highlights: "Flattering fit\nLow-wrinkle fabric\nEasy blazer pairing", proofPoint: "Filmed for a week and silhouette stayed sharp", mood: "Confident and persuasive", openingStyle: 1, durationSec: 30, scriptMode: "standard" },
      { value: "fashion-men-basic", label: "Men basic style", targetCustomer: "Men 18-30", painPoint: "Basic style can look flat and repetitive", highlights: "Structured fit\nSolid fabric\nEasy styling", proofPoint: "Daily outfit videos looked cleaner and more premium", mood: "Energetic and catchy", openingStyle: 2, durationSec: 30, scriptMode: "standard" }
    ],
    skincare: [
      { value: "skincare-acne-sensitive", label: "Acne-sensitive skincare", targetCustomer: "Sensitive acne-prone skin", painPoint: "Wrong products can irritate and trigger breakouts", highlights: "Gentle texture\nFast absorb\nLow irritation", proofPoint: "After 7 days skin looked calmer on normal camera", mood: "Warm and close", openingStyle: 0, durationSec: 45, scriptMode: "standard" }
    ],
    home: [
      { value: "home-kitchen", label: "Kitchen essentials", targetCustomer: "Young families", painPoint: "Cooking setup is slow and messy", highlights: "Quick use\nSpace-saving\nEasy cleanup", proofPoint: "Daily kitchen routine became noticeably smoother", mood: "Confident and persuasive", openingStyle: 2, durationSec: 30, scriptMode: "teleprompter" }
    ],
    electronics: [
      { value: "elec-phone-accessory", label: "Phone accessories", targetCustomer: "Daily smartphone users", painPoint: "Cheap accessories fail too quickly", highlights: "Stable\nEasy to use\nPractical", proofPoint: "Multi-day stress test stayed stable", mood: "Energetic and catchy", openingStyle: 2, durationSec: 45, scriptMode: "teleprompter" }
    ],
    food: [
      { value: "food-snack", label: "Snacks", targetCustomer: "Students and office workers", painPoint: "Many snacks are convenient but quickly get boring", highlights: "Convenient\nBalanced flavor\nPortable", proofPoint: "Used all week and still enjoyable", mood: "Energetic and catchy", openingStyle: 1, durationSec: 30, scriptMode: "standard" }
    ],
    footwear: [
      { value: "footwear-sneaker", label: "Sneakers", targetCustomer: "Young daily users", painPoint: "Good-looking shoes can hurt after long wear", highlights: "Comfort\nStable sole\nEasy style", proofPoint: "All-day wear remained comfortable", mood: "Energetic and catchy", openingStyle: 1, durationSec: 30, scriptMode: "standard" }
    ],
    bags: [
      { value: "bags-office", label: "Office bags", targetCustomer: "Working professionals", painPoint: "Many office bags look good but lack practical compartments", highlights: "Structured shape\nUseful compartments\nEasy pairing", proofPoint: "Daily carry remained practical and neat", mood: "Confident and persuasive", openingStyle: 1, durationSec: 30, scriptMode: "standard" }
    ],
    accessories: [
      { value: "acc-jewelry", label: "Fashion jewelry", targetCustomer: "Women 18-30", painPoint: "Small accessories often look cheap on close-up shots", highlights: "Refined detail\nEasy pairing\nVisible style boost", proofPoint: "Close-up shots still looked polished", mood: "Energetic and catchy", openingStyle: 1, durationSec: 30, scriptMode: "standard" }
    ],
    fragrance: [
      { value: "frag-women", label: "Women fragrance", targetCustomer: "Women 20-35", painPoint: "Many scents are too sharp at opening or fade too fast", highlights: "Soft opening\nGood wearability\nDaily-friendly", proofPoint: "Scent remained noticeable by late afternoon", mood: "Warm and close", openingStyle: 0, durationSec: 45, scriptMode: "standard" }
    ],
    pet: [
      { value: "pet-accessories", label: "Pet accessories", targetCustomer: "Pet owners", painPoint: "Cute accessories can still be inconvenient or unsafe", highlights: "Easy fit\nDurable\nSafer feel", proofPoint: "Daily walk usage stayed stable and comfortable", mood: "Warm and close", openingStyle: 1, durationSec: 30, scriptMode: "standard" }
    ],
    sports: [
      { value: "sports-gym", label: "Gym gear", targetCustomer: "Gym users", painPoint: "Low-quality gear breaks routine and confidence", highlights: "Durable\nPractical\nEfficient", proofPoint: "Repeated sessions kept stable performance", mood: "Confident and persuasive", openingStyle: 2, durationSec: 45, scriptMode: "teleprompter" }
    ],
    other: [
      { value: "other-generic", label: "General product", targetCustomer: "Practical buyers", painPoint: "Buyers are unsure whether the product is really worth it", highlights: "Easy to use\nClear value\nBudget friendly", proofPoint: "Real-life test showed immediate practical improvement", mood: "Confident and persuasive", openingStyle: 0, durationSec: 45, scriptMode: "standard" }
    ]
  }
};

const VIDEO_SCRIPT_CATEGORY_FALLBACKS = [
  "fashion",
  "skincare",
  "beautyTools",
  "home",
  "furnitureDecor",
  "electronics",
  "food",
  "householdEssentials",
  "footwear",
  "bags",
  "accessories",
  "fragrance",
  "pet",
  "sports",
  "motherBaby",
  "healthCare",
  "booksStationery",
  "toysGames",
  "autoMoto",
  "phoneTablet",
  "computerOffice",
  "cameraDrone",
  "homeAppliances",
  "toolsHardware",
  "digitalGoods",
  "other"
];

const VIDEO_SCRIPT_FALLBACK_PRESET = {
  vi: [
    {
      value: "generic-marketplace",
      label: "Template sàn tổng quát",
      targetCustomer: "Người mua cần sản phẩm rõ giá trị và dễ quyết định",
      painPoint: "Khó chọn vì thông tin rời rạc, chưa thấy khác biệt thực tế",
      highlights: "Điểm mạnh rõ\nDễ dùng\nĐáng tiền",
      proofPoint: "So sánh nhanh trước/sau cho thấy lợi ích ngay trong bối cảnh dùng thật",
      mood: "Tự tin thuyết phục",
      openingStyle: 1,
      durationSec: 45,
      scriptMode: "standard"
    }
  ],
  en: [
    {
      value: "generic-marketplace",
      label: "Marketplace general template",
      targetCustomer: "Buyers who need clear value before deciding",
      painPoint: "Hard to choose when listings feel generic and unclear",
      highlights: "Clear strengths\nEasy to use\nWorth the money",
      proofPoint: "A quick before/after context makes practical value obvious",
      mood: "Confident and persuasive",
      openingStyle: 1,
      durationSec: 45,
      scriptMode: "standard"
    }
  ]
};

function createFallbackPreset(category, language) {
  const langKey = language === "vi" ? "vi" : "en";
  const base = VIDEO_SCRIPT_FALLBACK_PRESET[langKey][0];
  return {
    ...base,
    value: `${category}-generic`,
    label: langKey === "vi" ? `Template ${category}` : `${category} template`
  };
}

function buildVideoSuggestedTemplate({ category = "other", suggestion = null, language = "vi" } = {}) {
  const langKey = language === "vi" ? "vi" : "en";
  const highlights = toVideoSuggestHighlights(suggestion?.highlights);
  const attrs = Array.isArray(suggestion?.attributes)
    ? suggestion.attributes.map((item) => cleanText(item?.value || item)).filter(Boolean)
    : [];
  const mergedHighlights = [...highlights, ...attrs].filter(Boolean).slice(0, 6);

  const isVi = langKey === "vi";
  const targetCustomer = cleanText(suggestion?.targetCustomer)
    || (isVi ? "Khách mua online theo nhu cầu thực tế" : "Online shoppers with practical needs");
  const painPoint = cleanText(suggestion?.shortDescription)
    || (isVi ? "Người xem muốn thấy giải pháp nhanh, rõ và dễ áp dụng" : "Viewers want fast, clear and practical solutions");
  const proofPoint = cleanText(attrs[0] || suggestion?.shortDescription)
    || (isVi ? "Tập trung bối cảnh dùng thật để tăng độ tin cậy" : "Use real-life context to improve credibility");

  return {
    value: `suggest-${category}`,
    label: isVi ? "Template AI từ ảnh" : "AI template from image",
    targetCustomer,
    painPoint,
    highlights: mergedHighlights.join("\n") || (isVi ? "Điểm mạnh rõ\nDễ dùng\nHiệu quả thực tế" : "Clear strengths\nEasy to use\nPractical outcomes"),
    proofPoint,
    mood: mapSuggestMoodLabel(langKey, suggestion?.mood),
    openingStyle: Number.isFinite(Number(suggestion?.tone)) ? Math.max(0, Math.min(2, Number(suggestion.tone))) : 1,
    durationSec: 45,
    scriptMode: "standard",
    priceSegment: "mid"
  };
}

function getIndustryPresetsByCategory(language, category) {
  const langKey = language === "vi" ? "vi" : "en";
  const categoryKey = VIDEO_SCRIPT_CATEGORY_FALLBACKS.includes(category) ? category : "other";

  const productTemplates = getProductIndustryPresets(categoryKey);
  if (productTemplates.length) {
    const moodOptions = langKey === "vi"
      ? ["Năng động cuốn hút", "Tự tin thuyết phục", "Ấm áp gần gũi", "Tinh gọn sang trọng"]
      : ["Energetic and catchy", "Confident and persuasive", "Warm and close", "Refined luxury"];

    const toneToOpening = [0, 1, 2];
    return productTemplates.slice(0, 10).map((item, index) => {
      const tone = Number.isFinite(Number(item.tone)) ? Number(item.tone) : 1;
      const mood = moodOptions[Math.max(0, Math.min(3, Number(item.mood) || 0))] || moodOptions[0];
      const duration = index === 0 ? 45 : 30;
      const safeLabel = String(item.label || item.value || `template-${index + 1}`);
      const safeTarget = cleanText(item.targetCustomer || "");
      const safeHighlights = String(item.highlights || "");
      const safeShort = cleanText(item.shortDescription || "");
      const safeProof = cleanText(item.specs || item.compatibility || item.usage || item.warranty || safeShort);

      return {
        value: item.value || `${categoryKey}-${index + 1}`,
        label: safeLabel,
        targetCustomer: safeTarget || (langKey === "vi" ? "Khách mua online theo nhu cầu thực tế" : "Online shoppers with practical needs"),
        painPoint: safeShort || (langKey === "vi" ? "Khó chọn đúng sản phẩm vì thiếu bối cảnh dùng thật" : "Hard to choose the right product without real usage context"),
        highlights: safeHighlights || (langKey === "vi" ? "Điểm mạnh rõ\nDễ dùng\nĐáng tiền" : "Clear strengths\nEasy to use\nWorth the money"),
        proofPoint: safeProof || (langKey === "vi" ? "Dùng thử trong bối cảnh thực tế cho kết quả dễ cảm nhận" : "Real-life usage shows practical benefits quickly"),
        mood,
        openingStyle: toneToOpening[Math.max(0, Math.min(2, tone))],
        durationSec: duration,
        scriptMode: tone === 2 ? "teleprompter" : "standard",
        priceSegment: "mid"
      };
    });
  }

  const templates = INDUSTRY_TEMPLATE_BY_LANG[langKey] || INDUSTRY_TEMPLATE_BY_LANG.en;
  if (templates[categoryKey]?.length) {
    return templates[categoryKey];
  }

  return [createFallbackPreset(categoryKey, langKey)];
}

function pickIndustryTemplate(language, category, presetValue = "") {
  const presets = getIndustryPresetsByCategory(language, category);
  if (!presets.length) return null;
  return presets.find((item) => item.value === presetValue) || presets[0];
}

export function createEmptyVideoForm() {
  const defaults = getDefaultVideoForm("fashion");
  return {
    productName: "",
    category: defaults.category,
    channel: defaults.channel,
    targetCustomer: "",
    painPoint: "",
    highlights: "",
    proofPoint: "",
    durationSec: 45,
    priceSegment: "mid",
    mood: defaults.moodVi,
    openingStyle: defaults.openingStyle,
    scriptMode: "standard",
    industryPreset: "",
    images: []
  };
}

export function useVideoScriptWorkspace(language = "vi", { initialHistoryId = "" } = {}) {
  const { session, setSession } = useAuthBootstrap();
  const copy = getCopy(language);
  const localizedConfig = getLocalizedProductConfig(language);
  const {
    history,
    favoriteIds,
    activeHistoryId,
    setActiveHistoryId,
    actions: historyActions
  } = useVideoScriptHistory();

  const [form, setForm] = useState(() => enforceGroupScopedCategory(createEmptyVideoForm(), "fashionBeauty"));
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [savingEdited, setSavingEdited] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [suggestionPulseToken, setSuggestionPulseToken] = useState(0);
  const [autoTemplateMeta, setAutoTemplateMeta] = useState(null);
  const [message, setMessage] = useState("");
  const [categoryGroupFilter, setCategoryGroupFilter] = useState("fashionBeauty");
  const [resolvedHistoryId, setResolvedHistoryId] = useState(() => String(initialHistoryId || ""));

  const categoryOptions = useMemo(() => {
    const groupValues = getCategoryValuesByGroup(categoryGroupFilter);
    const filtered = localizedConfig.categoryOptions.filter((option) =>
      groupValues.includes(option.value)
    );

    if (!filtered.length) {
      return localizedConfig.categoryOptions;
    }

    const currentCategoryOption = localizedConfig.categoryOptions.find((item) => item.value === form?.category) || null;
    if (currentCategoryOption && !filtered.some((item) => item.value === currentCategoryOption.value)) {
      return [currentCategoryOption, ...filtered];
    }
    return filtered;
  }, [localizedConfig.categoryOptions, categoryGroupFilter, form?.category, language]);

  const industryPresetCatalog = useMemo(() => {
    return getIndustryPresetsByCategory(language, form.category);
  }, [language, form.category]);

  const industryPresetOptions = useMemo(() => {
    return industryPresetCatalog.map((item) => ({ value: item.value, label: item.label }));
  }, [industryPresetCatalog]);

  const selectedIndustryPreset = useMemo(() => {
    if (!industryPresetCatalog.length) return null;
    return industryPresetCatalog.find((item) => item.value === form.industryPreset) || industryPresetCatalog[0];
  }, [industryPresetCatalog, form.industryPreset]);

  useEffect(() => {
    const expectedGroup = getCategoryGroupValue(form.category);
    if (expectedGroup === categoryGroupFilter) return;
    setCategoryGroupFilter(expectedGroup);
  }, [form.category, categoryGroupFilter]);

  useEffect(() => {
    const allowed = getCategoryValuesByGroup(categoryGroupFilter);
    if (allowed.includes(form.category)) {
      return;
    }
    setField("category", allowed[0] || "other");
  }, [categoryGroupFilter]);

  const openingStyleOptions = useMemo(() => {
    const isVi = language === "vi";
    return isVi
      ? [
          "Nỗi đau trực diện",
          "So sánh trước/sau",
          "Tuyên bố ngược số đông"
        ]
      : [
          "Direct pain-point hook",
          "Before/after hook",
          "Contrarian hook"
        ];
  }, [language]);

  const moodPresetOptions = useMemo(() => {
    const isVi = language === "vi";
    return isVi
      ? ["Năng động cuốn hút", "Tự tin thuyết phục", "Ấm áp gần gũi"]
      : ["Energetic and catchy", "Confident and persuasive", "Warm and close"];
  }, [language]);

  const scriptModeOptions = useMemo(() => {
    const isVi = language === "vi";
    return [
      { value: "standard", label: isVi ? "Tiêu chuẩn" : "Standard" },
      { value: "teleprompter", label: isVi ? "Teleprompter (dễ đọc khi quay)" : "Teleprompter (camera-friendly)" }
    ];
  }, [language]);

  useEffect(() => {
    fetch(routes.api.session)
      .then((res) => res.json())
      .then((data) => setSession(data?.user || null))
      .catch(() => {});
  }, [setSession]);

  useEffect(() => {
    historyActions.refresh();
  }, []);

  useEffect(() => {
    if (initialHistoryId) {
      setResolvedHistoryId(String(initialHistoryId));
      return;
    }

    if (typeof window === "undefined") return;
    const fromQuery = new URLSearchParams(window.location.search).get("historyId") || "";
    if (fromQuery) {
      setResolvedHistoryId(fromQuery);
    }
  }, [initialHistoryId]);

  useEffect(() => {
    if (!resolvedHistoryId) return;
    apiGet(`${routes.api.history}/${resolvedHistoryId}`).then((data) => {
      if (data?.item) {
        const item = data.item;
        setActiveHistoryId(item.id || null);
        setResult(item.result || null);
        setForm((prev) => ({
          ...prev,
          ...(item.form || {}),
          images: Array.isArray(item?.form?.images) ? item.form.images : [],
          highlights: serializeHighlights(item?.form?.highlights ?? prev.highlights),
          durationSec: sanitizeDurationPreset(item?.form?.durationSec ?? prev.durationSec),
          priceSegment: normalizePriceSegment(item?.form?.priceSegment || prev.priceSegment),
          industryPreset: item?.form?.industryPreset || ""
        }));
      }
    }).catch(() => {});
  }, [resolvedHistoryId]);

  useEffect(() => {
    if (!industryPresetCatalog.length) return;
    const exists = industryPresetCatalog.some((item) => item.value === form.industryPreset);
    if (exists) return;
    setForm((prev) => ({ ...prev, industryPreset: industryPresetCatalog[0].value }));
  }, [industryPresetCatalog, form.industryPreset]);

  useEffect(() => {
    trackEvent("workspace.open", { page: "scriptVideoReview", lang: language });
  }, [language]);

  function applySample() {
    const isVi = language === "vi";
    const defaults = getDefaultVideoForm("skincare");
    setCategoryGroupFilter(getCategoryGroupValue("skincare"));
    setAutoTemplateMeta(null);
    setForm({
      productName: isVi ? "Máy làm sạch da mini" : "Mini facial cleansing device",
      category: "skincare",
      channel: defaults.channel,
      targetCustomer: isVi ? "Nữ 20-32 tuổi, da dễ bí tắc" : "Women 20-32 with clog-prone skin",
      painPoint: isVi ? "Da sần, makeup không ăn, nhanh bí tắc" : "Rough skin, makeup sits badly, pores clog quickly",
      highlights: isVi
        ? "Làm sạch sâu dịu nhẹ\nThiết kế nhỏ gọn dễ mang\nPin dùng lâu"
        : "Gentle deep cleansing\nCompact and portable\nLong battery life",
      proofPoint: isVi
        ? "Sau 7 ngày dùng liên tục, da mịn hơn thấy rõ khi makeup"
        : "After 7 days, skin texture looks visibly smoother under makeup",
      durationSec: 45,
      priceSegment: "mid",
      mood: isVi ? defaults.moodVi : defaults.moodEn,
      openingStyle: defaults.openingStyle,
      scriptMode: "standard",
      industryPreset: ""
    });
  }

  function applyIndustryTemplate() {
    const template = pickIndustryTemplate(language, form.category, form.industryPreset);
    if (!template) return;
    setAutoTemplateMeta(null);
    setForm((prev) => ({
      ...prev,
      targetCustomer: template.targetCustomer || prev.targetCustomer,
      painPoint: template.painPoint,
      highlights: template.highlights,
      proofPoint: template.proofPoint,
      priceSegment: template.priceSegment || prev.priceSegment,
      mood: template.mood,
      openingStyle: template.openingStyle,
      durationSec: sanitizeDurationPreset(template.durationSec),
      scriptMode: template.scriptMode || prev.scriptMode,
      industryPreset: template.value || prev.industryPreset
    }));
  }

  function clearForm() {
    setForm(enforceGroupScopedCategory(createEmptyVideoForm(), "fashionBeauty"));
    setCategoryGroupFilter("fashionBeauty");
    setAutoTemplateMeta(null);
    setResult(null);
    setMessage("");
  }

  function setCategoryGroup(nextGroup) {
    const allowed = getCategoryValuesByGroup(nextGroup);
    const nextCategory = allowed.includes(form.category) ? form.category : allowed[0] || "other";

    setCategoryGroupFilter(nextGroup);
    setField("category", nextCategory);
  }

  function setField(key, value) {
    if (key === "durationSec") {
      setForm((prev) => ({ ...prev, durationSec: sanitizeDurationPreset(value) }));
      return;
    }
    if (key === "category") {
      const presets = getIndustryPresetsByCategory(language, value);
      const defaults = getDefaultVideoForm(value);
      setAutoTemplateMeta(null);
      setForm((prev) => ({
        ...prev,
        category: value,
        channel: defaults.channel,
        openingStyle: defaults.openingStyle,
        mood: language === "vi" ? defaults.moodVi : defaults.moodEn,
        industryPreset: presets[0]?.value || ""
      }));
      return;
    }

    if (key === "channel") {
      const defaults = getDefaultVideoForm(form.category);
      const nextChannel = Number(value);
      const channel = Number.isFinite(nextChannel) ? Math.max(0, Math.min(2, nextChannel)) : defaults.channel;
      const styleDefaults = getMarketplaceDefaults(form.category, channel);
      const moodOptions = language === "vi"
        ? ["Tinh gọn sang trọng", "Ấm áp gần gũi", "Năng động cuốn hút", "Tự tin thuyết phục"]
        : ["Refined luxury", "Warm and close", "Energetic and catchy", "Confident and persuasive"];
      const mood = moodOptions[Math.max(0, Math.min(3, Number(styleDefaults.mood) || 0))] || moodOptions[2];

      setForm((prev) => ({
        ...prev,
        channel,
        openingStyle: Math.max(0, Math.min(2, Number(styleDefaults.tone) || defaults.openingStyle)),
        mood
      }));
      return;
    }

    if (key === "industryPreset") {
      setAutoTemplateMeta(null);
      setForm((prev) => ({ ...prev, industryPreset: value }));
      return;
    }

    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleImageSelect(event) {
    const currentImages = Array.isArray(form.images) ? form.images : [];
    const availableSlots = Math.max(0, MAX_IMAGE_COUNT - currentImages.length);
    const uploadResult = await filesToDataImages(event?.target?.files, availableSlots || MAX_IMAGE_COUNT);
    const nextImages = [...currentImages, ...(uploadResult?.images || [])].slice(0, MAX_IMAGE_COUNT);

    setForm((prev) => ({ ...prev, images: nextImages }));
    setSuggestion(null);

    if (nextImages.length) {
      await suggestFromImagesInternal(nextImages, "auto");
    }
  }

  function removeImage(imageId) {
    setForm((prev) => ({
      ...prev,
      images: (prev.images || []).filter((item) => item.id !== imageId)
    }));
    setSuggestion(null);
  }

  async function suggestFromImagesInternal(imageSet, mode = "manual") {
    const images = Array.isArray(imageSet) ? imageSet : [];
    if (!images.length) return;

    setSuggesting(true);
    setMessage("");

    try {
      const data = await apiPost(routes.api.suggestFromImages, {
        lang: toAiLang(language),
        productName: form.productName,
        images
      });

      const suggested = data?.suggestion || null;
      setSuggestion(suggested);
      if (!suggested) return;

      const generatedName = cleanText(suggested.generatedProductName || "");
      const shouldUseGeneratedName = Boolean(generatedName && !isUnknownGeneratedProductName(generatedName));
      const inferredCategory = inferCategoryFromProductName(shouldUseGeneratedName ? generatedName : form.productName);
      const suggestedCategory = normalizeSuggestedCategory(suggested.category);
      const resolvedCategory = shouldPreferInferredCategory(inferredCategory, suggestedCategory)
        ? inferredCategory
        : (suggestedCategory || inferredCategory || form.category || "other");
      const defaults = getDefaultVideoForm(resolvedCategory);
      const nextGroup = getCategoryGroupValue(resolvedCategory);
      const lowSignalSuggestion = isLowSignalSuggestion(suggested);
      const shouldSoftApply = lowSignalSuggestion;
      const hasCategoryConflict = Boolean(inferredCategory && suggestedCategory && inferredCategory !== suggestedCategory);
      const presets = getIndustryPresetsByCategory(language, resolvedCategory);
      const aiTemplate = buildVideoSuggestedTemplate({ category: resolvedCategory, suggestion: suggested, language });
      const signalProductName = shouldUseGeneratedName
        ? generatedName
        : (form.productName || "");
      const matchedPreset = pickPresetBySignal(presets, suggested, signalProductName);
      const resolvedTemplate = matchedPreset || presets[0] || aiTemplate;

      setCategoryGroupFilter(nextGroup);
      setForm((prev) => ({
        ...prev,
        productName: shouldUseGeneratedName ? generatedName : prev.productName,
        category: resolvedCategory,
        durationSec: sanitizeDurationPreset(resolvedTemplate?.durationSec || prev.durationSec || 45),
        scriptMode: resolvedTemplate?.scriptMode || prev.scriptMode || "standard",
        priceSegment: normalizePriceSegment(resolvedTemplate?.priceSegment || prev.priceSegment || "mid"),
        industryPreset: resolvedTemplate?.value || prev.industryPreset,
        ...(shouldSoftApply
          ? {}
          : {
              channel: Number.isFinite(Number(suggested.channel)) ? Number(suggested.channel) : defaults.channel,
              openingStyle: Number.isFinite(Number(suggested.tone))
                ? Math.max(0, Math.min(2, Number(suggested.tone)))
                : defaults.openingStyle,
              mood: mapSuggestMoodLabel(language, suggested.mood),
              targetCustomer: cleanText(suggested.targetCustomer || "") || prev.targetCustomer,
              painPoint: cleanText(suggested.shortDescription || "") || prev.painPoint,
              highlights: toVideoSuggestHighlights(suggested.highlights).join("\n") || prev.highlights,
              proofPoint: cleanText(suggested.attributes?.[0]?.value || suggested.shortDescription || "") || prev.proofPoint
            })
      }));
      setAutoTemplateMeta({
        value: resolvedTemplate?.value || "",
        label: resolvedTemplate?.label || "",
        source: "image-suggest",
        at: Date.now()
      });

      setSuggestionPulseToken(Date.now());
      if (lowSignalSuggestion) {
        setMessage(language === "vi"
          ? "Ảnh chưa đủ tín hiệu mạnh. Đã gợi ý template gần nhất để bạn chỉnh nhanh."
          : "Image signal is weak. Applied nearest template suggestion so you can refine quickly.");
      } else if (hasCategoryConflict && mode === "manual") {
        setMessage(language === "vi"
          ? "Ảnh và tên sản phẩm đang lệch nhóm ngành, vui lòng kiểm tra lại trước khi tạo kịch bản."
          : "Image and product name suggest different categories. Please verify before generating the script.");
      } else {
        setMessage("");
      }

      trackEvent("image.suggest.success", {
        page: "scriptVideoReview",
        category: resolvedCategory,
        suggestedCategory,
        inferredCategory: inferredCategory || null,
        lowSignal: lowSignalSuggestion,
        mode,
        confidence: Number(suggested.confidence || 0)
      });
    } catch (error) {
      const fallback = language === "vi"
        ? "Không thể phân tích ảnh lúc này. Vui lòng thử lại với ảnh rõ sản phẩm hơn."
        : "Unable to analyze image now. Please retry with a clearer product image.";
      setMessage(error?.message || fallback);
      trackEvent("image.suggest.failed", {
        page: "scriptVideoReview",
        mode,
        error: error?.message || "unknown"
      });
    } finally {
      setSuggesting(false);
    }
  }

  async function suggestFromImages() {
    await suggestFromImagesInternal(form.images, "manual");
  }

  async function generateVideoScript() {
    setLoading(true);
    setMessage("");
    trackEvent("generate.submit", {
      page: "scriptVideoReview",
      category: form.category,
      channel: form.channel,
      hasHighlights: Boolean(String(form.highlights || "").trim())
    });
    try {
      const data = await apiPost(routes.api.generateVideoScript, {
        ...form,
        lang: toAiLang(language),
        highlights: splitLines(form.highlights),
        images: Array.isArray(form.images) ? form.images : [],
        durationSec: sanitizeDurationPreset(form.durationSec),
        scriptMode: form.scriptMode || "standard",
        priceSegment: normalizePriceSegment(form.priceSegment || "mid"),
        industryPreset: form.industryPreset || ""
      });
      setResult(data?.script || null);
      if (data?.historyId) {
        setActiveHistoryId(data.historyId);
      }
      await historyActions.refresh();
      trackEvent("generate.video-script.success", {
        category: form.category,
        channel: form.channel,
        source: data?.script?.source || "unknown"
      });
      trackEvent("generate.success", {
        page: "scriptVideoReview",
        category: form.category,
        channel: form.channel,
        source: data?.script?.source || "unknown"
      });
    } catch (error) {
      const fallback = copy?.messages?.generateError || "Không thể tạo nội dung lúc này.";
      const raw = error.message || fallback;
      setMessage(localizeKnownMessage(raw, copy) || raw);
      trackEvent("generate.video-script.failed", {
        category: form.category,
        channel: form.channel,
        error: raw || "unknown"
      });
      trackEvent("generate.failed", {
        page: "scriptVideoReview",
        category: form.category,
        channel: form.channel,
        error: raw || "unknown"
      });
    } finally {
      setLoading(false);
    }
  }

  async function saveEditedResult(nextResult) {
    if (!activeHistoryId) {
      throw new Error(language === "vi" ? "Vui lòng mở một bản trong lịch sử trước khi lưu chỉnh sửa." : "Please open a history item before saving edits.");
    }

    setSavingEdited(true);
    try {
      const payload = {
        historyId: activeHistoryId,
        contentType: "video_script",
        title: String(nextResult?.title || form.productName || "Video script").trim(),
        result: {
          ...nextResult,
          scenes: Array.isArray(nextResult?.scenes)
            ? nextResult.scenes.map((scene, index) => ({
              label: String(scene?.label || `Scene ${index + 1}`).trim(),
              voice: String(scene?.voice || "").trim(),
              visual: String(scene?.visual || "").trim()
            })).filter((scene) => scene.voice || scene.visual)
            : [],
          hashtags: Array.isArray(nextResult?.hashtags)
            ? nextResult.hashtags.map((item) => String(item || "").trim()).filter(Boolean)
            : [],
          shotList: Array.isArray(nextResult?.shotList)
            ? nextResult.shotList.map((item) => String(item || "").trim()).filter(Boolean)
            : []
        }
      };

      const data = await apiPost(routes.api.saveHistoryOutput, payload);
      const updatedItem = data?.item;
      if (!updatedItem) {
        throw new Error(language === "vi" ? "Không thể lưu chỉnh sửa lúc này." : "Unable to save edits right now.");
      }

      const nextHistoryId = updatedItem.id || activeHistoryId;
      setActiveHistoryId(nextHistoryId || null);
      setResult(updatedItem.result || null);
      setForm((prev) => ({
        ...prev,
        ...(updatedItem.form || {}),
        images: Array.isArray(updatedItem?.form?.images) ? updatedItem.form.images : [],
        highlights: serializeHighlights(updatedItem?.form?.highlights ?? prev.highlights),
        durationSec: sanitizeDurationPreset(updatedItem?.form?.durationSec ?? prev.durationSec),
        priceSegment: normalizePriceSegment(updatedItem?.form?.priceSegment || prev.priceSegment),
        industryPreset: updatedItem?.form?.industryPreset || prev.industryPreset || ""
      }));
      await historyActions.refresh();
      trackEvent("output.save", {
        page: "scriptVideoReview",
        historyId: nextHistoryId,
        contentType: "video_script"
      });
    } finally {
      setSavingEdited(false);
    }
  }

  return {
    session,
    form,
    result,
    loading,
    savingEdited,
    suggesting,
    suggestion,
    suggestionPulseToken,
    autoTemplateMeta,
    message,
    history,
    favoriteIds,
    activeHistoryId,
    localizedConfig,
    openingStyleOptions,
    moodPresetOptions,
    scriptModeOptions,
    categoryOptions,
    industryPresetOptions,
    industryPresetCatalog,
    selectedIndustryPreset,
    categoryGroupFilter,
    actions: {
      applySample,
      applyIndustryTemplate,
      clearForm,
      setField,
      setCategoryGroupFilter: setCategoryGroup,
      handleImageSelect,
      removeImage,
      suggestFromImages,
      generateVideoScript,
      saveEditedResult,
      openHistoryItem: (item) => {
        if (!item) return;
        setActiveHistoryId(item.id || null);
        setResult(item.result || null);
        setForm((prev) => ({
          ...prev,
          ...(item.form || {}),
          images: Array.isArray(item?.form?.images) ? item.form.images : [],
          highlights: serializeHighlights(item?.form?.highlights ?? prev.highlights),
          durationSec: sanitizeDurationPreset(item?.form?.durationSec ?? prev.durationSec),
          priceSegment: normalizePriceSegment(item?.form?.priceSegment || prev.priceSegment),
          industryPreset: item?.form?.industryPreset || ""
        }));
        setAutoTemplateMeta(null);
      },
      toggleFavorite: historyActions.toggleFavorite,
      deleteHistory: historyActions.deleteHistory
    }
  };
}
