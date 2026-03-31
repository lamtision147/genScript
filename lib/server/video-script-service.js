import http from "http";
import https from "https";
import { trackAiUsageEvent } from "@/lib/server/ai-usage-service";

const SUPPORTED_LANGUAGES = new Set(["vi", "en", "zh", "ja", "ko", "es", "fr", "de"]);
const VIDEO_SCRIPT_CATEGORY_VALUES = new Set([
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
]);

const LANGUAGE_LABEL = {
  vi: "Vietnamese (vi)",
  en: "English (en)",
  zh: "Chinese Simplified (zh)",
  ja: "Japanese (ja)",
  ko: "Korean (ko)",
  es: "Spanish (es)",
  fr: "French (fr)",
  de: "German (de)"
};

const CHANNEL_LABEL = {
  vi: ["TikTok", "Shopee", "TikTok + Shopee"],
  en: ["TikTok", "Shopee", "TikTok + Shopee"]
};

const OPENING_STYLE = {
  vi: [
    "Mở bằng nỗi đau người xem đang gặp phải trong 1 câu ngắn, mạnh.",
    "Mở bằng so sánh trước/sau gây tò mò trong 2 giây đầu.",
    "Mở bằng tuyên bố ngược số đông nhưng vẫn hợp lý và an toàn."
  ],
  en: [
    "Open with a sharp pain-point in one short line.",
    "Open with a before/after curiosity line in first 2 seconds.",
    "Open with a contrarian but credible statement."
  ]
};

const CATEGORY_VIDEO_DIRECTIVES = {
  fashion: {
    vi: "Nhấn vào form, chất liệu, cảm giác mặc lên dáng và bối cảnh phối đồ thật.",
    en: "Emphasize fit, fabric feel, silhouette effect, and real outfit context."
  },
  skincare: {
    vi: "Nhấn texture, độ thấm, phản ứng trên da và kết quả quan sát được theo thời gian.",
    en: "Focus on texture, absorption, skin reaction, and observable over-time outcomes."
  },
  beautyTools: {
    vi: "Nhấn thao tác thực tế, độ êm an toàn và kết quả dễ cảm nhận khi dùng đều.",
    en: "Highlight practical handling, safe comfort, and results that are noticeable with consistent use."
  },
  home: {
    vi: "Đặt sản phẩm vào bối cảnh sinh hoạt tại nhà và lợi ích tiết kiệm công sức rõ ràng.",
    en: "Place product in real home routines with clear convenience/time-saving outcomes."
  },
  furnitureDecor: {
    vi: "Nhấn tác động thẩm mỹ không gian, độ hợp layout và tính tiện dụng khi đặt thực tế.",
    en: "Emphasize visual atmosphere impact, layout fit, and practical usability in real spaces."
  },
  electronics: {
    vi: "Chuyển thông số thành trải nghiệm dùng thực tế, tránh đọc như bảng kỹ thuật.",
    en: "Translate specs into practical experience, avoid sounding like a raw spec sheet."
  },
  food: {
    vi: "Gợi vị, cảm giác ăn/uống và bối cảnh dùng hằng ngày, giữ sự chân thật.",
    en: "Describe taste/feel and daily usage context while keeping claims credible."
  },
  householdEssentials: {
    vi: "Nhấn hiệu quả dùng lặp lại mỗi ngày: sạch nhanh, tiện định lượng và dễ duy trì.",
    en: "Focus on repeat daily usage: effective cleaning, easy dosing, and routine convenience."
  },
  footwear: {
    vi: "Nhấn cảm giác lên chân, độ êm, độ vững và độ hợp outfit.",
    en: "Highlight on-foot comfort, support, stability, and styling versatility."
  },
  bags: {
    vi: "Mô tả form, ngăn chứa, độ tiện mang theo và cảm giác hoàn thiện outfit.",
    en: "Describe bag shape, compartment utility, carry comfort, and outfit-finishing effect."
  },
  accessories: {
    vi: "Tập trung vào vai trò tạo điểm nhấn và cách phụ kiện nâng tổng thể.",
    en: "Show how accessories create visual accents and improve the full look."
  },
  fragrance: {
    vi: "Gợi mood mùi hương, bối cảnh dùng và ấn tượng để lại sau vài giờ.",
    en: "Convey scent mood, usage moments, and lasting impression over hours."
  },
  pet: {
    vi: "Đặt trọng tâm vào an tâm cho chủ nuôi và sự phù hợp cho thú cưng.",
    en: "Balance owner reassurance with practical pet suitability."
  },
  sports: {
    vi: "Nhấn chuyển động, độ bền, độ tiện khi mang theo trong lúc tập.",
    en: "Focus on movement, durability, and workout-ready convenience."
  },
  motherBaby: {
    vi: "Giọng cần tạo an tâm: an toàn chất liệu, vệ sinh và phù hợp độ tuổi.",
    en: "Use reassurance-first language: safety, hygiene, and age suitability."
  },
  healthCare: {
    vi: "Giọng rõ ràng, thực tế, không claim điều trị; nhấn hỗ trợ theo dõi/chăm sóc tại nhà.",
    en: "Keep wording factual and practical; no treatment claims, focus on home monitoring/support usage."
  },
  booksStationery: {
    vi: "Nhấn trải nghiệm đọc/viết, bố cục, khả năng duy trì thói quen học tập/công việc.",
    en: "Emphasize reading/writing experience, layout clarity, and routine productivity value."
  },
  toysGames: {
    vi: "Nhấn độ phù hợp độ tuổi, tính tương tác và giá trị giải trí/giáo dục.",
    en: "Highlight age fit, interaction quality, and entertainment/learning value."
  },
  autoMoto: {
    vi: "Mô tả độ tương thích lắp đặt, độ chắc, độ ổn định khi di chuyển.",
    en: "Describe fit compatibility, mounting stability, and road-use reliability."
  },
  phoneTablet: {
    vi: "Biến thông số thành trải nghiệm: pin, độ mượt, độ tiện trong sinh hoạt hằng ngày.",
    en: "Turn specs into user outcomes: battery confidence, smoothness, and daily utility."
  },
  computerOffice: {
    vi: "Nhấn hiệu suất công việc, ổn định kết nối và giảm ma sát thao tác.",
    en: "Focus on workflow efficiency, connection stability, and lower usage friction."
  },
  cameraDrone: {
    vi: "Nhấn độ nét, độ ổn định, tính tiện trong quy trình quay/chụp thực tế.",
    en: "Focus on image clarity, capture stability, and practical shooting workflow."
  },
  homeAppliances: {
    vi: "Đặt vào bối cảnh gia đình: tiết kiệm thời gian, dễ thao tác, dễ vệ sinh.",
    en: "Frame in home routines: time-saving, easy operation, and easy maintenance."
  },
  toolsHardware: {
    vi: "Nhấn lực, độ bền, độ ổn định thao tác và tính an toàn thực tế.",
    en: "Emphasize output strength, durability, control stability, and practical safety."
  },
  digitalGoods: {
    vi: "Làm rõ giá trị nhận ngay, phạm vi truy cập và lợi ích tiết kiệm thời gian áp dụng.",
    en: "Clarify instant-delivery value, access scope, and time-saving practical outcomes."
  },
  other: {
    vi: "Tập trung giá trị thực, bối cảnh dùng rõ, tránh khen chung chung.",
    en: "Keep practical value concrete with clear use context and avoid generic hype."
  }
};

const CATEGORY_HASHTAG_HINTS = {
  fashion: ["#thoitrang", "#fashion"],
  skincare: ["#skincare", "#chamda"],
  beautyTools: ["#beautytools", "#personalcare"],
  home: ["#giadung", "#homeliving"],
  furnitureDecor: ["#furnituredecor", "#homestyling"],
  electronics: ["#dientu", "#tech"],
  food: ["#thucpham", "#food"],
  householdEssentials: ["#householdessentials", "#fmcg"],
  footwear: ["#giaydep", "#footwear"],
  bags: ["#tuixach", "#bags"],
  accessories: ["#phukien", "#accessories"],
  fragrance: ["#nuochoa", "#fragrance"],
  pet: ["#thucung", "#petcare"],
  sports: ["#thethao", "#fitness"],
  motherBaby: ["#mevabe", "#motherbaby"],
  healthCare: ["#suckhoe", "#healthcare"],
  booksStationery: ["#vanphongpham", "#stationery"],
  toysGames: ["#dochoi", "#toys"],
  autoMoto: ["#xemay", "#automoto"],
  phoneTablet: ["#dienthoai", "#mobile"],
  computerOffice: ["#thietbivanphong", "#computeroffice"],
  cameraDrone: ["#camera", "#drone"],
  homeAppliances: ["#diengiadung", "#homeappliances"],
  toolsHardware: ["#dungcu", "#toolshardware"],
  digitalGoods: ["#digitalgoods", "#voucher"],
  other: ["#goiysanpham", "#productreview"]
};

function normalizeLanguage(lang) {
  const normalized = String(lang || "vi").toLowerCase().trim();
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : "vi";
}

function getLangKey(lang) {
  return normalizeLanguage(lang) === "vi" ? "vi" : "en";
}

function compact(value, max = 320) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function toInt(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function clipInt(value, min, max, fallback = min) {
  const next = toInt(value, fallback);
  if (next < min) return min;
  if (next > max) return max;
  return next;
}

function sanitizeDurationPreset(value) {
  const allowed = [15, 30, 45, 60, 90];
  const next = Number(value);
  return allowed.includes(next) ? next : 45;
}

function parseList(raw, { max = 8, maxLength = 140 } = {}) {
  if (Array.isArray(raw)) {
    return raw.map((item) => compact(item, maxLength)).filter(Boolean).slice(0, max);
  }
  return String(raw || "")
    .split(/\n|\||;/)
    .map((item) => compact(item, maxLength))
    .filter(Boolean)
    .slice(0, max);
}

function parseJsonObject(text) {
  const raw = String(text || "").trim();
  if (!raw) return null;
  const candidates = [
    raw,
    raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim()
  ];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // noop
    }
  }
  const first = raw.indexOf("{");
  const last = raw.lastIndexOf("}");
  if (first !== -1 && last > first) {
    try {
      return JSON.parse(raw.slice(first, last + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function extractMessageText(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part?.type === "text") return part.text || "";
      return "";
    })
    .join("\n");
}

function normalizeLines(value) {
  if (Array.isArray(value)) return value.map((item) => compact(item, 220)).filter(Boolean).slice(0, 6);
  return String(value || "")
    .split(/\n|\||;/)
    .map((item) => compact(item, 220))
    .filter(Boolean)
    .slice(0, 6);
}

function normalizeSegment(value, maxLines = 4) {
  return normalizeLines(value).slice(0, maxLines);
}

function toTeleprompterLines(text, { targetWords = 10, maxWords = 12, maxLines = 3 } = {}) {
  const words = String(text || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines = [];
  let cursor = 0;

  while (cursor < words.length && lines.length < maxLines) {
    const remaining = words.length - cursor;
    const chunkSize = remaining <= maxWords ? remaining : Math.min(maxWords, targetWords);
    lines.push(words.slice(cursor, cursor + chunkSize).join(" "));
    cursor += chunkSize;
  }

  return lines;
}

function normalizeVideoHashtags(value, payload, langKey) {
  const base = parseList(value, { max: 8, maxLength: 42 })
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .map((tag) => tag.replace(/[^#\p{L}\p{N}_]/gu, ""))
    .filter((tag) => tag.length > 1);

  const categoryHints = CATEGORY_HASHTAG_HINTS[payload.category] || CATEGORY_HASHTAG_HINTS.other;
  const categoryTag = categoryHints[langKey === "vi" ? 0 : 1] || categoryHints[0] || "#review";
  const intentTag = langKey === "vi" ? "#review" : "#productreview";

  const merged = [];
  const seen = new Set();
  for (const tag of [categoryTag, intentTag, ...base]) {
    const key = String(tag || "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(tag);
    if (merged.length >= 8) break;
  }

  return merged;
}

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === "http:" ? http : https;
    const request = transport.request({
      method: "POST",
      hostname: target.hostname,
      port: target.port || (target.protocol === "http:" ? 80 : 443),
      path: `${target.pathname}${target.search}`,
      headers: { "Content-Type": "application/json", ...headers }
    }, (response) => {
      let data = "";
      response.on("data", (chunk) => { data += chunk; });
      response.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          if ((response.statusCode || 500) >= 400) {
            reject(new Error(parsed.error?.message || parsed.error || `HTTP ${response.statusCode}`));
            return;
          }
          resolve(parsed);
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("error", reject);
    request.setTimeout(45000, () => {
      request.destroy(new Error("AI request timeout"));
    });
    request.write(JSON.stringify(body));
    request.end();
  });
}

function buildPrompt(payload) {
  const lang = normalizeLanguage(payload.lang);
  const langKey = getLangKey(lang);
  const languageLabel = LANGUAGE_LABEL[lang] || LANGUAGE_LABEL.vi;
  const channelLabel = (CHANNEL_LABEL[langKey] || CHANNEL_LABEL.vi)[clipInt(payload.channel, 0, 2, 0)];
  const openingStyle = (OPENING_STYLE[langKey] || OPENING_STYLE.vi)[clipInt(payload.openingStyle, 0, 2, 0)];
  const scriptMode = String(payload.scriptMode || "standard").toLowerCase() === "teleprompter" ? "teleprompter" : "standard";
  const teleprompterRule = langKey === "en"
    ? "- Script mode teleprompter: each voice line should be 8-12 words, easy to read in one breath."
    : "- Chế độ teleprompter: mỗi dòng thoại dài 8-12 từ, đọc một hơi là xong.";
  const highlights = (payload.highlights || []).join(", ");
  const categoryDirective = CATEGORY_VIDEO_DIRECTIVES[payload.category]?.[langKey] || CATEGORY_VIDEO_DIRECTIVES.other[langKey];

  const qualityBlock = langKey === "en"
    ? [
        "- Scene 1: create immediate context + pain in under 8 seconds.",
        "- Scene 2-3: each scene must add NEW value (feature -> practical outcome -> evidence).",
        "- Include one concrete proof marker (timeframe, behavior change, measurable feeling).",
        "- Keep spoken voice natural, no hard-sell shouting, no generic filler.",
        "- CTA should be soft but action-oriented (comment, DM, save, check link)."
      ].join("\n")
    : [
        "- Cảnh 1: vào bối cảnh + nỗi đau ngay trong 8 giây đầu.",
        "- Cảnh 2-3: mỗi cảnh phải thêm giá trị MỚI (tính năng -> kết quả thực tế -> bằng chứng).",
        "- Luôn có ít nhất 1 dấu hiệu bằng chứng cụ thể (mốc thời gian, thay đổi hành vi, cảm nhận đo được).",
        "- Lời thoại tự nhiên, không gào bán hàng, không filler rỗng.",
        "- CTA mềm nhưng có hướng hành động (comment, inbox, lưu video, xem link)."
      ].join("\n");

  if (langKey === "en") {
    return `You are a high-conversion short-video script writer for ecommerce creators on ${channelLabel}.

Goal:
- Write a review-style short video script that is NOT boring.
- Keep viewer retention high in first 3 seconds.
- Make the opening irresistible so viewers do not scroll away.

Hard rules:
- Output language is locked to ${languageLabel}. All JSON text must be in ${languageLabel} only.
- Do not use generic opening like "Hello everyone".
- First opening line must be <= 14 words and create immediate curiosity/tension.
- Every scene line must be practical, vivid, and easy to speak naturally.
- Include at least one concrete proof detail (experience, texture, result, behavior).
- End with a soft CTA that nudges action without sounding pushy.
${scriptMode === "teleprompter" ? teleprompterRule : ""}

Category directive:
- ${categoryDirective}

Narrative quality constraints:
${qualityBlock}

Opening strategy:
- ${openingStyle}

Input:
- Product name: ${payload.productName || "N/A"}
- Category: ${payload.category || "other"}
- Target customer: ${payload.targetCustomer || "N/A"}
- Core pain point: ${payload.painPoint || "N/A"}
- Key highlights: ${highlights || "N/A"}
- Key proof: ${payload.proofPoint || "N/A"}
- Price segment: ${payload.priceSegment || "N/A"}
- Preferred duration seconds: ${clipInt(payload.durationSec, 15, 120, 45)}
- Content mood: ${payload.mood || "dynamic"}

Return valid JSON only:
{
  "title":"...",
  "hook":"...",
  "scenes":[{"label":"Scene 1","voice":"...","visual":"..."}],
  "cta":"...",
  "hashtags":["#..."],
  "shotList":["..."]
}`;
  }

  return `Bạn là biên kịch short video chuyển đổi cao cho creator bán hàng trên ${channelLabel}.

Mục tiêu:
- Viết kịch bản review video ngắn KHÔNG nhàm chán.
- Giữ người xem ở lại trong 3 giây đầu.
- Câu mở đầu phải đủ cuốn để người xem không lướt đi.

Quy tắc bắt buộc:
- Khóa ngôn ngữ đầu ra: ${languageLabel}. Toàn bộ text trong JSON phải đúng ngôn ngữ này.
- Không mở đầu kiểu chung chung như "Xin chào mọi người".
- Câu hook đầu tiên tối đa 14 từ, phải tạo tò mò/căng thẳng tích cực ngay.
- Lời thoại từng cảnh phải dễ nói, tự nhiên, giàu hình ảnh thực tế.
- Có ít nhất 1 chi tiết bằng chứng cụ thể (trải nghiệm, cảm giác, kết quả, hành vi).
- Kết thúc bằng CTA mềm, gợi hành động nhưng không gượng ép.
${scriptMode === "teleprompter" ? teleprompterRule : ""}

Định hướng theo ngành:
- ${categoryDirective}

Ràng buộc chất lượng kịch bản:
${qualityBlock}

Định hướng mở đầu:
- ${openingStyle}

Thông tin đầu vào:
- Tên sản phẩm: ${payload.productName || "N/A"}
- Danh mục: ${payload.category || "other"}
- Khách hàng mục tiêu: ${payload.targetCustomer || "N/A"}
- Nỗi đau chính: ${payload.painPoint || "N/A"}
- Điểm nổi bật: ${highlights || "N/A"}
- Bằng chứng chính: ${payload.proofPoint || "N/A"}
- Mức giá mục tiêu: ${payload.priceSegment || "N/A"}
- Thời lượng mong muốn (giây): ${clipInt(payload.durationSec, 15, 120, 45)}
- Mood nội dung: ${payload.mood || "năng động"}

Chỉ trả JSON hợp lệ:
{
  "title":"...",
  "hook":"...",
  "scenes":[{"label":"Cảnh 1","voice":"...","visual":"..."}],
  "cta":"...",
  "hashtags":["#..."],
  "shotList":["..."]
}`;
}

function buildFallback(payload) {
  const lang = normalizeLanguage(payload.lang);
  const isVi = getLangKey(lang) === "vi";
  const productName = compact(payload.productName, 120) || (isVi ? "Sản phẩm" : "Product");
  return {
    title: isVi ? `Kịch bản review nhanh cho ${productName}` : `Quick review script for ${productName}`,
    hook: isVi
      ? `Bạn đang gặp vấn đề này với ${productName}? Đừng lướt qua.`
      : `Still struggling with ${productName}? Don't scroll yet.`,
    scenes: isVi
      ? [
          { label: "Cảnh 1", voice: `Mình test nhanh ${productName} trong bối cảnh dùng thật.`, visual: "Cận cảnh sản phẩm + tay thao tác" },
          { label: "Cảnh 2", voice: "Điểm mình thích nhất là cảm giác dùng và hiệu quả nhìn thấy ngay.", visual: "Before/after hoặc biểu cảm thật" },
          { label: "Cảnh 3", voice: "Nếu bạn thuộc nhóm khách này thì đáng thử ngay hôm nay.", visual: "Text overlay lợi ích chính" }
        ]
      : [
          { label: "Scene 1", voice: `I tested ${productName} in a real use context.`, visual: "Close-up product usage shot" },
          { label: "Scene 2", voice: "The best part is the feel and immediate visible value.", visual: "Before/after or live reaction" },
          { label: "Scene 3", voice: "If you fit this user profile, this is worth trying today.", visual: "Overlay key benefit text" }
        ],
    cta: isVi ? "Comment từ khóa 'review' để mình gửi bản phù hợp nhất cho bạn." : "Comment 'review' and I will send the best-fit version for you.",
    hashtags: isVi ? ["#review", "#TikTokShop", "#Shopee", "#goiysanpham"] : ["#review", "#TikTokShop", "#Shopee", "#productfind"],
    shotList: isVi
      ? ["Hook 0-3s", "Close-up texture/detail", "Proof moment", "Soft CTA end"]
      : ["Hook 0-3s", "Close-up detail", "Proof moment", "Soft CTA end"],
    source: "fallback",
    quality: {
      score: 35,
      grade: "C",
      reasons: isVi
        ? ["AI chưa sẵn sàng nên dùng kịch bản dự phòng"]
        : ["Fallback script used because AI is unavailable"]
    }
  };
}

function normalizeResult(payload, parsed) {
  const lang = normalizeLanguage(payload.lang);
  const isVi = getLangKey(lang) === "vi";

  const scenesRaw = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  const scenes = scenesRaw
    .map((item, index) => ({
      label: compact(item?.label, 36) || (isVi ? `Cảnh ${index + 1}` : `Scene ${index + 1}`),
      voice: compact(item?.voice, 260),
      visual: compact(item?.visual, 180)
    }))
    .filter((scene) => scene.voice || scene.visual)
    .slice(0, 6);

  const hashtags = normalizeVideoHashtags(parsed.hashtags, payload, getLangKey(payload.lang));

  const shotList = normalizeSegment(parsed.shotList, 8);
  const scriptMode = String(payload.scriptMode || "standard").toLowerCase() === "teleprompter" ? "teleprompter" : "standard";

  const normalizedScenes = scriptMode === "teleprompter"
    ? scenes.map((scene) => {
        const lines = toTeleprompterLines(scene.voice, { targetWords: 10, maxWords: 12, maxLines: 3 });
        return {
          ...scene,
          voice: lines.join("\n") || scene.voice
        };
      })
    : scenes;

  const hasProofToken = /(\d|ngay|tuan|thang|day|week|month|test|sau|after)/i.test(`${payload.proofPoint || ""} ${(normalizedScenes || []).map((scene) => scene.voice || "").join(" ")}`);
  const qualityScore = (() => {
    let score = 64;
    if (normalizedScenes.length >= 3) score += 8;
    if ((compact(parsed.hook, 180) || "").split(/\s+/).filter(Boolean).length <= 14) score += 8;
    if (hasProofToken) score += 8;
    if ((compact(parsed.cta, 180) || "").length >= 16) score += 6;
    if ((payload.highlights || []).length >= 3) score += 4;
    if (hashtags.length >= 4) score += 4;
    return Math.max(35, Math.min(95, score));
  })();

  return {
    title: compact(parsed.title, 140) || (isVi ? "Kịch bản review video" : "Video review script"),
    hook: compact(parsed.hook, 180),
    scenes: normalizedScenes,
    cta: compact(parsed.cta, 180),
    hashtags,
    shotList,
    source: "ai",
    quality: {
      score: qualityScore,
      grade: qualityScore >= 90 ? "S" : qualityScore >= 82 ? "A" : qualityScore >= 72 ? "B" : "C",
      reasons: isVi
        ? [
            "Hook ngắn gọn theo chuẩn giữ người xem",
            "Scene có tiến triển giá trị và có bằng chứng",
            "CTA mềm + hashtag đúng ngành"
          ]
        : [
            "Hook follows high-retention short format",
            "Scenes progress with evidence",
            "Soft CTA with category-fit hashtags"
          ]
    }
  };
}

export function normalizeVideoScriptPayload(raw = {}) {
  const lang = normalizeLanguage(raw.lang);
  const productName = compact(raw.productName, 140);
  const candidateCategory = compact(raw.category, 48).toLowerCase() || "other";
  const category = VIDEO_SCRIPT_CATEGORY_VALUES.has(candidateCategory) ? candidateCategory : "other";
  const targetCustomer = compact(raw.targetCustomer, 220);
  const painPoint = compact(raw.painPoint, 220);
  const proofPoint = compact(raw.proofPoint, 220);
  const mood = compact(raw.mood, 80);
  const priceSegment = compact(raw.priceSegment, 40);
  const highlights = parseList(raw.highlights, { max: 8, maxLength: 110 });
  const durationSec = sanitizeDurationPreset(raw.durationSec);
  const openingStyle = clipInt(raw.openingStyle, 0, 2, 0);
  const channel = clipInt(raw.channel, 0, 2, 0);
  const scriptMode = String(raw.scriptMode || "standard").toLowerCase() === "teleprompter" ? "teleprompter" : "standard";

  if (!productName) {
    throw new Error(lang === "vi" ? "Vui lòng nhập tên sản phẩm để tạo kịch bản video." : "Please enter product name to generate video script.");
  }

  if (!painPoint && !highlights.length && !proofPoint) {
    throw new Error(lang === "vi"
      ? "Hãy thêm nỗi đau, highlight hoặc bằng chứng để kịch bản đủ cuốn hút."
      : "Please add pain point, highlights, or proof point for a compelling script.");
  }

  return {
    lang,
    productName,
    category,
    targetCustomer,
    painPoint,
    proofPoint,
    mood,
    priceSegment,
    highlights,
    durationSec,
    openingStyle,
    channel,
    scriptMode
  };
}

export async function generateVideoReviewScript(rawPayload = {}) {
  const payload = normalizeVideoScriptPayload(rawPayload);
  const apiBase = process.env.AI_API_BASE;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "cx/gpt-5.4";

  if (!apiBase || !apiKey) {
    return buildFallback(payload);
  }

  const requestBody = {
    model,
    messages: [{ role: "user", content: [{ type: "text", text: buildPrompt(payload) }] }],
    stream: false,
    response_format: { type: "json_object" }
  };

  const headers = { Authorization: `Bearer ${apiKey}` };
  if (/openrouter\.ai/i.test(apiBase)) {
    if (process.env.PUBLIC_BASE_URL) headers["HTTP-Referer"] = process.env.PUBLIC_BASE_URL;
    headers["X-Title"] = "gen-script-video-review";
  }

  try {
    const endpoint = `${apiBase.replace(/\/$/, "")}/chat/completions`;
    trackAiUsageEvent({ type: "generate_request" });
    const result = await postJson(endpoint, requestBody, headers);
    const raw = result.choices?.[0]?.message?.content;
    const parsed = parseJsonObject(extractMessageText(raw));

    if (!parsed || typeof parsed !== "object") {
      trackAiUsageEvent({ type: "generate_fallback" });
      return buildFallback(payload);
    }

    const normalized = normalizeResult(payload, parsed);
    if (!normalized.hook || !normalized.scenes.length) {
      trackAiUsageEvent({ type: "generate_fallback" });
      return buildFallback(payload);
    }

    trackAiUsageEvent({ type: "generate_success" });
    return normalized;
  } catch {
    trackAiUsageEvent({ type: "generate_fallback" });
    return buildFallback(payload);
  }
}
