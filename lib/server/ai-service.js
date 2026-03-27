import http from "http";
import https from "https";
import { aiCategoryNotes, aiCategoryQualityRules } from "@/lib/ai-prompt-config";

const CHANNEL_LABELS = {
  vi: ["TikTok Shop", "Shopee", "TikTok Shop + Shopee"],
  en: ["TikTok Shop", "Shopee", "TikTok Shop + Shopee"]
};

const CHANNEL_GUIDES = {
  vi: [
    "Ưu tiên nhịp nhanh, mở đầu bắt mắt, câu ngắn và dễ lướt trên mobile.",
    "Ưu tiên bố cục rõ, thông tin sạch, dễ quét nhanh như mô tả chuẩn sàn.",
    "Cân bằng giữa hook bắt mắt và bố cục thông tin rõ ràng, dễ hiểu."
  ],
  en: [
    "Prioritize fast pacing, a strong hook, and mobile-friendly short lines.",
    "Prioritize clear structure, concise facts, and easy scanning.",
    "Balance a strong hook with clean, structured product information."
  ]
};

const TONE_GUIDES = {
  vi: [
    "Review tự nhiên: thân thiện, chân thật, không lên gân.",
    "Chuyên gia: tự tin, cụ thể, thuyết phục bằng chi tiết thực tế.",
    "Chốt sale mạnh: rõ lợi ích, tạo động lực mua, vẫn giữ uy tín thương hiệu."
  ],
  en: [
    "Natural review: friendly, authentic, and conversational.",
    "Expert tone: confident, concrete, and evidence-led.",
    "Sales-closing tone: benefit-first and persuasive while staying brand-safe."
  ]
};

const BRAND_STYLE_GUIDES = {
  vi: [
    "Cao cấp tối giản: câu chữ gọn, tinh tế, có khoảng thở.",
    "Trẻ trung hiện đại: năng động, tươi mới, gần với ngôn ngữ người dùng trẻ.",
    "Chuyên gia đáng tin: rõ ràng, chắc chắn, giúp người mua yên tâm.",
    "Bình dân chỉn chu: dễ hiểu, gần gũi nhưng vẫn chuyên nghiệp."
  ],
  en: [
    "Minimal premium: refined, concise, and polished.",
    "Young modern: energetic, fresh, and social-native.",
    "Trusted expert: clear, grounded, and reassuring.",
    "Accessible polished: simple, relatable, and tidy."
  ]
};

const MOOD_GUIDES = {
  vi: [
    "Tinh gọn sang trọng: mượt, sáng, có chất thẩm mỹ.",
    "Ấm áp gần gũi: thân thiện, dễ kết nối, không xa cách.",
    "Năng động cuốn hút: nhịp nhanh, giàu năng lượng tích cực.",
    "Tự tin thuyết phục: chắc nhịp, rõ luận điểm, chốt lợi ích tốt."
  ],
  en: [
    "Clean luxury: smooth, elegant, and visually rich.",
    "Warm approachable: friendly, human, and welcoming.",
    "Energetic appealing: lively, punchy, and engaging.",
    "Confident persuasive: assertive, clear, and conversion-ready."
  ]
};

const CATEGORY_LABELS = {
  vi: {
    fashion: "Thời trang",
    skincare: "Mỹ phẩm / Skincare",
    home: "Gia dụng",
    electronics: "Điện tử / Phụ kiện",
    food: "Thực phẩm / Đồ uống",
    footwear: "Giày dép",
    bags: "Túi xách / Ví",
    accessories: "Phụ kiện",
    fragrance: "Nước hoa / Hương thơm",
    pet: "Thú cưng",
    sports: "Thể thao / Fitness",
    other: "Khác"
  },
  en: {
    fashion: "Fashion",
    skincare: "Beauty / Skincare",
    home: "Home",
    electronics: "Electronics / Accessories",
    food: "Food / Beverage",
    footwear: "Footwear",
    bags: "Bags / Wallets",
    accessories: "Accessories",
    fragrance: "Fragrance",
    pet: "Pet",
    sports: "Sports / Fitness",
    other: "Other"
  }
};

function getLangKey(lang) {
  return lang === "en" ? "en" : "vi";
}

function compact(text) {
  return String(text || "").replace(/\s+/g, " ").trim();
}

function toNumberOr(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safePick(list, index, fallbackIndex = 0) {
  if (!Array.isArray(list) || !list.length) return "";
  const normalized = Number.isFinite(Number(index)) ? Number(index) : fallbackIndex;
  return list[Math.max(0, Math.min(list.length - 1, Math.floor(normalized)))] || list[fallbackIndex] || "";
}

function stripBulletPrefix(text) {
  return String(text || "").replace(/^[\s•\-*\d.)]+/, "").trim();
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

function parseJsonObject(text) {
  if (!text) return null;
  const raw = String(text).trim();
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

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const snippet = raw.slice(firstBrace, lastBrace + 1);
    try {
      return JSON.parse(snippet);
    } catch {
      return null;
    }
  }

  return null;
}

function asStringArray(value, { max = 6, maxLength = 140 } = {}) {
  if (Array.isArray(value)) {
    return value
      .map((item) => compact(item).slice(0, maxLength))
      .filter(Boolean)
      .slice(0, max);
  }
  if (typeof value === "string") {
    return value
      .split(/\n|\||;/)
      .map((item) => compact(item).slice(0, maxLength))
      .filter(Boolean)
      .slice(0, max);
  }
  return [];
}

function parseParagraphs(value) {
  if (Array.isArray(value)) {
    return value.map((item) => compact(item)).filter(Boolean).slice(0, 3);
  }
  if (typeof value === "string") {
    return value
      .split(/\n{2,}/)
      .map((item) => compact(item))
      .filter(Boolean)
      .slice(0, 3);
  }
  return [];
}

function getAttr(payload, idx) {
  return (payload.attributes || []).find((item) => Number(item.type) === idx && item.value)?.value || "";
}

function buildFallbackHashtags(payload) {
  const productTag = String(payload.productName || "sanpham")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join("");
  const base = {
    fashion: ["#Thoitrang", "#OutfitDaily", "#LenDoDep"],
    skincare: ["#SkincareRoutine", "#ChamDaMoiNgay", "#LanDaKhoe"],
    home: ["#SongGonGang", "#NhaCuaChiChu", "#HomeEssentials"],
    electronics: ["#TechDaily", "#SetupGonGang", "#DungHangNgay"],
    food: ["#AnVatDep", "#DoAnTienLoi", "#HealthyChoice"],
    footwear: ["#SneakerDaily", "#DiEmChan", "#MixDoDep"],
    bags: ["#BagDaily", "#PhuKienXinh", "#OutfitFinish"],
    accessories: ["#AccessoriesStyle", "#NangTamOutfit", "#MixAndMatch"],
    fragrance: ["#FragranceMood", "#MuiHuongCaTinh", "#HuongThomMoiNgay"],
    pet: ["#PetCare", "#ThuCungKhoe", "#PetLife"],
    sports: ["#FitnessDaily", "#TapLuyenThongMinh", "#MoveBetter"],
    other: ["#GoiYSanPham", "#BrandCopy", "#SellerStudio"]
  };
  const channelTags = ["#TikTokShop", "#Shopee", "#TikTokShopee"];
  return Array.from(new Set([
    `#${productTag || "sanpham"}`,
    channelTags[Math.max(0, Math.min(2, toNumberOr(payload.channel, 2)))],
    ...(base[payload.category] || base.other)
  ])).slice(0, 6);
}

function normalizeHashtags(tags, payload) {
  const candidates = Array.isArray(tags) ? tags : asStringArray(tags, { max: 8, maxLength: 40 });
  const cleaned = candidates
    .map((tag) => String(tag || "").trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .map((tag) => tag.replace(/[^#\p{L}\p{N}_]/gu, ""))
    .map((tag) => tag.slice(0, 34))
    .filter((tag) => tag.length > 1);

  const merged = Array.from(new Set([...cleaned, ...buildFallbackHashtags(payload)]));
  return merged.slice(0, 6);
}

function buildDefaultSecondLines(payload, langKey) {
  const lines = [];
  if (Array.isArray(payload.highlights) && payload.highlights.length) {
    for (const item of payload.highlights.slice(0, 4)) {
      const cleaned = stripBulletPrefix(item);
      if (!cleaned) continue;
      lines.push(`• ${cleaned}`);
    }
  }

  if (!lines.length && Array.isArray(payload.attributes) && payload.attributes.length) {
    for (const item of payload.attributes.slice(0, 4)) {
      const cleaned = stripBulletPrefix(item.value);
      if (!cleaned) continue;
      lines.push(`• ${cleaned}`);
    }
  }

  if (!lines.length) {
    lines.push(langKey === "en" ? "• Clear key product information for quick buyer understanding." : "• Trình bày rõ các điểm chính để người mua nắm nhanh thông tin.");
  }
  return lines;
}

function buildDefaultClosingLine(payload, langKey) {
  const parts = [];
  if (payload.targetCustomer) {
    parts.push(langKey === "en" ? `Best for ${payload.targetCustomer}.` : `Phù hợp với ${payload.targetCustomer}.`);
  }
  if (payload.priceSegment) {
    parts.push(langKey === "en" ? `Price segment: ${payload.priceSegment}.` : `Phân khúc giá: ${payload.priceSegment}.`);
  }
  if (!parts.length) {
    parts.push(
      langKey === "en"
        ? "The copy stays concise, clear, and ready to publish on ecommerce channels."
        : "Nội dung giữ nhịp gọn, rõ và sẵn sàng đăng lên các kênh bán hàng."
    );
  }
  return parts.join(" ");
}

function normalizeAiPayloadResult(payload, parsed) {
  const langKey = getLangKey(payload.lang);
  const headline = compact(parsed.headline || parsed.title || payload.productName || (langKey === "en" ? "Product" : "Sản phẩm"));
  const paragraphs = parseParagraphs(parsed.paragraphs);

  if (!paragraphs.length) {
    if (parsed.intro) paragraphs.push(compact(parsed.intro));
    if (parsed.feature) paragraphs.push(compact(parsed.feature));
    if (parsed.fitNote) paragraphs.push(compact(parsed.fitNote));
  }

  const bullets = [
    ...asStringArray(parsed.bullets, { max: 6, maxLength: 120 }),
    ...asStringArray(parsed.keyPoints, { max: 6, maxLength: 120 }),
    ...asStringArray(parsed.features, { max: 6, maxLength: 120 })
  ].slice(0, 6);

  const extraCatalogBullets = [
    ...asStringArray(parsed.sizeChart, { max: 4, maxLength: 120 }),
    ...asStringArray(parsed.careGuide, { max: 4, maxLength: 120 })
  ].slice(0, 6);

  const cta = compact(parsed.cta || parsed.callToAction || parsed.closing || parsed.exchangePolicy || "");

  const secondLines = [];
  if (paragraphs[1]) secondLines.push(paragraphs[1]);
  for (const item of [...bullets, ...extraCatalogBullets]) {
    const cleaned = stripBulletPrefix(item);
    if (!cleaned) continue;
    secondLines.push(`• ${cleaned}`);
  }
  if (!secondLines.length) {
    secondLines.push(...buildDefaultSecondLines(payload, langKey));
  }

  const thirdLines = [];
  if (paragraphs[2]) thirdLines.push(paragraphs[2]);
  if (cta) thirdLines.push(cta);
  if (!thirdLines.length) {
    thirdLines.push(buildDefaultClosingLine(payload, langKey));
  }

  const intro = compact(paragraphs[0] || "");
  const firstParagraph = intro
    ? intro.toLowerCase().startsWith(headline.toLowerCase())
      ? intro
      : `${headline}\n${intro}`
    : headline;

  return {
    paragraphs: [firstParagraph, secondLines.join("\n"), thirdLines.join("\n")],
    hashtags: normalizeHashtags(parsed.hashtags || parsed.tags || [], payload),
    source: "ai",
    meta: payload.improved ? "Bản cải tiến theo phong cách chuyên gia" : "Bản mô tả sản phẩm đầu tiên"
  };
}

function formatFashionCatalog(result, payload, langKey) {
  const attrs = payload.attributes || [];
  const valueOf = (idx) => attrs.find((item) => Number(item.type) === idx && item.value)?.value || "";

  const labels = langKey === "en"
    ? {
        material: "Material",
        color: "Color",
        size: "Size",
        highlight: "Highlights",
        fitFor: "Best for",
        price: "Price segment",
        noteLead: "Size guidance is for reference. Real-life color may vary slightly due to lighting and display differences.",
        fallbackNotice: "Details are presented in a clean catalog style for quick buyer scanning."
      }
    : {
        material: "Chất liệu",
        color: "Màu sắc",
        size: "Size",
        highlight: "Điểm nổi bật",
        fitFor: "Phù hợp",
        price: "Phân khúc giá",
        noteLead: "Bảng size mang tính tham khảo. Màu sắc thực tế có thể chênh lệch nhẹ do ánh sáng và thiết bị hiển thị.",
        fallbackNotice: "Thông tin được trình bày gọn theo kiểu catalog để người mua dễ quét nhanh."
      };

  const introSource = String(result.paragraphs?.[0] || "").split("\n").filter(Boolean).slice(-1)[0] || "";
  const secondSourceLines = String(result.paragraphs?.[1] || "")
    .split("\n")
    .map((line) => compact(line))
    .filter(Boolean)
    .slice(0, 4);

  const bullets = [];
  if (valueOf(0)) bullets.push(`• ${labels.material}: ${valueOf(0)}`);
  if (valueOf(2)) bullets.push(`• ${labels.color}: ${valueOf(2)}`);
  if (valueOf(1)) bullets.push(`• ${labels.size}: ${valueOf(1)}`);
  if ((payload.highlights || []).length) bullets.push(`• ${labels.highlight}: ${(payload.highlights || []).slice(0, 4).join(", ")}`);

  const mergedSecond = Array.from(new Set([
    ...secondSourceLines.map((line) => (line.startsWith("•") ? line : `• ${line}`)),
    ...bullets
  ])).slice(0, 7);

  const notes = [];
  if (compact(result.paragraphs?.[2])) notes.push(compact(result.paragraphs[2]));
  if (!notes.some((item) => item.includes(labels.noteLead.slice(0, 18)))) {
    notes.push(labels.noteLead);
  }
  if (payload.targetCustomer) notes.push(`• ${labels.fitFor}: ${payload.targetCustomer}`);
  if (payload.priceSegment) notes.push(`• ${labels.price}: ${payload.priceSegment}`);
  if (!notes.length) notes.push(labels.fallbackNotice);

  const first = `${payload.productName || (langKey === "en" ? "Product" : "Sản phẩm")}\n${compact(introSource || payload.shortDescription || "")}`.trim();

  return {
    ...result,
    paragraphs: [
      first,
      mergedSecond.join("\n") || buildDefaultSecondLines(payload, langKey).join("\n"),
      notes.join("\n")
    ]
  };
}

function formatSkincare(result, payload, langKey) {
  const labels = langKey === "en"
    ? ["Ingredients", "Best for", "Texture"]
    : ["Thành phần", "Phù hợp", "Kết cấu"];
  const bullets = [];
  if (getAttr(payload, 0)) bullets.push(`• ${labels[0]}: ${getAttr(payload, 0)}`);
  if (getAttr(payload, 1)) bullets.push(`• ${labels[1]}: ${getAttr(payload, 1)}`);
  if (getAttr(payload, 3)) bullets.push(`• ${labels[2]}: ${getAttr(payload, 3)}`);
  return {
    ...result,
    paragraphs: [
      result.paragraphs[0] || "",
      [result.paragraphs[1] || "", bullets.join("\n")].filter(Boolean).join("\n"),
      result.paragraphs[2] || ""
    ]
  };
}

function formatUtility(result, payload, labels) {
  const bullets = [];
  if (getAttr(payload, 0)) bullets.push(`• ${labels[0]}: ${getAttr(payload, 0)}`);
  if (getAttr(payload, 1)) bullets.push(`• ${labels[1]}: ${getAttr(payload, 1)}`);
  if (getAttr(payload, 2)) bullets.push(`• ${labels[2]}: ${getAttr(payload, 2)}`);
  return {
    ...result,
    paragraphs: [
      result.paragraphs[0] || "",
      [result.paragraphs[1] || "", bullets.join("\n")].filter(Boolean).join("\n"),
      result.paragraphs[2] || ""
    ]
  };
}

function formatLifestyle(result, payload, labels) {
  const bullets = [];
  if (getAttr(payload, 0)) bullets.push(`• ${labels[0]}: ${getAttr(payload, 0)}`);
  if (getAttr(payload, 1)) bullets.push(`• ${labels[1]}: ${getAttr(payload, 1)}`);
  if (getAttr(payload, 2)) bullets.push(`• ${labels[2]}: ${getAttr(payload, 2)}`);
  return {
    ...result,
    paragraphs: [
      result.paragraphs[0] || "",
      [result.paragraphs[1] || "", bullets.join("\n")].filter(Boolean).join("\n"),
      result.paragraphs[2] || ""
    ]
  };
}

function buildPreviousResultContext(payload, langKey) {
  if (!payload.improved) {
    return langKey === "en"
      ? "- Mode: first draft generation"
      : "- Chế độ: tạo bản đầu";
  }

  const prev = payload.previousResult;
  if (!prev?.paragraphs?.length) {
    return langKey === "en"
      ? "- Mode: improve draft (rewrite with fresher wording and clearer value emphasis)"
      : "- Chế độ: cải tiến bản trước (viết mới câu chữ, rõ lợi ích hơn, giảm lặp ý)";
  }

  const preview = prev.paragraphs
    .slice(0, 3)
    .map((item, index) => `  ${index + 1}. ${compact(item).slice(0, 220)}`)
    .join("\n");
  const tags = (prev.hashtags || []).slice(0, 6).join(" ");

  if (langKey === "en") {
    return `- Mode: improve previous draft
- Improve clarity and persuasion while keeping factual consistency.
- Avoid repeating prior phrasing and sentence rhythm.
Previous draft:
${preview}
Previous hashtags: ${tags || "N/A"}`;
  }

  return `- Chế độ: cải tiến bản trước
- Nâng độ rõ ràng, sức thuyết phục và độ mượt câu chữ.
- Tránh lặp lại cách diễn đạt cũ và nhịp câu cũ.
Bản trước:
${preview}
Hashtag bản trước: ${tags || "N/A"}`;
}

function buildPrompt(payload) {
  const langKey = getLangKey(payload.lang);
  const highlights = (payload.highlights || []).filter(Boolean).join(langKey === "en" ? ", " : ", ");
  const attributes = (payload.attributes || [])
    .filter((item) => item?.value)
    .map((item) => item.value)
    .join(langKey === "en" ? ", " : ", ");
  const categoryNote = aiCategoryNotes[payload.category] || aiCategoryNotes.other;
  const qualityRule = aiCategoryQualityRules[payload.category] || aiCategoryQualityRules.other;

  const channelLabel = safePick(CHANNEL_LABELS[langKey], payload.channel, 2);
  const channelGuide = safePick(CHANNEL_GUIDES[langKey], payload.channel, 2);
  const toneGuide = safePick(TONE_GUIDES[langKey], payload.tone, 0);
  const brandGuide = safePick(BRAND_STYLE_GUIDES[langKey], payload.brandStyle, 0);
  const moodGuide = safePick(MOOD_GUIDES[langKey], payload.mood, 0);
  const categoryLabel = CATEGORY_LABELS[langKey]?.[payload.category] || CATEGORY_LABELS[langKey].other;
  const improveContext = buildPreviousResultContext(payload, langKey);

  if (langKey === "en") {
    return `You are a senior ecommerce copywriter for marketplace product pages.

Objective:
- Write final publish-ready product intro copy for ${channelLabel}.
- Keep it concise, creative, clear, and easy to scan on mobile.
- Turn dry facts into vivid but believable wording.

Hard requirements:
- Never write meta text like "the description should" or "overall".
- Do not explain your strategy. Output final copy only.
- If images are provided, use only visible details and do not invent hard specs.
- If data is missing, add soft, safe notes only.
- Keep language natural and brand-safe.

Style direction:
- Tone: ${toneGuide}
- Brand style: ${brandGuide}
- Mood: ${moodGuide}
- Channel direction: ${channelGuide}
- Category note: ${categoryNote}
- Quality target: ${qualityRule.good}
- Avoid: ${qualityRule.avoid}

Product information:
- Name: ${payload.productName || "N/A"}
- Category: ${categoryLabel}
- Sub-category: ${payload.subcategory || 0}
- Short description: ${payload.shortDescription || "N/A"}
- Highlights: ${highlights || "N/A"}
- Attributes: ${attributes || "N/A"}
- Price segment: ${payload.priceSegment || "N/A"}
- Target customer: ${payload.targetCustomer || "N/A"}
- Images uploaded: ${(payload.images || []).length}
${improveContext}

Return valid JSON only:
{"headline":"...","paragraphs":["...","...","..."],"bullets":["...","...","..."],"cta":"...","hashtags":["#...","#...","#...","#...","#..."]}`;
  }

  return `Bạn là senior ecommerce copywriter chuyên viết nội dung giới thiệu sản phẩm cho sàn thương mại điện tử.

Mục tiêu:
- Viết nội dung thành phẩm có thể đăng ngay cho ${channelLabel}.
- Câu chữ sáng tạo nhưng gọn gàng, không khô cứng, dễ hiểu khi đọc nhanh trên mobile.
- Biến thông tin kỹ thuật thành lợi ích thực tế mà người mua cảm nhận được.

Yêu cầu bắt buộc:
- Không được viết câu meta như "nội dung nên", "mô tả nên", "tổng thể", "thông điệp gợi ý".
- Không giải thích cách viết. Chỉ trả nội dung cuối cùng.
- Nếu có ảnh, chỉ bám chi tiết nhìn thấy được; không bịa thông số cứng.
- Nếu thiếu dữ liệu, chỉ thêm lưu ý mềm, an toàn, hợp ngữ cảnh bán hàng.
- Giữ giọng thương hiệu, không rao hàng lố.

Định hướng giọng điệu:
- Tone: ${toneGuide}
- Style thương hiệu: ${brandGuide}
- Mood: ${moodGuide}
- Định hướng theo kênh: ${channelGuide}
- Ghi chú ngành: ${categoryNote}
- Chất lượng cần đạt: ${qualityRule.good}
- Điều cần tránh: ${qualityRule.avoid}

Thông tin sản phẩm:
- Tên sản phẩm: ${payload.productName || "N/A"}
- Danh mục: ${categoryLabel}
- Dòng sản phẩm: ${payload.subcategory || 0}
- Mô tả ngắn: ${payload.shortDescription || "N/A"}
- Điểm nổi bật: ${highlights || "N/A"}
- Thuộc tính bổ sung: ${attributes || "N/A"}
- Phân khúc giá: ${payload.priceSegment || "N/A"}
- Khách hàng mục tiêu: ${payload.targetCustomer || "N/A"}
- Số ảnh đã tải lên: ${(payload.images || []).length}
${improveContext}

Chỉ trả JSON hợp lệ:
{"headline":"...","paragraphs":["...","...","..."],"bullets":["...","...","..."],"cta":"...","hashtags":["#...","#...","#...","#...","#..."]}`;
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

function buildFallback(payload) {
  const langKey = getLangKey(payload.lang);
  const name = payload.productName || (langKey === "en" ? "Product" : "Sản phẩm");
  const firstLine = payload.shortDescription
    ? `${name}\n${compact(payload.shortDescription)}`
    : (langKey === "en"
      ? `${name}\nA concise, buyer-friendly product description with clear value and easy scanability.`
      : `${name}\nNội dung giới thiệu gọn, rõ và dễ đọc nhanh theo chuẩn sàn thương mại điện tử.`);

  return {
    paragraphs: [
      firstLine,
      buildDefaultSecondLines(payload, langKey).join("\n"),
      buildDefaultClosingLine(payload, langKey)
    ],
    hashtags: normalizeHashtags([], payload),
    source: "fallback",
    meta: payload.improved ? "Bản cải tiến theo phong cách chuyên gia" : "Bản mô tả sản phẩm đầu tiên"
  };
}

export async function generateProductCopy(payload) {
  const apiBase = process.env.AI_API_BASE;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "cx/gpt-5.4";

  if (!apiBase || !apiKey) return buildFallback(payload);

  const content = [{ type: "text", text: buildPrompt(payload) }];
  for (const image of (payload.images || []).slice(0, 4)) {
    if (!image?.src) continue;
    if (!/^data:image\/(png|jpeg|jpg|gif|webp);/i.test(image.src)) continue;
    content.push({ type: "image_url", image_url: { url: image.src } });
  }

  try {
    const result = await postJson(`${apiBase.replace(/\/$/, "")}/chat/completions`, {
      model,
      messages: [{ role: "user", content }],
      response_format: { type: "json_object" }
    }, { Authorization: `Bearer ${apiKey}` });

    const rawMessage = result.choices?.[0]?.message?.content;
    const parsed = parseJsonObject(extractMessageText(rawMessage));
    if (!parsed || typeof parsed !== "object") return buildFallback(payload);

    let finalResult = normalizeAiPayloadResult(payload, parsed);
    const langKey = getLangKey(payload.lang);

    if (payload.category === "fashion") {
      finalResult = formatFashionCatalog(finalResult, payload, langKey);
    } else if (payload.category === "skincare") {
      finalResult = formatSkincare(finalResult, payload, langKey);
    } else if (payload.category === "home") {
      finalResult = formatUtility(
        finalResult,
        payload,
        langKey === "en"
          ? ["Use case", "Size / info", "Material / practical point"]
          : ["Công năng", "Kích thước / thông tin", "Chất liệu / điểm dùng"]
      );
    } else if (payload.category === "electronics") {
      finalResult = formatUtility(
        finalResult,
        payload,
        langKey === "en"
          ? ["Feature", "Specs", "Main usage value"]
          : ["Tính năng", "Thông số", "Điểm dùng chính"]
      );
    } else if (payload.category === "food") {
      finalResult = formatUtility(
        finalResult,
        payload,
        langKey === "en"
          ? ["Ingredients", "Flavor", "Pack size / serving"]
          : ["Thành phần", "Hương vị", "Quy cách / khẩu phần"]
      );
    } else if (payload.category === "footwear") {
      finalResult = formatLifestyle(
        finalResult,
        payload,
        langKey === "en"
          ? ["Material", "Size", "Color"]
          : ["Chất liệu", "Size", "Màu sắc"]
      );
    } else if (payload.category === "bags") {
      finalResult = formatLifestyle(
        finalResult,
        payload,
        langKey === "en"
          ? ["Material", "Dimensions", "Color"]
          : ["Chất liệu", "Kích thước", "Màu sắc"]
      );
    } else if (payload.category === "accessories") {
      finalResult = formatLifestyle(
        finalResult,
        payload,
        langKey === "en"
          ? ["Material", "Dimensions", "Design detail"]
          : ["Chất liệu", "Kích thước", "Điểm nhấn thiết kế"]
      );
    } else if (payload.category === "fragrance") {
      finalResult = formatLifestyle(
        finalResult,
        payload,
        langKey === "en"
          ? ["Scent family", "Volume", "Longevity"]
          : ["Nhóm hương", "Dung tích", "Độ lưu hương"]
      );
    } else if (payload.category === "pet") {
      finalResult = formatUtility(
        finalResult,
        payload,
        langKey === "en"
          ? ["Suitable for", "Material / ingredients", "Benefit"]
          : ["Đối tượng phù hợp", "Chất liệu / thành phần", "Công dụng"]
      );
    } else if (payload.category === "sports") {
      finalResult = formatUtility(
        finalResult,
        payload,
        langKey === "en"
          ? ["Material", "Size", "Function"]
          : ["Chất liệu", "Kích thước", "Công năng"]
      );
    }

    if (!finalResult?.paragraphs?.length) return buildFallback(payload);
    return finalResult;
  } catch {
    return buildFallback(payload);
  }
}
