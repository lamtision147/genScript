import http from "http";
import https from "https";
import { aiCategoryNotes, aiCategoryQualityRules } from "@/lib/ai-prompt-config";
import { getCategoryGroupValue, getCategoryValuesByGroup } from "@/lib/category-marketplace-presets";
import { trackAiUsageEvent } from "@/lib/server/ai-usage-service";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const DEBUG_FORCE_NAME_ONLY = process.env.SUGGEST_FORCE_NAME_ONLY === "1";
const PROMPT_VERSION = String(process.env.AI_PROMPT_VERSION || "v2.2").trim() || "v2.2";
const SUPPORTED_OUTPUT_LANGUAGES = new Set(["vi", "en", "zh", "ja", "ko", "es", "fr", "de"]);
const DEFAULT_VISION_BUCKET = "ai-vision-temp";
let visionBucketEnsured = false;

const VISION_CACHE_TTL_MS = 1000 * 60 * 30;
const visionImageCache = new Map();

const OUTPUT_LANGUAGE_CONFIG = {
  vi: {
    code: "vi",
    labelEn: "Vietnamese",
    labelNative: "Tiếng Việt",
    productFallbackName: "Sản phẩm",
    metaFirst: "Bản mô tả sản phẩm đầu tiên",
    metaImprove: "Bản cải tiến theo phong cách chuyên gia",
    qualityLabel: "Chất lượng",
    fallbackIntro: "Nội dung giới thiệu gọn, rõ và dễ đọc nhanh theo chuẩn sàn thương mại điện tử.",
    fallbackUnavailableReason: "Đang dùng fallback do AI chưa sẵn sàng",
    suggestNoDataNote: "Không đủ dữ liệu ảnh để gợi ý chính xác.",
    suggestErrorNote: "Không thể phân tích ảnh lúc này, vui lòng thử lại.",
    defaultSecondLine: "• Trình bày rõ các điểm chính để người mua nắm nhanh thông tin.",
    bestForPrefix: "Phù hợp với ",
    bestForSuffix: ".",
    pricePrefix: "Phân khúc giá: ",
    priceSuffix: ".",
    defaultClosingLine: "Nội dung giữ nhịp gọn, rõ và sẵn sàng đăng lên các kênh bán hàng."
  },
  en: {
    code: "en",
    labelEn: "English",
    labelNative: "English",
    productFallbackName: "Product",
    metaFirst: "First product description draft",
    metaImprove: "Improved expert-style version",
    qualityLabel: "Quality",
    fallbackIntro: "A concise, buyer-friendly product description with clear value and easy scanability.",
    fallbackUnavailableReason: "Fallback used because AI is unavailable",
    suggestNoDataNote: "Not enough image data for an accurate suggestion.",
    suggestErrorNote: "Unable to analyze images right now. Please try again.",
    defaultSecondLine: "• Clear key product information for quick buyer understanding.",
    bestForPrefix: "Best for ",
    bestForSuffix: ".",
    pricePrefix: "Price segment: ",
    priceSuffix: ".",
    defaultClosingLine: "The copy stays concise, clear, and ready to publish on ecommerce channels."
  },
  zh: {
    code: "zh",
    labelEn: "Chinese (Simplified)",
    labelNative: "中文（简体）",
    productFallbackName: "商品",
    metaFirst: "商品文案首稿",
    metaImprove: "专家风格优化稿",
    qualityLabel: "质量",
    fallbackIntro: "文案简洁清晰，适合电商场景快速阅读。",
    fallbackUnavailableReason: "AI 暂不可用，已使用备用结果",
    suggestNoDataNote: "图片信息不足，无法给出准确建议。",
    suggestErrorNote: "当前无法分析图片，请稍后重试。",
    defaultSecondLine: "• 使用清晰关键信息，便于买家快速理解。",
    bestForPrefix: "适合",
    bestForSuffix: "。",
    pricePrefix: "价格区间：",
    priceSuffix: "。",
    defaultClosingLine: "文案保持简洁清晰，可直接用于电商渠道发布。"
  },
  ja: {
    code: "ja",
    labelEn: "Japanese",
    labelNative: "日本語",
    productFallbackName: "商品",
    metaFirst: "商品紹介の初稿",
    metaImprove: "専門家トーンで改善した版",
    qualityLabel: "品質",
    fallbackIntro: "簡潔で分かりやすい商品紹介文を作成します。",
    fallbackUnavailableReason: "AI が利用できないためフォールバックを使用しています",
    suggestNoDataNote: "画像情報が不足しており、正確な提案ができません。",
    suggestErrorNote: "現在画像を分析できません。後で再試行してください。",
    defaultSecondLine: "• 重要ポイントを明確にし、購入者が素早く把握できる構成にします。",
    bestForPrefix: "おすすめ対象: ",
    bestForSuffix: "。",
    pricePrefix: "価格帯: ",
    priceSuffix: "。",
    defaultClosingLine: "簡潔で分かりやすく、ECチャネルにそのまま掲載できる文面です。"
  },
  ko: {
    code: "ko",
    labelEn: "Korean",
    labelNative: "한국어",
    productFallbackName: "상품",
    metaFirst: "상품 소개 초안",
    metaImprove: "전문가 톤 개선본",
    qualityLabel: "품질",
    fallbackIntro: "간결하고 이해하기 쉬운 상품 소개 문안입니다.",
    fallbackUnavailableReason: "AI를 사용할 수 없어 대체 결과를 사용합니다",
    suggestNoDataNote: "이미지 정보가 부족하여 정확한 제안을 하기 어렵습니다.",
    suggestErrorNote: "지금은 이미지를 분석할 수 없습니다. 잠시 후 다시 시도해 주세요.",
    defaultSecondLine: "• 핵심 정보를 명확히 정리해 구매자가 빠르게 이해할 수 있게 합니다.",
    bestForPrefix: "추천 대상: ",
    bestForSuffix: ".",
    pricePrefix: "가격대: ",
    priceSuffix: ".",
    defaultClosingLine: "문장은 간결하고 명확하며 이커머스 채널에 바로 게시할 수 있습니다."
  },
  es: {
    code: "es",
    labelEn: "Spanish",
    labelNative: "Espanol",
    productFallbackName: "Producto",
    metaFirst: "Primer borrador de descripcion del producto",
    metaImprove: "Version mejorada con tono experto",
    qualityLabel: "Calidad",
    fallbackIntro: "Descripcion breve y clara, lista para lectura rapida en ecommerce.",
    fallbackUnavailableReason: "Se uso fallback porque la IA no esta disponible",
    suggestNoDataNote: "No hay suficientes datos de imagen para una sugerencia precisa.",
    suggestErrorNote: "No se pueden analizar las imagenes en este momento. Intentalo de nuevo.",
    defaultSecondLine: "• Presenta la informacion clave de forma clara para lectura rapida.",
    bestForPrefix: "Ideal para ",
    bestForSuffix: ".",
    pricePrefix: "Rango de precio: ",
    priceSuffix: ".",
    defaultClosingLine: "El texto es claro, breve y listo para publicar en canales ecommerce."
  },
  fr: {
    code: "fr",
    labelEn: "French",
    labelNative: "Francais",
    productFallbackName: "Produit",
    metaFirst: "Premiere version de la description produit",
    metaImprove: "Version amelioree avec ton expert",
    qualityLabel: "Qualite",
    fallbackIntro: "Description concise et claire, adaptee a une lecture rapide en ecommerce.",
    fallbackUnavailableReason: "Fallback utilise car l'IA n'est pas disponible",
    suggestNoDataNote: "Donnees image insuffisantes pour une suggestion precise.",
    suggestErrorNote: "Impossible d'analyser les images pour le moment. Reessayez plus tard.",
    defaultSecondLine: "• Met en avant les points cles pour une lecture rapide.",
    bestForPrefix: "Ideal pour ",
    bestForSuffix: ".",
    pricePrefix: "Gamme de prix : ",
    priceSuffix: ".",
    defaultClosingLine: "Le texte reste clair, concis et pret a publier sur les canaux ecommerce."
  },
  de: {
    code: "de",
    labelEn: "German",
    labelNative: "Deutsch",
    productFallbackName: "Produkt",
    metaFirst: "Erster Entwurf der Produktbeschreibung",
    metaImprove: "Verbesserte Version im Expertenstil",
    qualityLabel: "Qualitaet",
    fallbackIntro: "Kurze und klare Produktbeschreibung fuer schnelles Lesen im Ecommerce.",
    fallbackUnavailableReason: "Fallback verwendet, da die KI nicht verfuegbar ist",
    suggestNoDataNote: "Nicht genug Bilddaten fuer einen praezisen Vorschlag.",
    suggestErrorNote: "Bilder koennen momentan nicht analysiert werden. Bitte spaeter erneut versuchen.",
    defaultSecondLine: "• Klare Kerninformationen, damit Kaufer alles schnell erfassen konnen.",
    bestForPrefix: "Geeignet fuer ",
    bestForSuffix: ".",
    pricePrefix: "Preissegment: ",
    priceSuffix: ".",
    defaultClosingLine: "Der Text ist klar, knapp und direkt fur Ecommerce-Kanale nutzbar."
  }
};

const CATEGORY_NOTES_EN = {
  fashion: "For fashion, prioritize fit feeling, silhouette, fabric drape, color balance, and overall styling polish.",
  skincare: "For skincare, prioritize texture, absorption, skin feel, key ingredients, and realistic after-use experience.",
  beautyTools: "For beauty tools, prioritize practical ease of use, safety comfort, and realistic routine outcomes.",
  home: "For home products, prioritize practical function, daily convenience, and durable usability.",
  furnitureDecor: "For furniture and decor, prioritize space fit, style harmony, and practical day-to-day usability.",
  electronics: "For electronics, translate features into real daily usage benefits instead of dry specs.",
  food: "For food products, emphasize flavor profile, ingredients, consumption feel, and daily convenience.",
  householdEssentials: "For household essentials, prioritize repeat-use convenience, cleaning efficacy, and family-safe practicality.",
  footwear: "For footwear, prioritize on-foot comfort, cushioning feel, shape, and styling utility.",
  bags: "For bags and wallets, prioritize shape, material, carrying comfort, and practical compartment value.",
  accessories: "For accessories, prioritize design detail, visual role, and how it finishes an outfit.",
  fragrance: "For fragrance, prioritize mood, character, scent family, and lasting impression.",
  pet: "For pet products, prioritize safety reassurance, suitability, and practical daily use.",
  sports: "For sports and fitness, prioritize movement comfort, flexibility, durability, and practical utility.",
  motherBaby: "For mother & baby, prioritize safety, material trust, hygiene, and practical everyday care value.",
  healthCare: "For health care, prioritize clear practical benefits, safe wording, and realistic home usage context.",
  booksStationery: "For books and stationery, prioritize daily usability, learning productivity, and tactile writing/reading experience.",
  toysGames: "For toys and games, prioritize age fit, safe material, educational or interaction value, and replayability.",
  autoMoto: "For auto/moto products, prioritize installation fit, road stability, durability, and safety-oriented usage context.",
  phoneTablet: "For phone and tablet, translate specs into practical mobile experience, battery reliability, and smooth daily usage.",
  computerOffice: "For computer/office, prioritize productivity value, setup compatibility, and reliable long-session usability.",
  cameraDrone: "For camera and drone, prioritize image stability, capture quality, and practical shooting workflow.",
  homeAppliances: "For home appliances, prioritize time-saving utility, easy operation, and maintenance convenience in real homes.",
  toolsHardware: "For tools and hardware, prioritize build durability, output reliability, and safe practical operation.",
  digitalGoods: "For digital goods, prioritize instant utility, ease of adoption, and clear usage scope/access terms.",
  other: "Always prioritize real value, practical usage experience, and polished wording."
};

const CATEGORY_QUALITY_RULES_EN = {
  fashion: {
    good: "Wording should make buyers visualize fabric feel, silhouette, and styling outcome in real wear situations.",
    avoid: "Avoid empty hype words and generic praise without concrete product details."
  },
  skincare: {
    good: "Wording should express texture, absorption, and daily routine usability with trustworthy ingredient context.",
    avoid: "Avoid medical claims, absolute promises, and treatment-like wording."
  },
  beautyTools: {
    good: "Describe practical handling, comfort in repeated use, and realistic personal-care outcomes.",
    avoid: "Avoid pseudo-medical claims or vague premium wording without concrete user scenarios."
  },
  home: {
    good: "Wording should place the product in real living contexts with clear practical use value.",
    avoid: "Avoid abstract convenience claims without clear use-case details."
  },
  furnitureDecor: {
    good: "Show both visual atmosphere impact and practical placement suitability in real spaces.",
    avoid: "Avoid aesthetics-only wording that ignores dimensions or real-room practicality."
  },
  electronics: {
    good: "Translate specs into concrete user experience and practical day-to-day benefits.",
    avoid: "Avoid sounding like a bare spec sheet or generic tech slogan."
  },
  food: {
    good: "Use vivid yet credible taste and usage language with practical serving context.",
    avoid: "Avoid exaggerated flavor claims or repetitive generic praise."
  },
  householdEssentials: {
    good: "Emphasize daily repeat-use convenience, cleaning efficacy, and practical household outcomes.",
    avoid: "Avoid dramatic claims unsupported by clear usage context or safety clarity."
  },
  footwear: {
    good: "Describe fit, comfort, support, and everyday styling utility with realistic context.",
    avoid: "Avoid beauty-only praise without wear experience details."
  },
  bags: {
    good: "Describe shape, capacity, carrying comfort, and outfit-finishing impact.",
    avoid: "Avoid empty luxury wording without practical or visual details."
  },
  accessories: {
    good: "Explain how the accessory sharpens and completes the overall look.",
    avoid: "Avoid vague styling claims with no visual role."
  },
  fragrance: {
    good: "Describe mood, character, and usage moments with soft but clear imagery.",
    avoid: "Avoid dry note listing and overly abstract, unclear language."
  },
  pet: {
    good: "Balance owner reassurance and practical pet-life usefulness.",
    avoid: "Avoid emotional-only wording without practical value."
  },
  sports: {
    good: "Use movement-focused language that feels practical, durable, and workout-ready.",
    avoid: "Avoid cliche fitness slogans without real usage detail."
  },
  motherBaby: {
    good: "Use reassuring, safety-first wording with practical parent usage context and clear hygiene-related benefits.",
    avoid: "Avoid risky safety claims, medical exaggeration, or fear-based language."
  },
  healthCare: {
    good: "Use factual, plain language centered on practical monitoring or support use-cases at home.",
    avoid: "Avoid treatment promises, diagnosis claims, and absolute outcomes."
  },
  booksStationery: {
    good: "Highlight clarity of layout, writing comfort, and routine-friendly productivity value.",
    avoid: "Avoid abstract motivation-only wording without concrete use value."
  },
  toysGames: {
    good: "Describe interaction, age suitability, and play value with clear practical context.",
    avoid: "Avoid vague fun claims without safety or usability detail."
  },
  autoMoto: {
    good: "Emphasize fit, stability, durability, and safer day-to-day riding/driving usage.",
    avoid: "Avoid overclaiming safety outcomes or implying guaranteed accident prevention."
  },
  phoneTablet: {
    good: "Translate technical specs into clear day-to-day benefits like battery confidence and smoother workflow.",
    avoid: "Avoid benchmark-style jargon dumps without practical impact."
  },
  computerOffice: {
    good: "Focus on stable workflow performance, compatibility, and practical desk setup value.",
    avoid: "Avoid empty productivity buzzwords without concrete scenarios."
  },
  cameraDrone: {
    good: "Describe real shooting results: stability, clarity, capture convenience, and reliable usage scenarios.",
    avoid: "Avoid cinematic overpromises unsupported by practical details."
  },
  homeAppliances: {
    good: "Place product in real household routines and highlight time-saving, ease-of-use, and maintenance value.",
    avoid: "Avoid generic convenience claims that do not explain where and how it helps."
  },
  toolsHardware: {
    good: "Use precise practical wording around output, durability, control, and safe handling in real tasks.",
    avoid: "Avoid dangerous overconfidence claims or unsupported professional guarantees."
  },
  digitalGoods: {
    good: "Clarify instant access value, onboarding ease, and concrete productivity/time-saving outcomes.",
    avoid: "Avoid unclear entitlement wording or inflated outcomes without practical usage paths."
  },
  other: {
    good: "Keep wording practical, trustworthy, and easy to visualize.",
    avoid: "Avoid generic praise and repeated empty statements."
  }
};

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

const BRAND_PRESET_GUIDES = {
  minimalist: {
    vi: "Ưu tiên câu gọn, tinh, nhấn rõ 1-2 lợi ích chính, tránh phô trương.",
    en: "Keep language concise and elegant. Emphasize 1-2 key buyer benefits without exaggeration."
  },
  premium: {
    vi: "Giọng cao cấp, tiết chế, sang nhưng vẫn gần gũi và dễ hiểu.",
    en: "Use a premium but approachable voice. Refined, clear, and confident."
  },
  conversion: {
    vi: "Nhấn lợi ích thực tế, giảm vòng vo, tăng động lực mua trong đoạn 3.",
    en: "Be conversion-oriented: practical benefits first and stronger close in paragraph 3."
  }
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
    beautyTools: "Dụng cụ làm đẹp / Chăm sóc cá nhân",
    home: "Gia dụng",
    furnitureDecor: "Nội thất / Trang trí",
    electronics: "Điện tử / Phụ kiện",
    food: "Thực phẩm / Đồ uống",
    householdEssentials: "Hàng tiêu dùng nhanh",
    footwear: "Giày dép",
    bags: "Túi xách / Ví",
    accessories: "Phụ kiện",
    fragrance: "Nước hoa / Hương thơm",
    pet: "Thú cưng",
    sports: "Thể thao / Fitness",
    motherBaby: "Mẹ & Bé",
    healthCare: "Sức khỏe",
    booksStationery: "Sách / Văn phòng phẩm",
    toysGames: "Đồ chơi / Board game",
    autoMoto: "Ô tô / Xe máy / Xe đạp",
    phoneTablet: "Điện thoại / Tablet",
    computerOffice: "Máy tính / Thiết bị văn phòng",
    cameraDrone: "Máy ảnh / Drone",
    homeAppliances: "Điện gia dụng",
    toolsHardware: "Dụng cụ / Cải tạo nhà",
    digitalGoods: "Sản phẩm số / Voucher",
    other: "Khác"
  },
  en: {
    fashion: "Fashion",
    skincare: "Beauty / Skincare",
    beautyTools: "Beauty Tools / Personal Care",
    home: "Home",
    furnitureDecor: "Furniture / Decor",
    electronics: "Electronics / Accessories",
    food: "Food / Beverage",
    householdEssentials: "Household Essentials",
    footwear: "Footwear",
    bags: "Bags / Wallets",
    accessories: "Accessories",
    fragrance: "Fragrance",
    pet: "Pet",
    sports: "Sports / Fitness",
    motherBaby: "Mother & Baby",
    healthCare: "Health Care",
    booksStationery: "Books / Stationery",
    toysGames: "Toys / Games",
    autoMoto: "Auto / Moto / Bicycle",
    phoneTablet: "Phone / Tablet",
    computerOffice: "Computer / Office",
    cameraDrone: "Camera / Drone",
    homeAppliances: "Home Appliances",
    toolsHardware: "Tools / Hardware",
    digitalGoods: "Digital Goods / Voucher",
    other: "Other"
  }
};

const SUBCATEGORY_HINTS = {
  vi: {
    fashion: ["Thời trang nữ công sở", "Thời trang nam basic", "Thời trang bigsize", "Streetwear", "Đồ ngủ / mặc nhà"],
    skincare: ["Da mụn nhạy cảm", "Làm sáng da", "Phục hồi hàng rào", "Chống nắng", "Làm sạch"],
    beautyTools: ["Máy tạo kiểu tóc", "Thiết bị chăm sóc da", "Dụng cụ makeup", "Dụng cụ nail", "Dụng cụ vệ sinh cá nhân"],
    home: ["Gia dụng nhà bếp", "Dọn dẹp nhà cửa", "Decor phòng", "Lưu trữ", "Chăm sóc phòng ngủ"],
    furnitureDecor: ["Sofa / ghế", "Bàn / kệ", "Đèn trang trí", "Rèm / thảm", "Decor để bàn"],
    electronics: ["Phụ kiện điện thoại", "Tai nghe / gaming", "Smart home", "Sạc / pin", "Thiết bị văn phòng"],
    food: ["Đồ ăn vặt", "Đồ uống tiện lợi", "Eat-clean", "Quà tặng thực phẩm", "Gia vị / nấu nhanh"],
    householdEssentials: ["Giấy và khăn", "Nước giặt / xả", "Vệ sinh nhà bếp", "Chăm sóc nhà tắm", "Đồ dùng tiêu hao"],
    footwear: ["Sneaker", "Sandal", "Giày chạy bộ", "Giày công sở", "Dép hằng ngày"],
    bags: ["Túi công sở", "Túi mini đi chơi", "Balo đi học/đi làm", "Ví", "Túi du lịch"],
    accessories: ["Trang sức", "Mũ nón / kính", "Thắt lưng / khăn", "Đồng hồ", "Phụ kiện tóc"],
    fragrance: ["Nước hoa nữ", "Nước hoa nam", "Hương thơm phòng", "Body mist", "Tinh dầu"],
    pet: ["Mèo - thức ăn/snack", "Chó - chăm sóc", "Phụ kiện thú cưng", "Đồ chơi", "Vệ sinh thú cưng"],
    sports: ["Gym / tập lực", "Yoga / pilates", "Running", "Phụ kiện thể thao", "Bình nước"],
    motherBaby: ["Sữa / bỉm tã", "Đồ ăn dặm", "Đồ dùng sơ sinh", "Xe đẩy / địu", "Đồ chơi phát triển"],
    healthCare: ["Vitamin / khoáng chất", "Thiết bị theo dõi sức khỏe", "Hỗ trợ xương khớp", "Hỗ trợ giấc ngủ", "Chăm sóc cá nhân"],
    booksStationery: ["Sách kỹ năng", "Sách thiếu nhi", "Văn phòng phẩm", "Dụng cụ học tập", "Lịch / planner"],
    toysGames: ["Đồ chơi giáo dục", "Board game", "Lắp ráp", "Đồ chơi vận động", "Mô hình"],
    autoMoto: ["Phụ kiện xe máy", "Phụ kiện ô tô", "Mũ bảo hiểm", "Đồ chăm sóc xe", "Đồ điện xe"],
    phoneTablet: ["Điện thoại", "Máy tính bảng", "Ốp / kính cường lực", "Sạc / cáp", "Tai nghe"],
    computerOffice: ["Laptop", "Màn hình", "Bàn phím / chuột", "Thiết bị mạng", "Phụ kiện văn phòng"],
    cameraDrone: ["Camera hành động", "Camera an ninh", "Máy ảnh", "Drone", "Phụ kiện quay chụp"],
    homeAppliances: ["Máy xay / ép", "Nồi chiên / nồi điện", "Thiết bị hút bụi", "Lọc không khí", "Máy sưởi / quạt"],
    toolsHardware: ["Dụng cụ cầm tay", "Khoan / bắt vít", "Thiết bị đo", "Đồ bảo hộ", "Vật tư sửa chữa"],
    digitalGoods: ["Voucher điện tử", "Gift card", "Mã bản quyền phần mềm", "Khóa học online", "Gói dịch vụ số"],
    other: ["Phổ thông", "Theo mùa", "Quà tặng", "Lifestyle", "Khác"]
  },
  en: {
    fashion: ["Women office wear", "Men basic style", "Plus-size fashion", "Streetwear", "Sleepwear"],
    skincare: ["Acne-sensitive", "Brightening", "Barrier repair", "Sunscreen", "Cleansing"],
    beautyTools: ["Hair styling tools", "Skin care devices", "Makeup tools", "Nail tools", "Personal hygiene tools"],
    home: ["Kitchen essentials", "Home cleaning", "Room decor", "Storage", "Bedroom care"],
    furnitureDecor: ["Sofa / chairs", "Desk / shelves", "Decor lighting", "Curtains / rugs", "Tabletop decor"],
    electronics: ["Phone accessories", "Audio / gaming", "Smart home", "Charging", "Desk devices"],
    food: ["Snacks", "Convenient drinks", "Eat-clean", "Gift food", "Quick cooking"],
    householdEssentials: ["Tissue and paper", "Laundry detergent / softener", "Kitchen cleaning", "Bathroom care", "Daily consumables"],
    footwear: ["Sneakers", "Sandals", "Running shoes", "Office shoes", "Daily slippers"],
    bags: ["Office bags", "Mini bags", "Backpacks", "Wallets", "Travel bags"],
    accessories: ["Jewelry", "Hats / glasses", "Belts / scarves", "Watches", "Hair accessories"],
    fragrance: ["Women fragrance", "Men fragrance", "Room scent", "Body mist", "Essential oil"],
    pet: ["Cat food/snacks", "Dog care", "Pet accessories", "Pet toys", "Pet hygiene"],
    sports: ["Gym", "Yoga / pilates", "Running", "Sports accessories", "Water bottles"],
    motherBaby: ["Milk / diapers", "Baby food", "Newborn essentials", "Stroller / carrier", "Early learning toys"],
    healthCare: ["Vitamins / minerals", "Health trackers", "Joint support", "Sleep support", "Personal care"],
    booksStationery: ["Self-help books", "Kids books", "Stationery", "Study tools", "Planner / calendar"],
    toysGames: ["Educational toys", "Board games", "Building sets", "Active toys", "Collectibles"],
    autoMoto: ["Motorbike accessories", "Car accessories", "Helmets", "Car care", "Vehicle electronics"],
    phoneTablet: ["Smartphones", "Tablets", "Cases / screen protector", "Chargers / cables", "Earphones"],
    computerOffice: ["Laptops", "Monitors", "Keyboard / mouse", "Networking", "Office accessories"],
    cameraDrone: ["Action camera", "Security camera", "Camera", "Drone", "Shooting accessories"],
    homeAppliances: ["Blender / juicer", "Air fryer / cooker", "Vacuum", "Air purifier", "Fan / heater"],
    toolsHardware: ["Hand tools", "Drill / screwdriver", "Measurement", "Safety gear", "Repair supplies"],
    digitalGoods: ["Digital voucher", "Gift card", "Software license", "Online course", "Digital service package"],
    other: ["General", "Seasonal", "Gift", "Lifestyle", "Other"]
  }
};

const SUBCATEGORY_EXTRA_HINTS = {
  vi: {
    fashion: ["Athleisure / sporty chic", "Y2K / cá tính", "Đầm dự tiệc", "Thời trang trẻ em", "Đồ đôi / couple"],
    skincare: ["Lão hóa / nếp nhăn", "Dưỡng ẩm chuyên sâu", "Body care", "Mặt nạ / treatment", "Chăm sóc tóc"],
    beautyTools: ["Máy uốn / duỗi tóc", "Máy rửa mặt", "Máy triệt lông", "Bộ cọ trang điểm", "Máy sấy mini"],
    home: ["Đồ giặt sấy", "Nhà tắm / toilet", "Đèn & chiếu sáng", "Đồ dùng bàn ăn", "Gia dụng thông minh"],
    furnitureDecor: ["Nội thất đa năng", "Kệ module", "Đèn LED trang trí", "Trang trí tối giản", "Decor phòng thuê"],
    electronics: ["Phụ kiện livestream", "Thiết bị học online", "Đồng hồ thông minh", "Phụ kiện laptop", "Thiết bị xe hơi"],
    food: ["Đồ đông lạnh", "Đồ khô pantry", "Đặc sản vùng miền", "Đồ uống healthy", "Thực phẩm cho mẹ bé"],
    householdEssentials: ["Nước lau sàn", "Viên giặt", "Giấy vệ sinh cao cấp", "Túi rác tự hủy", "Nước rửa chén dịu nhẹ"],
    footwear: ["Giày cao gót", "Giày búp bê", "Boots", "Giày trẻ em", "Giày leo núi / outdoor"],
    bags: ["Túi tote", "Túi laptop", "Túi thể thao", "Vali", "Túi mẹ bé"],
    accessories: ["Khuyên tai / nhẫn", "Phụ kiện tóc", "Thắt lưng da", "Phụ kiện unisex", "Phụ kiện mùa lễ"],
    fragrance: ["Nước hoa niche", "Nến thơm / sáp thơm", "Xịt thơm vải", "Nước hoa mini", "Khử mùi cơ thể"],
    pet: ["Cát vệ sinh", "Đệm / nhà thú cưng", "Phụ kiện đi dạo", "Vệ sinh răng miệng", "Vitamin thú cưng"],
    sports: ["Đạp xe", "Bơi lội", "Cầu lông / tennis", "Đồ tập tại nhà", "Thiết bị recovery"],
    motherBaby: ["Mẹ bầu", "Chăm sóc sau sinh", "Tắm gội cho bé", "Phòng ngủ cho bé", "Đồ đi học cho bé"],
    healthCare: ["Thiết bị y tế gia đình", "Chăm sóc răng miệng", "Hỗ trợ tiêu hóa", "Hỗ trợ miễn dịch", "Dụng cụ phục hồi"],
    booksStationery: ["Sách ngoại ngữ", "Sách kinh doanh", "Sổ tay / notebook", "Dụng cụ vẽ", "Desk setup"],
    toysGames: ["Đồ chơi sơ sinh", "Đồ chơi STEM", "Đồ chơi điều khiển", "Puzzle", "Đồ chơi nhập vai"],
    autoMoto: ["Camera hành trình", "Nội thất ô tô", "Bảo dưỡng định kỳ", "Đồ cứu hộ", "Phụ kiện xe đạp"],
    phoneTablet: ["Điện thoại gaming", "Tablet học tập", "Phụ kiện MagSafe", "Pin dự phòng", "Giá đỡ điện thoại"],
    computerOffice: ["PC / linh kiện", "Máy in / scan", "Lưu trữ dữ liệu", "Webcam / micro", "Bàn ghế công thái học"],
    cameraDrone: ["Ống kính", "Gimbal", "Đèn quay chụp", "Thẻ nhớ / lưu trữ", "Phụ kiện studio"],
    homeAppliances: ["Máy pha cà phê", "Máy giặt / sấy mini", "Thiết bị lọc nước", "Chăm sóc quần áo", "Thiết bị bếp thông minh"],
    toolsHardware: ["Dụng cụ làm vườn", "Sơn / hoàn thiện", "Điện nước dân dụng", "Khóa / an ninh", "Thang / nâng hạ"],
    digitalGoods: ["Mã game", "Mã xem phim", "Template số", "Preset chỉnh ảnh", "Gói lưu trữ cloud"],
    other: ["Handmade", "Digital goods", "Quà doanh nghiệp", "Đồ sưu tầm", "Dịch vụ kèm sản phẩm"]
  },
  en: {
    fashion: ["Athleisure / sporty chic", "Y2K / edgy", "Party dresses", "Kids fashion", "Couple outfits"],
    skincare: ["Anti-aging", "Deep hydration", "Body care", "Masks / treatment", "Hair care"],
    beautyTools: ["Hair curler / straightener", "Facial cleansing device", "Hair removal device", "Makeup brush sets", "Mini dryer"],
    home: ["Laundry", "Bathroom", "Lighting", "Dining essentials", "Smart home living"],
    furnitureDecor: ["Multifunction furniture", "Modular shelves", "LED decor lights", "Minimal decor", "Rental room styling"],
    electronics: ["Livestream gear", "Online learning devices", "Smart watches", "Laptop accessories", "Car electronics"],
    food: ["Frozen food", "Pantry essentials", "Regional specialties", "Healthy drinks", "Mother-baby nutrition"],
    householdEssentials: ["Floor cleaner", "Laundry pods", "Premium toilet tissue", "Biodegradable trash bags", "Mild dishwashing liquid"],
    footwear: ["Heels", "Flats", "Boots", "Kids shoes", "Outdoor shoes"],
    bags: ["Tote bags", "Laptop bags", "Gym bags", "Suitcases", "Mother-baby bags"],
    accessories: ["Earrings / rings", "Hair accessories", "Leather belts", "Unisex accessories", "Holiday accessories"],
    fragrance: ["Niche fragrance", "Candles / wax", "Fabric spray", "Mini perfume", "Body deodorizing"],
    pet: ["Pet litter", "Pet beds", "Walking gear", "Oral care", "Pet supplements"],
    sports: ["Cycling", "Swimming", "Badminton / tennis", "Home training", "Recovery tools"],
    motherBaby: ["Maternity", "Postpartum care", "Baby bath & care", "Baby room", "School items for kids"],
    healthCare: ["Home medical devices", "Oral care", "Digestive support", "Immunity support", "Rehab tools"],
    booksStationery: ["Language books", "Business books", "Notebooks", "Drawing tools", "Desk setup"],
    toysGames: ["Infant toys", "STEM toys", "RC toys", "Puzzles", "Role-play toys"],
    autoMoto: ["Dash cams", "Car interior", "Maintenance", "Emergency gear", "Bicycle accessories"],
    phoneTablet: ["Gaming phones", "Study tablets", "MagSafe accessories", "Power banks", "Phone stands"],
    computerOffice: ["PC components", "Printers / scanners", "Storage", "Webcams / mics", "Ergonomic desks/chairs"],
    cameraDrone: ["Lenses", "Gimbals", "Lighting", "Memory / storage", "Studio accessories"],
    homeAppliances: ["Coffee machines", "Mini washer/dryer", "Water filtration", "Garment care", "Smart kitchen gear"],
    toolsHardware: ["Garden tools", "Paint / finishing", "Electrical/plumbing", "Locks / security", "Ladders / lifting"],
    digitalGoods: ["Game codes", "Streaming passes", "Digital templates", "Photo presets", "Cloud storage plans"],
    other: ["Handmade", "Digital goods", "Corporate gifts", "Collectibles", "Service bundles"]
  }
};

function mergeSubcategoryHints(baseHints, extraHints) {
  for (const langKey of Object.keys(extraHints)) {
    const langHints = baseHints[langKey] || {};
    for (const [category, extras] of Object.entries(extraHints[langKey])) {
      const baseList = Array.isArray(langHints[category]) ? langHints[category] : [];
      const seen = new Set(baseList.map((item) => String(item || "").toLowerCase().trim()));
      const mergedExtras = (Array.isArray(extras) ? extras : []).filter((item) => {
        const key = String(item || "").toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      langHints[category] = [...baseList, ...mergedExtras];
    }
    baseHints[langKey] = langHints;
  }
}

mergeSubcategoryHints(SUBCATEGORY_HINTS, SUBCATEGORY_EXTRA_HINTS);

const CATEGORY_BY_LABEL_ALIAS = {
  "quan ngu": "fashion",
  "quần ngủ": "fashion",
  "do ngu": "fashion",
  "đồ ngủ": "fashion",
  "pijama": "fashion",
  "pyjama": "fashion",
  "pajama": "fashion",
  "sleepwear": "fashion",
  "loungewear": "fashion",
  "ao ngu": "fashion",
  "áo ngủ": "fashion",
  "bo do ngu": "fashion",
  "bộ đồ ngủ": "fashion",
  "vay ngu": "fashion",
  "váy ngủ": "fashion",
  "nightwear": "fashion",
  "tai nghe": "electronics",
  "tai nghe khong day": "electronics",
  "tai nghe chống ồn": "electronics",
  "tai nghe chong on": "electronics",
  "headphone": "electronics",
  "headphones": "electronics",
  "earbuds": "electronics",
  "monitor": "computerOffice",
  "man hinh": "computerOffice",
  "máy tính": "computerOffice",
  "may tinh": "computerOffice",
  "keyboard": "computerOffice",
  "chuot": "computerOffice",
  "mouse": "computerOffice",
  "loa": "electronics",
  "speaker": "electronics",
  "micro": "computerOffice",
  "webcam": "computerOffice",
  "son moi": "skincare",
  "sữa rửa mặt": "skincare",
  "sua rua mat": "skincare",
  "serum": "skincare",
  "kem duong": "skincare",
  "kem dưỡng": "skincare",
  "fragrance": "fragrance",
  "nuoc hoa": "fragrance",
  "nước hoa": "fragrance",
  "may rua mat": "beautyTools",
  "máy rửa mặt": "beautyTools",
  "hair dryer": "beautyTools",
  "may say toc": "beautyTools",
  "máy sấy tóc": "beautyTools",
  "sonic cleanser": "beautyTools",
  "sofa": "furnitureDecor",
  "ban": "furnitureDecor",
  "bàn": "furnitureDecor",
  "ghe": "furnitureDecor",
  "ghế": "furnitureDecor",
  "decor": "furnitureDecor",
  "vien giat": "householdEssentials",
  "laundry pods": "householdEssentials",
  "detergent": "householdEssentials",
  "nuoc giat": "householdEssentials",
  "nước giặt": "householdEssentials",
  "voucher": "digitalGoods",
  "gift card": "digitalGoods",
  "license": "digitalGoods",
  "template": "digitalGoods",
  "khoa hoc online": "digitalGoods",
  "khóa học online": "digitalGoods"
};

function normalizeCompareText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function inferCategoryFromProductName(productName = "") {
  const normalized = normalizeCompareText(productName);
  if (!normalized) return null;
  for (const [label, category] of Object.entries(CATEGORY_BY_LABEL_ALIAS)) {
    if (normalized.includes(normalizeCompareText(label))) {
      return category;
    }
  }
  return null;
}

function buildNameOnlySuggestion(payload, outputConfig) {
  const inferredCategory = inferCategoryFromProductName(payload?.productName || "") || "other";
  const isTech = ["electronics", "computerOffice", "phoneTablet", "cameraDrone", "digitalGoods", "beautyTools"].includes(inferredCategory);
  const isVi = getLangKey(payload?.lang) === "vi";

  const tone = isTech ? 1 : 0;
  const channel = isTech ? 1 : 2;
  const mood = isTech ? 3 : 1;
  const brandStyle = isTech ? 2 : 0;

  const targetCustomer = isVi
    ? (isTech ? "Người mua cần sản phẩm công nghệ dùng thực tế hằng ngày" : "Khách mua online theo nhu cầu thực tế")
    : (isTech ? "Buyers looking for practical daily tech usage" : "Online shoppers with practical needs");

  const shortDescription = isVi
    ? (isTech ? "Ưu tiên phân loại theo tên sản phẩm do ảnh chưa đủ tín hiệu đáng tin." : "Ảnh chưa đủ tín hiệu, cần xác nhận thêm trước khi áp dụng thông số chi tiết.")
    : (isTech ? "Category inferred from product name because image signal is insufficient." : "Image signal is insufficient; please verify details before applying hard specs.");

  const generatedProductName = compact(payload?.productName || "") || (getLangKey(payload?.lang) === "vi"
    ? "Không nhận dạng tên sản phẩm được"
    : "Unable to identify product name");

  const notes = isVi
    ? ["Đã suy luận theo tên sản phẩm do ảnh chưa đủ dữ liệu phân tích."]
    : ["Inferred from product name because image data was insufficient for reliable vision analysis."];

  const fallbackHighlightsByCategory = {
    fashion: ["Dễ phối outfit", "Mặc hằng ngày", "Tối ưu cảm giác thoải mái"],
    skincare: ["Kết cấu dễ dùng", "Phù hợp routine", "Ưu tiên dịu nhẹ"],
    beautyTools: ["Thao tác nhanh", "Dễ vệ sinh", "Phù hợp dùng đều"],
    home: ["Tiện dùng trong nhà", "Dễ bố trí", "Ưu tiên công năng"],
    furnitureDecor: ["Hợp không gian", "Tăng thẩm mỹ", "Dễ phối nội thất"],
    electronics: ["Dùng ổn định", "Tính năng thực dụng", "Phù hợp nhu cầu hằng ngày"],
    food: ["Dễ dùng", "Tiện mang theo", "Hương vị dễ tiếp cận"],
    householdEssentials: ["Tiện định lượng", "Dùng lặp lại dễ", "Phù hợp sinh hoạt hằng ngày"],
    footwear: ["Đi êm", "Dễ phối đồ", "Phù hợp dùng thường xuyên"],
    bags: ["Chứa đồ hợp lý", "Dễ phối", "Dùng linh hoạt"],
    accessories: ["Tạo điểm nhấn", "Dễ phối", "Tăng độ hoàn thiện outfit"],
    fragrance: ["Mùi dễ dùng", "Hợp nhiều dịp", "Tạo cảm giác dễ chịu"],
    pet: ["Phù hợp thú cưng", "Tiện dùng", "Ưu tiên an toàn"],
    sports: ["Phù hợp vận động", "Dễ mang theo", "Hỗ trợ tập luyện"],
    motherBaby: ["Ưu tiên an toàn", "Dễ dùng", "Phù hợp routine chăm bé"],
    healthCare: ["Dễ theo dõi", "Tiện dùng", "Phù hợp chăm sóc hằng ngày"],
    booksStationery: ["Dễ ghi chú", "Tăng hiệu quả học tập", "Dễ mang theo"],
    toysGames: ["Tạo tương tác", "Phù hợp gia đình", "Dễ chơi"],
    autoMoto: ["Hợp nhu cầu di chuyển", "Dễ lắp/dùng", "Tăng tiện lợi"],
    phoneTablet: ["Dùng hằng ngày", "Tối ưu trải nghiệm", "Dễ tương thích"],
    computerOffice: ["Hợp góc làm việc", "Tăng hiệu suất", "Dễ setup"],
    cameraDrone: ["Dễ ghi hình", "Tối ưu trải nghiệm quay", "Phù hợp creator"],
    homeAppliances: ["Tiết kiệm thời gian", "Dễ thao tác", "Phù hợp gia đình"],
    toolsHardware: ["Hỗ trợ sửa chữa", "Dùng linh hoạt", "Ưu tiên độ bền"],
    digitalGoods: ["Nhận ngay", "Dễ áp dụng", "Tiết kiệm thời gian"],
    other: ["Giá trị thực dụng", "Dễ dùng", "Phù hợp nhu cầu phổ thông"]
  };

  const fallbackDescriptionByCategory = {
    fashion: "Sản phẩm thời trang phù hợp nhu cầu mặc hằng ngày với định hướng dễ phối và dễ dùng.",
    skincare: "Sản phẩm skincare ưu tiên routine ổn định và trải nghiệm dịu nhẹ theo nhu cầu phổ biến.",
    beautyTools: "Dụng cụ làm đẹp định hướng thao tác nhanh và phù hợp chăm sóc cá nhân tại nhà.",
    home: "Sản phẩm gia dụng tập trung công năng thực tế và sự tiện lợi trong sinh hoạt hằng ngày.",
    furnitureDecor: "Sản phẩm nội thất/decorr định hướng cân bằng thẩm mỹ không gian và tính tiện dụng.",
    electronics: "Thiết bị điện tử ưu tiên trải nghiệm dùng thực tế và lợi ích rõ ràng cho nhu cầu thường ngày.",
    food: "Sản phẩm thực phẩm/đồ uống định hướng tiện dùng và phù hợp tiêu thụ hằng ngày.",
    householdEssentials: "Sản phẩm tiêu dùng nhanh tập trung tính tiện lợi và hiệu quả dùng lặp lại mỗi ngày.",
    other: "Sản phẩm định hướng giá trị thực dụng, dễ hiểu và dễ áp dụng vào nhu cầu phổ thông."
  };

  const fallbackAttributesByCategory = {
    fashion: [{ type: 0, value: "Chất liệu dễ mặc" }, { type: 1, value: "Form phổ biến" }, { type: 2, value: "Màu dễ phối" }],
    skincare: [{ type: 0, value: "Kết cấu nhẹ" }, { type: 1, value: "Routine hằng ngày" }, { type: 2, value: "Phù hợp da phổ biến" }],
    beautyTools: [{ type: 0, value: "Thao tác đơn giản" }, { type: 1, value: "Dễ vệ sinh" }, { type: 2, value: "Phù hợp dùng đều" }],
    home: [{ type: 0, value: "Công năng rõ" }, { type: 1, value: "Dễ bố trí" }, { type: 2, value: "Phù hợp không gian phổ biến" }],
    furnitureDecor: [{ type: 0, value: "Tone dễ phối" }, { type: 1, value: "Kích thước gọn" }, { type: 2, value: "Phù hợp setup phòng" }],
    electronics: [{ type: 0, value: "Tính năng thực dụng" }, { type: 1, value: "Dễ tương thích" }, { type: 2, value: "Dùng ổn định" }],
    food: [{ type: 0, value: "Dễ dùng" }, { type: 1, value: "Quy cách tiện lợi" }, { type: 2, value: "Phù hợp khẩu vị phổ biến" }],
    householdEssentials: [{ type: 0, value: "Tiện định lượng" }, { type: 1, value: "Dễ dùng lặp lại" }, { type: 2, value: "Phù hợp sinh hoạt gia đình" }],
    other: [{ type: 0, value: "Đặc điểm chính" }, { type: 1, value: "Ứng dụng thực tế" }, { type: 2, value: "Giá trị rõ ràng" }]
  };

  const fallbackHighlights = fallbackHighlightsByCategory[inferredCategory] || fallbackHighlightsByCategory.other;
  const fallbackShortDescription = fallbackDescriptionByCategory[inferredCategory] || fallbackDescriptionByCategory.other;
  const fallbackAttributes = fallbackAttributesByCategory[inferredCategory] || fallbackAttributesByCategory.other;

  return {
    category: inferredCategory,
    tone,
    channel,
    mood,
    brandStyle,
    targetCustomer,
    generatedProductName,
    shortDescription: compact(shortDescription || fallbackShortDescription),
    highlights: fallbackHighlights,
    attributes: fallbackAttributes,
    confidence: inferredCategory === "other" ? 0.34 : 0.58,
    notes: notes.length ? notes : [outputConfig.suggestNoDataNote]
  };
}

function buildImageOnlyHeuristicSuggestion(payload, outputConfig) {
  const lang = getLangKey(payload?.lang);
  const isVi = lang === "vi";
  const imageNames = (Array.isArray(payload?.images) ? payload.images : [])
    .map((image) => normalizeCompareText(image?.name || ""))
    .filter(Boolean)
    .join(" ");

  const contains = (keyword) => imageNames.includes(normalizeCompareText(keyword));

  let category = "other";
  if (contains("monitor") || contains("man hinh") || contains("display") || contains("screen")) {
    category = "computerOffice";
  } else if (contains("headphone") || contains("earbud") || contains("tai nghe") || contains("audio")) {
    category = "electronics";
  } else if (contains("sleepwear") || contains("pajama") || contains("pyjama") || contains("quan ngu") || contains("do ngu")) {
    category = "fashion";
  } else if (contains("phone") || contains("tablet") || contains("smartphone")) {
    category = "phoneTablet";
  } else if (contains("camera") || contains("drone")) {
    category = "cameraDrone";
  }

  const generatedProductName = category === "other"
    ? (isVi ? "Không nhận dạng tên sản phẩm được" : "Unable to identify product name")
    : category === "computerOffice"
      ? (isVi ? "Màn hình máy tính" : "Computer monitor")
      : category === "electronics"
        ? (isVi ? "Tai nghe không dây" : "Wireless headphones")
        : category === "beautyTools"
          ? (isVi ? "Dụng cụ chăm sóc cá nhân" : "Personal care beauty tool")
          : category === "furnitureDecor"
            ? (isVi ? "Sản phẩm nội thất trang trí" : "Furniture decor product")
            : category === "householdEssentials"
              ? (isVi ? "Sản phẩm tiêu dùng nhanh" : "Household essentials product")
              : category === "digitalGoods"
                ? (isVi ? "Sản phẩm số" : "Digital goods product")
        : category === "fashion"
          ? (isVi ? "Bộ quần áo ngủ" : "Sleepwear set")
          : category === "phoneTablet"
            ? (isVi ? "Điện thoại / máy tính bảng" : "Phone / tablet")
            : (isVi ? "Camera / drone" : "Camera / drone");

  return {
    category,
    tone: ["electronics", "computerOffice", "phoneTablet", "cameraDrone", "beautyTools", "digitalGoods"].includes(category) ? 1 : 0,
    channel: ["electronics", "computerOffice", "phoneTablet", "cameraDrone", "beautyTools", "furnitureDecor"].includes(category) ? 1 : 2,
    mood: ["electronics", "computerOffice", "phoneTablet", "cameraDrone", "digitalGoods"].includes(category) ? 3 : 1,
    brandStyle: ["electronics", "computerOffice", "phoneTablet", "cameraDrone", "beautyTools", "digitalGoods"].includes(category) ? 2 : 0,
    generatedProductName,
    targetCustomer: isVi ? "Khách mua online cần sản phẩm đúng nhu cầu thực tế" : "Online shoppers with practical needs",
    shortDescription: isVi
      ? "Suy luận tạm từ metadata ảnh do vision model chưa trả kết quả ổn định."
      : "Temporary inference from image metadata because vision response was unstable.",
    highlights: [],
    attributes: [],
    confidence: category === "other" ? 0.32 : 0.52,
    notes: [isVi
      ? "Đã suy luận theo metadata ảnh (tên file) do phân tích ảnh trực tiếp chưa ổn định."
      : "Inferred from image metadata (file name) because direct vision analysis was unstable."]
  };
}

function shouldOverrideSuggestedCategoryByName(productName = "", suggestedCategory = "") {
  const inferredCategory = inferCategoryFromProductName(productName);
  if (!inferredCategory) return false;
  const suggestionGroup = getCategoryGroupValue(suggestedCategory || "other");
  const inferredGroup = getCategoryGroupValue(inferredCategory);

  if (inferredCategory === suggestedCategory) {
    return false;
  }

  const isSpecificTechCorrection = ["electronics", "computerOffice"].includes(inferredCategory)
    && ["electronics", "computerOffice"].includes(suggestedCategory || "");

  if (isSpecificTechCorrection) {
    return true;
  }

  return suggestionGroup !== inferredGroup;
}

function normalizeCategoryValue(rawCategory = "") {
  const normalized = normalizeCompareText(rawCategory);
  if (!normalized) return "other";

  const directCategory = [
    "fashion", "skincare", "beautytools", "home", "furnituredecor", "electronics", "food", "householdessentials", "footwear", "bags", "accessories", "fragrance", "pet", "sports",
    "motherbaby", "healthcare", "booksstationery", "toysgames", "automoto", "phonetablet", "computeroffice", "cameradrone",
    "homeappliances", "toolshardware", "digitalgoods", "other"
  ].find((item) => normalized === item);

  if (directCategory) {
    if (directCategory === "motherbaby") return "motherBaby";
    if (directCategory === "healthcare") return "healthCare";
    if (directCategory === "beautytools") return "beautyTools";
    if (directCategory === "furnituredecor") return "furnitureDecor";
    if (directCategory === "householdessentials") return "householdEssentials";
    if (directCategory === "booksstationery") return "booksStationery";
    if (directCategory === "toysgames") return "toysGames";
    if (directCategory === "automoto") return "autoMoto";
    if (directCategory === "phonetablet") return "phoneTablet";
    if (directCategory === "computeroffice") return "computerOffice";
    if (directCategory === "cameradrone") return "cameraDrone";
    if (directCategory === "homeappliances") return "homeAppliances";
    if (directCategory === "toolshardware") return "toolsHardware";
    if (directCategory === "digitalgoods") return "digitalGoods";
    return directCategory;
  }

  const keywordMap = [
    { keyword: "khac", category: "other" },
    { keyword: "other", category: "other" },
    { keyword: "unknown", category: "other" },
    { keyword: "electronics", category: "electronics" },
    { keyword: "dientu", category: "electronics" },
    { keyword: "audio", category: "electronics" },
    { keyword: "computer", category: "computerOffice" },
    { keyword: "may tinh", category: "computerOffice" },
    { keyword: "monitor", category: "computerOffice" },
    { keyword: "fashion", category: "fashion" },
    { keyword: "thoi trang", category: "fashion" },
    { keyword: "sleepwear", category: "fashion" },
    { keyword: "do ngu", category: "fashion" },
    { keyword: "quần ngủ", category: "fashion" },
    { keyword: "quan ngu", category: "fashion" },
    { keyword: "skincare", category: "skincare" },
    { keyword: "my pham", category: "skincare" },
    { keyword: "beauty tools", category: "beautyTools" },
    { keyword: "personal care device", category: "beautyTools" },
    { keyword: "makeup tool", category: "beautyTools" },
    { keyword: "hair tool", category: "beautyTools" },
    { keyword: "furniture", category: "furnitureDecor" },
    { keyword: "decor", category: "furnitureDecor" },
    { keyword: "noi that", category: "furnitureDecor" },
    { keyword: "household essentials", category: "householdEssentials" },
    { keyword: "detergent", category: "householdEssentials" },
    { keyword: "fmcg", category: "householdEssentials" },
    { keyword: "fragrance", category: "fragrance" },
    { keyword: "nuoc hoa", category: "fragrance" },
    { keyword: "phone", category: "phoneTablet" },
    { keyword: "tablet", category: "phoneTablet" },
    { keyword: "camera", category: "cameraDrone" },
    { keyword: "drone", category: "cameraDrone" },
    { keyword: "home appliance", category: "homeAppliances" },
    { keyword: "gia dung", category: "homeAppliances" },
    { keyword: "tools", category: "toolsHardware" },
    { keyword: "dung cu", category: "toolsHardware" },
    { keyword: "digital goods", category: "digitalGoods" },
    { keyword: "voucher", category: "digitalGoods" },
    { keyword: "license", category: "digitalGoods" },
    { keyword: "online course", category: "digitalGoods" },
    { keyword: "food", category: "food" },
    { keyword: "pet", category: "pet" },
    { keyword: "sports", category: "sports" },
    { keyword: "mother", category: "motherBaby" },
    { keyword: "be", category: "motherBaby" },
    { keyword: "health", category: "healthCare" },
    { keyword: "book", category: "booksStationery" },
    { keyword: "stationery", category: "booksStationery" },
    { keyword: "toys", category: "toysGames" },
    { keyword: "game", category: "toysGames" },
    { keyword: "auto", category: "autoMoto" },
    { keyword: "moto", category: "autoMoto" }
  ];

  const found = keywordMap.find((item) => normalized.includes(normalizeCompareText(item.keyword)));
  return found?.category || "other";
}

function normalizeGeneratedProductName(rawName = "", lang = "vi") {
  const compacted = compact(rawName);
  if (!compacted) {
    return getLangKey(lang) === "vi" ? "Không nhận dạng tên sản phẩm được" : "Unable to identify product name";
  }

  const normalized = normalizeCompareText(compacted);
  if (/khong nhan dang|không nhận dạng|unable to identify|cannot identify|khong xac dinh|không xác định/.test(normalized)) {
    return getLangKey(lang) === "vi" ? "Không nhận dạng tên sản phẩm được" : "Unable to identify product name";
  }

  return compacted.replace(/[.。]+$/g, "");
}

function toTitleCase(text = "") {
  return String(text || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildCategoryMismatchNote(productName, suggestedCategory, lang = "vi") {
  const inferredCategory = inferCategoryFromProductName(productName);
  if (!inferredCategory || inferredCategory === suggestedCategory) {
    return "";
  }

  const labels = SUBCATEGORY_HINTS[getLangKey(lang)] || SUBCATEGORY_HINTS.en;
  const inferredLabel = labels[inferredCategory]?.[0] || inferredCategory;
  const suggestedLabel = labels[suggestedCategory]?.[0] || suggestedCategory;

  if (getLangKey(lang) === "vi") {
    return `Ảnh gợi ý ${toTitleCase(suggestedLabel)} nhưng tên sản phẩm thiên về ${toTitleCase(inferredLabel)}. Nên kiểm tra lại ảnh hoặc tên trước khi áp dụng template.`;
  }
  return `Image hints at ${toTitleCase(suggestedLabel)} while product name is closer to ${toTitleCase(inferredLabel)}. Please verify image or product name before applying templates.`;
}

function isLikelyImageAnalysisFallback(suggestion, outputConfig) {
  if (!suggestion || typeof suggestion !== "object") return true;
  const confidence = Number(suggestion.confidence || 0);
  const category = String(suggestion.category || "other").trim();
  const hasRichContent = Boolean(
    compact(suggestion.targetCustomer)
    || compact(suggestion.shortDescription)
    || (Array.isArray(suggestion.highlights) && suggestion.highlights.length)
    || (Array.isArray(suggestion.attributes) && suggestion.attributes.length)
  );

  const firstNote = String(Array.isArray(suggestion.notes) ? suggestion.notes[0] || "" : "").trim();
  const fallbackNote = String(outputConfig?.suggestNoDataNote || "").trim();
  const suggestErrorNote = String(outputConfig?.suggestErrorNote || "").trim();

  const categoryLooksDefault = category === "other";
  const confidenceLooksFallback = confidence <= 0.36;
  const noteLooksFallback = !firstNote || firstNote === fallbackNote || firstNote === suggestErrorNote;

  return categoryLooksDefault && confidenceLooksFallback && !hasRichContent && noteLooksFallback;
}

function isImageIngestionError(error) {
  const message = String(error?.message || "").toLowerCase();
  const code = Number(error?.statusCode || error?.status || 0);
  if (code >= 400 && code < 500) {
    if (message.includes("image data") || message.includes("valid image") || message.includes("error while downloading")) {
      return true;
    }
  }
  return false;
}

function bodyHasImageParts(body) {
  const content = body?.messages?.[0]?.content;
  if (!Array.isArray(content)) return false;
  return content.some((item) => item?.type === "image_url" && String(item?.image_url?.url || "").trim());
}

function bodyUsesDataUrlImages(body) {
  const content = body?.messages?.[0]?.content;
  if (!Array.isArray(content)) return false;
  return content.some((item) => {
    if (item?.type !== "image_url") return false;
    const url = String(item?.image_url?.url || "").trim();
    return /^data:image\//i.test(url);
  });
}

function asDataUrlImageContent(payload = [], promptText = "") {
  const content = [{ type: "text", text: promptText }];
  const images = Array.isArray(payload) ? payload : [];
  for (const image of images) {
    const src = String(image?.src || "").trim();
    if (!/^data:image\/(png|jpeg|jpg|gif|webp);/i.test(src)) continue;
    content.push({ type: "image_url", image_url: { url: src } });
  }
  return content;
}

function normalizeOutputLanguage(lang) {
  const normalized = String(lang || "vi").toLowerCase().trim();
  return SUPPORTED_OUTPUT_LANGUAGES.has(normalized) ? normalized : "vi";
}

function getLangKey(lang) {
  return normalizeOutputLanguage(lang) === "vi" ? "vi" : "en";
}

function getOutputLanguageConfig(lang) {
  return OUTPUT_LANGUAGE_CONFIG[normalizeOutputLanguage(lang)] || OUTPUT_LANGUAGE_CONFIG.vi;
}

function getCategoryNoteByLanguage(category, lang) {
  const key = String(category || "other");
  if (getLangKey(lang) === "vi") {
    return aiCategoryNotes[key] || aiCategoryNotes.other;
  }
  return CATEGORY_NOTES_EN[key] || CATEGORY_NOTES_EN.other;
}

function getCategoryQualityRuleByLanguage(category, lang) {
  const key = String(category || "other");
  if (getLangKey(lang) === "vi") {
    return aiCategoryQualityRules[key] || aiCategoryQualityRules.other;
  }
  return CATEGORY_QUALITY_RULES_EN[key] || CATEGORY_QUALITY_RULES_EN.other;
}

export function getLocalizedVariantLabel(lang, improved) {
  const outputConfig = getOutputLanguageConfig(lang);
  return improved ? outputConfig.metaImprove : outputConfig.metaFirst;
}

function buildLocalizedResultMeta(lang, improved, quality = null) {
  const outputConfig = getOutputLanguageConfig(lang);
  const base = improved ? outputConfig.metaImprove : outputConfig.metaFirst;
  if (!quality?.grade || !Number.isFinite(Number(quality.score))) {
    return base;
  }
  return `${base} · ${outputConfig.qualityLabel} ${quality.grade} (${quality.score})`;
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

function dataUrlToBuffer(dataUrl = "") {
  const match = String(dataUrl || "").match(/^data:(image\/(png|jpeg|jpg|gif|webp));base64,(.+)$/i);
  if (!match) return null;
  const mimeType = String(match[1] || "").toLowerCase();
  const base64 = match[3] || "";
  try {
    const buffer = Buffer.from(base64, "base64");
    if (!buffer.length) return null;
    return { buffer, mimeType };
  } catch {
    return null;
  }
}

function hashString(input = "") {
  let hash = 2166136261;
  const str = String(input || "");
  for (let i = 0; i < str.length; i += 1) {
    hash ^= str.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function getVisionCacheKey(image = {}) {
  const src = String(image?.src || "");
  const name = String(image?.name || "");
  return `${hashString(src)}_${hashString(name)}`;
}

function getCachedVisionUrl(image) {
  const key = getVisionCacheKey(image);
  const record = visionImageCache.get(key);
  if (!record) return "";
  if (Date.now() - Number(record.ts || 0) > VISION_CACHE_TTL_MS) {
    visionImageCache.delete(key);
    return "";
  }
  return String(record.url || "");
}

function setCachedVisionUrl(image, url) {
  const key = getVisionCacheKey(image);
  visionImageCache.set(key, { url, ts: Date.now() });
}

function mimeToExt(mimeType = "") {
  if (/png/i.test(mimeType)) return "png";
  if (/jpe?g/i.test(mimeType)) return "jpg";
  if (/gif/i.test(mimeType)) return "gif";
  if (/webp/i.test(mimeType)) return "webp";
  return "jpg";
}

async function ensureVisionBucket(storage, bucketName) {
  if (visionBucketEnsured) return;
  try {
    const { data: bucket } = await storage.getBucket(bucketName);
    if (!bucket) {
      await storage.createBucket(bucketName, {
        public: true,
        fileSizeLimit: "10MB",
        allowedMimeTypes: ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"]
      });
    }
    visionBucketEnsured = true;
  } catch {
    // noop: bucket may already exist or storage policy may restrict listing
  }
}

async function normalizePngBuffer(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 8) {
    return buffer;
  }
  const pngSignature = "89504e470d0a1a0a";
  const isPng = buffer.subarray(0, 8).toString("hex") === pngSignature;
  if (!isPng) return buffer;

  const chunks = [];
  let offset = 8;
  let foundIend = false;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const chunkType = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const fullLength = 12 + length;
    if (offset + fullLength > buffer.length) break;

    const isAncillary = (chunkType.charCodeAt(0) & 0x20) !== 0;
    const shouldKeep = !isAncillary || chunkType === "IDAT" || chunkType === "IEND" || chunkType === "IHDR";
    if (shouldKeep) {
      chunks.push(buffer.subarray(offset, offset + fullLength));
    }
    offset += fullLength;
    if (chunkType === "IEND") {
      foundIend = true;
      break;
    }
  }

  if (!foundIend || !chunks.length) return buffer;
  return Buffer.concat([buffer.subarray(0, 8), ...chunks]);
}

async function buildVisionContent(payload, promptText, options = {}) {
  const content = [{ type: "text", text: promptText }];
  const images = Array.isArray(payload?.images) ? payload.images.slice(0, 4) : [];
  if (!images.length) {
    return content;
  }

  const useVision = String(process.env.AI_VISION_ENABLED || "").trim() !== "0";
  if (!useVision) {
    return content;
  }

  const forcePublicUrl = Boolean(options?.forcePublicUrl);
  const forceDataUrl = Boolean(options?.forceDataUrl);
  const usePublicUrl = forcePublicUrl
    ? true
    : forceDataUrl
      ? false
      : String(process.env.AI_VISION_USE_PUBLIC_URL || "").trim() === "1";
  if (!usePublicUrl) {
    for (const image of images) {
      if (!image?.src || !/^data:image\/(png|jpeg|jpg|gif|webp);/i.test(image.src)) continue;
      content.push({ type: "image_url", image_url: { url: image.src } });
    }
    return content;
  }

  const supabase = createServerSupabaseClient();
  const bucketName = process.env.SUPABASE_VISION_BUCKET || DEFAULT_VISION_BUCKET;
  if (!supabase) {
    return content;
  }

  await ensureVisionBucket(supabase.storage, bucketName);

  for (let index = 0; index < images.length; index += 1) {
    const image = images[index];
    const cachedUrl = getCachedVisionUrl(image);
    if (cachedUrl) {
      content.push({ type: "image_url", image_url: { url: cachedUrl } });
      continue;
    }

    const parsed = dataUrlToBuffer(image?.src);
    if (!parsed) continue;
    const ext = mimeToExt(parsed.mimeType);
    const uploadBuffer = /png/i.test(parsed.mimeType)
      ? await normalizePngBuffer(parsed.buffer)
      : parsed.buffer;
    const filePath = `vision/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${index}.${ext}`;
    const upload = await supabase.storage.from(bucketName).upload(filePath, uploadBuffer, {
      contentType: parsed.mimeType,
      upsert: false,
      cacheControl: "60"
    });
    if (upload.error) continue;

    const publicUrlResult = supabase.storage.from(bucketName).getPublicUrl(filePath);
    const publicUrl = publicUrlResult?.data?.publicUrl;
    if (!publicUrl) continue;
    setCachedVisionUrl(image, publicUrl);
    if (process.env.NODE_ENV !== "production") {
      console.log(JSON.stringify({
        level: "info",
        event: "vision.uploaded",
        filePath,
        publicUrl,
        bytes: uploadBuffer.length,
        mimeType: parsed.mimeType
      }));
    }
    content.push({ type: "image_url", image_url: { url: publicUrl } });
  }

  return content;
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
    beautyTools: ["#BeautyTools", "#ChamSocCaNhan", "#RoutineNhanh"],
    home: ["#SongGonGang", "#NhaCuaChiChu", "#HomeEssentials"],
    furnitureDecor: ["#NoiThatDecor", "#HomeStyling", "#SetupNhaDep"],
    electronics: ["#TechDaily", "#SetupGonGang", "#DungHangNgay"],
    food: ["#AnVatDep", "#DoAnTienLoi", "#HealthyChoice"],
    householdEssentials: ["#HouseholdEssentials", "#TieuDungNhanh", "#RoutineNhaCua"],
    footwear: ["#SneakerDaily", "#DiEmChan", "#MixDoDep"],
    bags: ["#BagDaily", "#PhuKienXinh", "#OutfitFinish"],
    accessories: ["#AccessoriesStyle", "#NangTamOutfit", "#MixAndMatch"],
    fragrance: ["#FragranceMood", "#MuiHuongCaTinh", "#HuongThomMoiNgay"],
    pet: ["#PetCare", "#ThuCungKhoe", "#PetLife"],
    sports: ["#FitnessDaily", "#TapLuyenThongMinh", "#MoveBetter"],
    motherBaby: ["#MeVaBe", "#ChamBeMoiNgay", "#DoDungSoSinh"],
    healthCare: ["#HealthCareDaily", "#SongKhoeMoiNgay", "#TheoDoiSucKhoe"],
    booksStationery: ["#BooksAndStationery", "#HocTapHieuQua", "#PlannerDaily"],
    toysGames: ["#ToysAndGames", "#ChoiMaHoc", "#FamilyGameNight"],
    autoMoto: ["#AutoMoto", "#PhuKienXe", "#LaiXeAnTam"],
    phoneTablet: ["#PhoneTablet", "#MobileDaily", "#DeviceReview"],
    computerOffice: ["#ComputerOffice", "#DeskSetup", "#WorkSmarter"],
    cameraDrone: ["#CameraDrone", "#CreatorGear", "#CaptureMoments"],
    homeAppliances: ["#HomeAppliances", "#SongTienNghi", "#NhaBepThongMinh"],
    toolsHardware: ["#ToolsHardware", "#DIYProjects", "#SuaChuaTaiNha"],
    digitalGoods: ["#DigitalGoods", "#TaiNguyenSo", "#LamViecNhanh"],
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
  const outputConfig = getOutputLanguageConfig(payload?.lang);
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
    lines.push(outputConfig.defaultSecondLine);
  }
  return lines;
}

function buildDefaultClosingLine(payload, langKey) {
  const outputConfig = getOutputLanguageConfig(payload?.lang);
  const parts = [];
  if (payload.targetCustomer) {
    parts.push(`${outputConfig.bestForPrefix}${payload.targetCustomer}${outputConfig.bestForSuffix}`);
  }
  if (payload.priceSegment) {
    parts.push(`${outputConfig.pricePrefix}${payload.priceSegment}${outputConfig.priceSuffix}`);
  }
  if (!parts.length) {
    parts.push(outputConfig.defaultClosingLine);
  }
  return parts.join(" ");
}

function buildCriticRepairPrompt(payload, langKey, quality = null) {
  const reasons = Array.isArray(quality?.reasons) ? quality.reasons.filter(Boolean).slice(0, 4) : [];
  if (!reasons.length) {
    return "";
  }

  if (langKey === "en") {
    return `\n\nQuality critic feedback from previous draft:\n${reasons.map((item, idx) => `${idx + 1}. ${item}`).join("\n")}\nMandatory repair actions:\n- Rewrite ALL 3 paragraphs and hashtags to fix these issues directly.\n- Increase specificity with concrete buyer/use context.\n- Keep paragraph 3 aligned with operational notes when available.\n- Do not repeat phrasing from previous draft.`;
  }

  return `\n\nPhản hồi kiểm định chất lượng từ bản trước:\n${reasons.map((item, idx) => `${idx + 1}. ${item}`).join("\n")}\nYêu cầu sửa bắt buộc:\n- Viết lại CẢ 3 đoạn và hashtag để xử lý đúng các lỗi trên.\n- Tăng độ cụ thể theo ngữ cảnh người mua và tình huống sử dụng.\n- Đảm bảo đoạn 3 bám đúng ghi chú vận hành khi có dữ liệu.\n- Tránh lặp lại câu chữ của bản trước.`;
}

function appendLinesToParagraph(paragraph, lines = []) {
  const extra = (lines || []).map((line) => compact(line)).filter(Boolean);
  return [compact(paragraph || ""), ...extra].filter(Boolean).join("\n");
}

function pushLabeledLine(lines, label, value) {
  const text = compact(value || "");
  if (!text) return;
  lines.push(`• ${label}: ${text}`);
}

function resultNeedsRetry(result) {
  if (!result?.paragraphs || result.paragraphs.length < 3) return true;
  const compacted = result.paragraphs.map((item) => compact(item));
  return compacted.some((item) => item.length < 20);
}

function evaluateOutputQuality(result, payload, langKey) {
  const paragraphs = Array.isArray(result?.paragraphs) ? result.paragraphs : [];
  const hashtags = Array.isArray(result?.hashtags) ? result.hashtags : [];

  const scores = {
    structure: 0,
    clarity: 0,
    creativity: 0,
    conversion: 0,
    policy: 0
  };

  const allText = paragraphs.join("\n");
  const p1 = compact(paragraphs[0] || "");
  const p2 = compact(paragraphs[1] || "");
  const p3 = compact(paragraphs[2] || "");

  if (paragraphs.length === 3) scores.structure += 100;
  if (p1.length >= 80) scores.structure += 50;
  if (p2.length >= 120) scores.structure += 50;
  if (p3.length >= 120) scores.structure += 50;
  if (hashtags.length >= 4) scores.structure += 50;

  const longSentences = allText.split(/[.!?\n]+/).map((item) => item.trim()).filter(Boolean);
  const avgSentenceLength = longSentences.length
    ? longSentences.reduce((sum, item) => sum + item.length, 0) / longSentences.length
    : 0;
  if (avgSentenceLength <= 140) scores.clarity += 120;
  if (avgSentenceLength <= 95) scores.clarity += 80;
  if (!/\b(nội dung nên|mô tả nên|tổng thể|overall|the description should)\b/i.test(allText)) {
    scores.clarity += 100;
  }

  const uniqueWordCount = new Set(
    allText
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .filter((item) => item.length >= 3)
  ).size;
  if (uniqueWordCount >= 55) scores.creativity += 120;
  else if (uniqueWordCount >= 40) scores.creativity += 80;
  if (!/\b(siêu xinh|cực phẩm|must-have|sang chảnh)\b/i.test(allText)) scores.creativity += 80;

  if (/(mua|chọn|thêm ngay|đặt|shop|order|buy|add to cart|checkout)/i.test(p3)) scores.conversion += 120;
  if (/(phù hợp|best for|giá|price|lợi ích|benefit)/i.test(allText)) scores.conversion += 80;

  const policyFlags = [];
  if (/\b(điều trị|chữa|cure|heal|100%|cam kết tuyệt đối)\b/i.test(allText) && payload.category === "skincare") {
    policyFlags.push(langKey === "en" ? "Avoid medical/absolute claims" : "Tránh claim y khoa/tuyệt đối");
  }
  if (!policyFlags.length) scores.policy += 200;
  else scores.policy += 60;

  const requiredChecks = [];
  const normalizedOutputLang = normalizeOutputLanguage(payload?.lang);
  const shouldRunRequiredChecks = normalizedOutputLang === "vi" || normalizedOutputLang === "en";

  if (shouldRunRequiredChecks) {
    if (payload.category === "fashion") {
      if (payload.sizeGuide) requiredChecks.push(/(Bảng size|Size guide)/i.test(p3));
      if (payload.careGuide) requiredChecks.push(/(Bảo quản|Care guide)/i.test(p3));
      if (payload.exchangePolicy) requiredChecks.push(/(Đổi trả|Exchange)/i.test(p3));
    }
    if (["skincare", "motherBaby", "healthCare"].includes(payload.category)) {
      if (payload.usage) requiredChecks.push(/(Cách dùng|How to use)/i.test(p3));
      if (payload.skinConcern) requiredChecks.push(/(Vấn đề da|Skin concern)/i.test(p3));
      if (payload.routineStep) requiredChecks.push(/(Bước routine|Routine step)/i.test(p3));
    }
    if (payload.category === "beautyTools") {
      if (payload.specs) requiredChecks.push(/(Thông số chính|Key specs)/i.test(p3));
      if (payload.compatibility) requiredChecks.push(/(Tương thích|Compatibility)/i.test(p3));
      if (payload.warranty) requiredChecks.push(/(Bảo hành|Warranty)/i.test(p3));
    }
    if (["home", "homeAppliances", "toolsHardware"].includes(payload.category)) {
      if (payload.dimensions) requiredChecks.push(/(Kích thước|Detailed dimensions)/i.test(p3));
      if (payload.usageSpace) requiredChecks.push(/(Không gian phù hợp|Best space)/i.test(p3));
      if (payload.warranty) requiredChecks.push(/(Bảo hành|Warranty)/i.test(p3));
    }
    if (["electronics", "phoneTablet", "computerOffice", "cameraDrone", "autoMoto", "motherBaby", "healthCare"].includes(payload.category)) {
      if (payload.specs) requiredChecks.push(/(Thông số chính|Key specs)/i.test(p3));
      if (payload.compatibility) requiredChecks.push(/(Tương thích|Compatibility)/i.test(p3));
      if (payload.warranty) requiredChecks.push(/(Bảo hành|Warranty)/i.test(p3));
    }
    if (payload.category === "furnitureDecor") {
      if (payload.dimensions) requiredChecks.push(/(Kích thước|Detailed dimensions)/i.test(p3));
      if (payload.usageSpace) requiredChecks.push(/(Không gian phù hợp|Best space)/i.test(p3));
      if (payload.warranty) requiredChecks.push(/(Bảo hành|Warranty)/i.test(p3));
    }
    if (payload.category === "householdEssentials") {
      if (payload.usage) requiredChecks.push(/(Cách dùng|How to use)/i.test(p3));
      if (payload.dimensions) requiredChecks.push(/(Kích thước|Detailed dimensions)/i.test(p3));
    }
    if (payload.category === "digitalGoods") {
      if (payload.specs) requiredChecks.push(/(Thông số chính|Key specs)/i.test(p3));
      if (payload.compatibility) requiredChecks.push(/(Tương thích|Compatibility)/i.test(p3));
      if (payload.warranty) requiredChecks.push(/(Hỗ trợ|Support|Bảo hành|Warranty)/i.test(p3));
    }
  }

  const requiredPass = requiredChecks.every(Boolean);
  if (requiredPass) scores.policy += 100;
  const total = Math.max(0, Math.min(100, Math.round(
    (scores.structure + scores.clarity + scores.creativity + scores.conversion + scores.policy) / 12.5
  )));

  const reasons = [];
  if (!requiredPass) reasons.push(langKey === "en" ? "Missing category operational notes" : "Thiếu ghi chú vận hành theo ngành");
  if (avgSentenceLength > 140) reasons.push(langKey === "en" ? "Sentences too long" : "Câu quá dài");
  if (uniqueWordCount < 35) reasons.push(langKey === "en" ? "Wording not varied enough" : "Từ ngữ chưa đủ đa dạng");
  if (policyFlags.length) reasons.push(...policyFlags);

  return {
    score: total,
    scores,
    requiredPass,
    reasons,
    retryRecommended: total < 78 || !requiredPass
  };
}

function applyCategoryFormatting(result, payload, langKey) {
  if (payload.category === "fashion") {
    return formatFashionCatalog(result, payload, langKey);
  }

  if (payload.category === "skincare") {
    return formatSkincare(result, payload, langKey);
  }

  if (payload.category === "beautyTools") {
    return formatUtility(
      result,
      payload,
      langKey === "en"
        ? ["Device type", "Core feature", "Comfort / safety"]
        : ["Loại thiết bị", "Tính năng chính", "Độ êm / an toàn"],
      {
        notes: langKey === "en"
          ? [
              { label: "Key specs", value: payload.specs },
              { label: "Compatibility", value: payload.compatibility },
              { label: "Warranty", value: payload.warranty }
            ]
          : [
              { label: "Thông số chính", value: payload.specs },
              { label: "Tương thích", value: payload.compatibility },
              { label: "Bảo hành", value: payload.warranty }
            ],
        fallbackNote: langKey === "en"
          ? "Use steadily in daily routine and follow safe handling guidance for better outcomes."
          : "Nên dùng đều trong routine hằng ngày và tuân thủ hướng dẫn an toàn khi thao tác."
      }
    );
  }

  if (payload.category === "furnitureDecor") {
    return formatUtility(
      result,
      payload,
      langKey === "en"
        ? ["Material / finish", "Size / placement", "Style impact"]
        : ["Chất liệu / hoàn thiện", "Kích thước / vị trí đặt", "Hiệu ứng thẩm mỹ"],
      {
        notes: langKey === "en"
          ? [
              { label: "Detailed dimensions", value: payload.dimensions },
              { label: "Best space", value: payload.usageSpace },
              { label: "Warranty", value: payload.warranty }
            ]
          : [
              { label: "Kích thước chi tiết", value: payload.dimensions },
              { label: "Không gian phù hợp", value: payload.usageSpace },
              { label: "Bảo hành", value: payload.warranty }
            ],
        fallbackNote: langKey === "en"
          ? "Match dimensions and tone with your room setup before checkout for best visual harmony."
          : "Nên đối chiếu kích thước và tone màu với không gian thực tế trước khi chốt đơn."
      }
    );
  }

  if (["home", "homeAppliances", "toolsHardware"].includes(payload.category)) {
    return formatUtility(
      result,
      payload,
      langKey === "en"
        ? ["Use case", "Size / info", "Material / practical point"]
        : ["Công năng", "Kích thước / thông tin", "Chất liệu / điểm dùng"],
      {
        notes: langKey === "en"
          ? [
              { label: "Detailed dimensions", value: payload.dimensions },
              { label: "Best space", value: payload.usageSpace },
              { label: "Warranty", value: payload.warranty }
            ]
          : [
              { label: "Kích thước chi tiết", value: payload.dimensions },
              { label: "Không gian phù hợp", value: payload.usageSpace },
              { label: "Bảo hành", value: payload.warranty }
            ],
        fallbackNote: langKey === "en"
          ? "The copy keeps practical usage context clear for everyday home routines."
          : "Nội dung giữ rõ ngữ cảnh sử dụng thực tế trong sinh hoạt hằng ngày."
      }
    );
  }

  if (["electronics", "phoneTablet", "computerOffice", "cameraDrone", "autoMoto"].includes(payload.category)) {
    return formatUtility(
      result,
      payload,
      langKey === "en"
        ? ["Feature", "Specs", "Main usage value"]
        : ["Tính năng", "Thông số", "Điểm dùng chính"],
      {
        notes: langKey === "en"
          ? [
              { label: "Key specs", value: payload.specs },
              { label: "Compatibility", value: payload.compatibility },
              { label: "Warranty", value: payload.warranty }
            ]
          : [
              { label: "Thông số chính", value: payload.specs },
              { label: "Tương thích", value: payload.compatibility },
              { label: "Bảo hành", value: payload.warranty }
            ],
        fallbackNote: langKey === "en"
          ? "The copy ties specs to daily experience instead of listing dry numbers."
          : "Nội dung ưu tiên trải nghiệm dùng thực tế, không liệt kê thông số khô cứng."
      }
    );
  }

  if (payload.category === "food") {
    return formatUtility(
      result,
      payload,
      langKey === "en"
        ? ["Ingredients", "Flavor", "Pack size / serving"]
        : ["Thành phần", "Hương vị", "Quy cách / khẩu phần"]
    );
  }

  if (payload.category === "householdEssentials") {
    return formatUtility(
      result,
      payload,
      langKey === "en"
        ? ["Core formula", "Pack / usage", "Daily practical gain"]
        : ["Công thức chính", "Quy cách / cách dùng", "Lợi ích dùng hằng ngày"],
      {
        notes: langKey === "en"
          ? [
              { label: "How to use", value: payload.usage },
              { label: "Detailed dimensions", value: payload.dimensions }
            ]
          : [
              { label: "Cách dùng", value: payload.usage },
              { label: "Kích thước chi tiết", value: payload.dimensions }
            ],
        fallbackNote: langKey === "en"
          ? "Prioritize clear dosing and repeat-use convenience for stable daily outcomes."
          : "Ưu tiên định lượng rõ và tính tiện dùng lặp lại để giữ hiệu quả ổn định hằng ngày."
      }
    );
  }

  if (payload.category === "footwear") {
    return formatLifestyle(
      result,
      payload,
      langKey === "en"
        ? ["Material", "Size", "Color"]
        : ["Chất liệu", "Size", "Màu sắc"]
    );
  }

  if (payload.category === "bags") {
    return formatLifestyle(
      result,
      payload,
      langKey === "en"
        ? ["Material", "Dimensions", "Color"]
        : ["Chất liệu", "Kích thước", "Màu sắc"]
    );
  }

  if (payload.category === "accessories") {
    return formatLifestyle(
      result,
      payload,
      langKey === "en"
        ? ["Material", "Dimensions", "Design detail"]
        : ["Chất liệu", "Kích thước", "Điểm nhấn thiết kế"]
    );
  }

  if (payload.category === "fragrance") {
    return formatLifestyle(
      result,
      payload,
      langKey === "en"
        ? ["Scent family", "Volume", "Longevity"]
        : ["Nhóm hương", "Dung tích", "Độ lưu hương"]
    );
  }

  if (payload.category === "pet") {
    return formatUtility(
      result,
      payload,
      langKey === "en"
        ? ["Suitable for", "Material / ingredients", "Benefit"]
        : ["Đối tượng phù hợp", "Chất liệu / thành phần", "Công dụng"]
    );
  }

  if (payload.category === "sports") {
    return formatUtility(
      result,
      payload,
      langKey === "en"
        ? ["Material", "Size", "Function"]
        : ["Chất liệu", "Kích thước", "Công năng"]
    );
  }

  if (payload.category === "digitalGoods") {
    return formatUtility(
      result,
      payload,
      langKey === "en"
        ? ["File / format", "Access scope", "Usage outcome"]
        : ["Định dạng file", "Phạm vi truy cập", "Kết quả sử dụng"],
      {
        notes: langKey === "en"
          ? [
              { label: "Key specs", value: payload.specs },
              { label: "Compatibility", value: payload.compatibility },
              { label: "Support / warranty", value: payload.warranty }
            ]
          : [
              { label: "Thông số chính", value: payload.specs },
              { label: "Tương thích", value: payload.compatibility },
              { label: "Hỗ trợ / bảo hành", value: payload.warranty }
            ],
        fallbackNote: langKey === "en"
          ? "Clarify file delivery, access rights, and immediate onboarding steps to reduce buyer friction."
          : "Cần làm rõ cách nhận file, phạm vi truy cập và bước bắt đầu để giảm ma sát cho người mua."
      }
    );
  }

  return result;
}

function normalizeAiPayloadResult(payload, parsed) {
  const langKey = getLangKey(payload.lang);
  const outputConfig = getOutputLanguageConfig(payload.lang);
  const headline = compact(parsed.headline || parsed.title || payload.productName || outputConfig.productFallbackName);
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
    meta: buildLocalizedResultMeta(payload.lang, payload.improved)
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
        sizeGuide: "Size guide",
        careGuide: "Care guide",
        exchangePolicy: "Exchange / sizing",
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
        sizeGuide: "Bảng size",
        careGuide: "Bảo quản",
        exchangePolicy: "Đổi trả / size",
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
  if (payload.sizeGuide) notes.push(`• ${labels.sizeGuide}: ${payload.sizeGuide}`);
  if (payload.careGuide) notes.push(`• ${labels.careGuide}: ${payload.careGuide}`);
  if (payload.exchangePolicy) notes.push(`• ${labels.exchangePolicy}: ${payload.exchangePolicy}`);
  if (!notes.some((item) => item.includes(labels.noteLead.slice(0, 18)))) {
    notes.push(labels.noteLead);
  }
  if (payload.targetCustomer) notes.push(`• ${labels.fitFor}: ${payload.targetCustomer}`);
  if (payload.priceSegment) notes.push(`• ${labels.price}: ${payload.priceSegment}`);
  if (!notes.length) notes.push(labels.fallbackNotice);

  const outputConfig = getOutputLanguageConfig(payload.lang);
  const first = `${payload.productName || outputConfig.productFallbackName}\n${compact(introSource || payload.shortDescription || "")}`.trim();

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
    ? {
        ingredients: "Ingredients",
        bestFor: "Best for",
        texture: "Texture",
        usage: "How to use",
        concern: "Skin concern",
        routine: "Routine step",
        fallbackNote: "Keep usage simple and consistent: patch test first and apply according to skin condition."
      }
    : {
        ingredients: "Thành phần",
        bestFor: "Phù hợp",
        texture: "Kết cấu",
        usage: "Cách dùng",
        concern: "Vấn đề da",
        routine: "Bước routine",
        fallbackNote: "Nên dùng đều đặn và test thử trên vùng nhỏ trước khi dùng toàn mặt."
      };

  const bullets = [];
  if (getAttr(payload, 0)) bullets.push(`• ${labels.ingredients}: ${getAttr(payload, 0)}`);
  if (getAttr(payload, 1)) bullets.push(`• ${labels.bestFor}: ${getAttr(payload, 1)}`);
  if (getAttr(payload, 3)) bullets.push(`• ${labels.texture}: ${getAttr(payload, 3)}`);

  const notes = [];
  pushLabeledLine(notes, labels.usage, payload.usage);
  pushLabeledLine(notes, labels.concern, payload.skinConcern);
  pushLabeledLine(notes, labels.routine, payload.routineStep);
  if (!notes.length) notes.push(labels.fallbackNote);

  return {
    ...result,
    paragraphs: [
      result.paragraphs[0] || "",
      appendLinesToParagraph(result.paragraphs[1] || "", bullets),
      appendLinesToParagraph(result.paragraphs[2] || "", notes)
    ]
  };
}

function formatUtility(result, payload, labels, options = {}) {
  const bullets = [];
  if (getAttr(payload, 0)) bullets.push(`• ${labels[0]}: ${getAttr(payload, 0)}`);
  if (getAttr(payload, 1)) bullets.push(`• ${labels[1]}: ${getAttr(payload, 1)}`);
  if (getAttr(payload, 2)) bullets.push(`• ${labels[2]}: ${getAttr(payload, 2)}`);

  const notes = [];
  if (Array.isArray(options.notes)) {
    for (const item of options.notes) {
      if (!item?.label) continue;
      pushLabeledLine(notes, item.label, item.value);
    }
  }
  if (!notes.length && options.fallbackNote) {
    notes.push(String(options.fallbackNote));
  }

  return {
    ...result,
    paragraphs: [
      result.paragraphs[0] || "",
      appendLinesToParagraph(result.paragraphs[1] || "", bullets),
      appendLinesToParagraph(result.paragraphs[2] || "", notes)
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

function buildFewShotBlock(payload, langKey) {
  const category = String(payload?.category || "other");
  const productName = compact(payload?.productName || "");
  const shortDescription = compact(payload?.shortDescription || "");

  if (langKey === "en") {
    if (category === "digitalGoods") {
      return `Reference style example (DO NOT copy verbatim, learn clarity and usability framing only):
Input:
- Product: Social media template pack (200 layouts)
- Highlights: editable, multi-platform, fast publish
Output sample:
{
  "headline":"Social media template pack (200 layouts)",
  "paragraphs":[
    "If your team needs to ship marketing creatives faster, this 200-layout template pack removes repetitive design setup work.",
    "• Editable layouts for feed, story, and short-video covers\n• Simple drag-and-drop workflow for non-designers\n• Keeps brand consistency across daily posting",
    "Access note: files are delivered digitally after checkout. Check software compatibility and usage scope before final purchase."
  ],
  "bullets":["Instant digital delivery","Easy editing","Faster content operations"],
  "cta":"Use this pack to shorten production time for your next campaign week.",
  "hashtags":["#digitalgoods","#contentmarketing","#review","#creatorworkflow","#ecommerce"]
}`;
    }

    if (category === "fashion") {
      return `Reference style example (DO NOT copy verbatim, learn rhythm and specificity only):
Input:
- Product: Oversized linen short set
- Highlights: breathable linen blend, relaxed fit, easy movement
Output sample:
{
  "headline":"Oversized linen short set",
  "paragraphs":[
    "If your daily outfit has to look polished but still feel easy to wear, this oversized linen short set is built for that balance.",
    "• Linen-blend fabric stays breathable in warm weather\n• Relaxed silhouette gives movement without looking sloppy\n• Easy to pair with sneakers, sandals, or a lightweight blazer",
    "Fit note: works best for casual office, weekend outings, and travel days. Size guidance is recommended before checkout."
  ],
  "bullets":["Breathable fabric","Relaxed fit","Easy styling"],
  "cta":"Save this set if you want an effortless smart-casual uniform.",
  "hashtags":["#fashion","#outfit","#review","#summerstyle","#ecommerce"]
}`;
    }

    if (["electronics", "computerOffice", "phoneTablet", "cameraDrone"].includes(category)) {
      return `Reference style example (DO NOT copy verbatim, learn rhythm and clarity only):
Input:
- Product: 27-inch office monitor
- Highlights: sharp text, stable color, flexible tilt
Output sample:
{
  "headline":"27-inch office monitor",
  "paragraphs":[
    "If your screen time is long every day, this 27-inch monitor is designed to reduce workflow friction and keep visuals comfortable.",
    "• Sharp text rendering improves spreadsheet and document readability\n• Stable color output supports design and content tasks\n• Adjustable tilt helps maintain a better desk posture",
    "Key specs and compatibility should be confirmed before checkout. Warranty details are best reviewed together with your setup needs."
  ],
  "bullets":["Sharp display","Stable color","Ergonomic tilt"],
  "cta":"Check if this monitor size fits your desk and workflow before ordering.",
  "hashtags":["#tech","#desksetup","#review","#monitor","#ecommerce"]
}`;
    }

    if (category === "skincare") {
      return `Reference style example (DO NOT copy verbatim, learn sensory and safety balance only):
Input:
- Product: B5 calming serum
- Highlights: light texture, quick absorption, daily recovery support
Output sample:
{
  "headline":"B5 calming serum",
  "paragraphs":[
    "When your skin feels stressed after long days or weather shifts, this B5 serum is made for quick comfort and consistent hydration.",
    "• Lightweight texture absorbs fast without sticky finish\n• Supports daily barrier recovery with gentle hydration\n• Easy to fit in both AM and PM routines",
    "How to use: apply after toner and before moisturizer. Patch test is recommended if your skin is highly reactive."
  ],
  "bullets":["Light texture","Fast absorption","Daily routine fit"],
  "cta":"Use consistently for 1-2 weeks and track skin comfort changes.",
  "hashtags":["#skincare","#routine","#review","#beauty","#ecommerce"]
}`;
    }

    return `Reference style principle:
- Keep wording concrete and buyer-centered.
- Paragraph 2 should contain scannable bullet lines.
- Paragraph 3 must include practical operation notes when available.`;
  }

  if (category === "digitalGoods") {
    return `Ví dụ tham chiếu phong cách (KHÔNG copy nguyên văn, chỉ học cách trình bày giá trị dùng ngay):
Input:
- Sản phẩm: Bộ template social media 200 mẫu
- Highlights: kéo thả dễ, đa nền tảng, đăng nhanh
Output mẫu:
{
  "headline":"Bộ template social media 200 mẫu",
  "paragraphs":[
    "Nếu team của bạn cần đăng nội dung đều nhưng thiếu thời gian thiết kế từ đầu, bộ 200 template này giúp rút ngắn đáng kể thời gian sản xuất.",
    "• Có sẵn layout cho feed, story và thumbnail video ngắn\n• Chỉnh sửa kéo thả nhanh ngay cả khi không chuyên thiết kế\n• Giữ nhận diện thương hiệu ổn định trên nhiều kênh",
    "Lưu ý truy cập: sản phẩm giao file số sau thanh toán. Nên kiểm tra nền tảng tương thích và phạm vi sử dụng trước khi chốt đơn."
  ],
  "bullets":["Nhận file ngay","Dễ chỉnh sửa","Tiết kiệm thời gian"],
  "cta":"Dùng bộ mẫu này để tăng tốc lịch đăng trong tuần tới.",
  "hashtags":["#sanphamso","#contentmarketing","#review","#creatorworkflow","#ecommerce"]
}`;
  }

  if (category === "fashion") {
    return `Ví dụ tham chiếu phong cách (KHÔNG copy nguyên văn, chỉ học nhịp và độ cụ thể):
Input:
- Sản phẩm: Set short linen form suông
- Highlights: thoáng mát, mặc thoải mái, dễ phối
Output mẫu:
{
  "headline":"Set short linen form suông",
  "paragraphs":[
    "Nếu bạn cần một set mặc lên gọn gàng mà vẫn thoải mái cả ngày, mẫu short linen này đi đúng nhu cầu đó.",
    "• Vải linen pha thoáng, mặc lâu vẫn dễ chịu\n• Form suông giúp lên dáng gọn mà không gò bó\n• Dễ phối sneaker, sandal hoặc khoác blazer mỏng",
    "Phù hợp đi làm, đi cafe và du lịch ngắn ngày. Nên kiểm tra bảng size trước khi chốt đơn để mặc lên đúng form mong muốn."
  ],
  "bullets":["Thoáng mát","Form suông","Dễ phối"],
  "cta":"Lưu mẫu này nếu bạn muốn outfit mặc nhanh mà vẫn có gu.",
  "hashtags":["#thoitrang","#outfit","#review","#mixdo","#ecommerce"]
}`;
  }

  if (["electronics", "computerOffice", "phoneTablet", "cameraDrone"].includes(category)) {
    return `Ví dụ tham chiếu phong cách (KHÔNG copy nguyên văn, chỉ học nhịp rõ ràng và thực dụng):
Input:
- Sản phẩm: Màn hình 27 inch văn phòng
- Highlights: chữ nét, màu ổn định, chỉnh góc linh hoạt
Output mẫu:
{
  "headline":"Màn hình 27 inch văn phòng",
  "paragraphs":[
    "Nếu bạn làm việc trước màn hình nhiều giờ mỗi ngày, mẫu 27 inch này giúp quy trình làm việc mượt và đỡ mỏi mắt hơn.",
    "• Hiển thị chữ nét giúp đọc tài liệu và bảng tính rõ ràng\n• Màu sắc ổn định cho nhu cầu làm nội dung cơ bản\n• Chân đế chỉnh góc linh hoạt, dễ tối ưu góc nhìn",
    "Nên đối chiếu thông số và cổng kết nối với setup hiện tại trước khi chốt đơn. Kiểm tra thêm chính sách bảo hành để an tâm dùng lâu dài."
  ],
  "bullets":["Hiển thị rõ","Màu ổn định","Setup linh hoạt"],
  "cta":"Nếu đang nâng cấp góc làm việc, đây là lựa chọn đáng cân nhắc.",
  "hashtags":["#dientu","#desksetup","#review","#manhinh","#ecommerce"]
}`;
  }

  if (category === "skincare") {
    return `Ví dụ tham chiếu phong cách (KHÔNG copy nguyên văn, chỉ học cách tả cảm giác và dữ kiện an toàn):
Input:
- Sản phẩm: Serum B5 phục hồi
- Highlights: thấm nhanh, dịu da, dùng hằng ngày
Output mẫu:
{
  "headline":"Serum B5 phục hồi",
  "paragraphs":[
    "Khi da dễ khô rát hoặc căng sau một ngày dài, serum B5 này tập trung vào cảm giác dịu nhanh và cấp ẩm đều.",
    "• Kết cấu mỏng nhẹ, thấm nhanh, không bết dính\n• Hỗ trợ da ổn định hơn khi dùng đều sáng và tối\n• Dễ ghép vào routine mà không gây nặng mặt",
    "Cách dùng: thoa sau toner, trước kem dưỡng. Với da nhạy cảm, nên test ở vùng nhỏ trước khi dùng toàn mặt."
  ],
  "bullets":["Thấm nhanh","Dịu da","Dễ vào routine"],
  "cta":"Dùng đều 1-2 tuần để cảm nhận độ ổn định của bề mặt da.",
  "hashtags":["#skincare","#routine","#review","#chamda","#ecommerce"]
}`;
  }

  return `Nguyên tắc tham chiếu:
- Viết cụ thể theo ngữ cảnh người mua, tránh khen chung chung.
- Đoạn 2 nên có bullet dễ quét nhanh.
- Đoạn 3 cần có ghi chú vận hành khi có dữ liệu.`;
}

function buildPromptRepairBlock(payload, langKey, quality = null) {
  const reasons = Array.isArray(quality?.reasons) ? quality.reasons.filter(Boolean).slice(0, 4) : [];
  if (!reasons.length) {
    return "";
  }

  if (langKey === "en") {
    return `\n\nQuality critic preview:\n${reasons.map((item, idx) => `${idx + 1}. ${item}`).join("\n")}`;
  }

  return `\n\nXem trước phản hồi kiểm định:\n${reasons.map((item, idx) => `${idx + 1}. ${item}`).join("\n")}`;
}

function buildPrompt(payload, options = {}) {
  const previousQuality = options?.previousQuality || null;
  const langKey = getLangKey(payload.lang);
  const outputConfig = getOutputLanguageConfig(payload.lang);
  const outputLanguageLabel = `${outputConfig.labelEn} (${outputConfig.code})`;
  const highlights = (payload.highlights || []).filter(Boolean).join(", ");
  const attributes = (payload.attributes || [])
    .filter((item) => item?.value)
    .map((item) => item.value)
    .join(", ");
  const categoryNote = getCategoryNoteByLanguage(payload.category, payload.lang);
  const qualityRule = getCategoryQualityRuleByLanguage(payload.category, payload.lang);

  const channelLabel = safePick(CHANNEL_LABELS[langKey], payload.channel, 2);
  const channelGuide = safePick(CHANNEL_GUIDES[langKey], payload.channel, 2);
  const toneGuide = safePick(TONE_GUIDES[langKey], payload.tone, 0);
  const brandGuide = safePick(BRAND_STYLE_GUIDES[langKey], payload.brandStyle, 0);
  const moodGuide = safePick(MOOD_GUIDES[langKey], payload.mood, 0);
  const categoryLabel = CATEGORY_LABELS[langKey]?.[payload.category] || CATEGORY_LABELS[langKey].other;
  const subcategoryHint = safePick(SUBCATEGORY_HINTS[langKey]?.[payload.category], payload.subcategory, "N/A");
  const industryPreset = compact(payload.industryPreset || "", 72);
  const improveContext = buildPreviousResultContext(payload, langKey);
  const brandPresetGuide = BRAND_PRESET_GUIDES[payload.brandPreset]?.[langKey] || "";
  const fewShotBlock = buildFewShotBlock(payload, langKey);
  const promptRepairBlock = buildPromptRepairBlock(payload, langKey, previousQuality);
  const advancedNotes = [];

  if (["skincare", "motherBaby", "healthCare"].includes(payload.category)) {
    if (payload.usage) advancedNotes.push(langKey === "en" ? `How to use: ${payload.usage}` : `Cách dùng: ${payload.usage}`);
    if (payload.skinConcern) advancedNotes.push(langKey === "en" ? `Skin concern: ${payload.skinConcern}` : `Vấn đề da: ${payload.skinConcern}`);
    if (payload.routineStep) advancedNotes.push(langKey === "en" ? `Routine step: ${payload.routineStep}` : `Bước routine: ${payload.routineStep}`);
  }

  if (["home", "homeAppliances", "toolsHardware"].includes(payload.category)) {
    if (payload.dimensions) advancedNotes.push(langKey === "en" ? `Detailed dimensions: ${payload.dimensions}` : `Kích thước chi tiết: ${payload.dimensions}`);
    if (payload.usageSpace) advancedNotes.push(langKey === "en" ? `Best space: ${payload.usageSpace}` : `Không gian phù hợp: ${payload.usageSpace}`);
    if (payload.warranty) advancedNotes.push(langKey === "en" ? `Warranty: ${payload.warranty}` : `Bảo hành: ${payload.warranty}`);
  }

  if (["electronics", "phoneTablet", "computerOffice", "cameraDrone", "autoMoto", "motherBaby", "healthCare"].includes(payload.category)) {
    if (payload.specs) advancedNotes.push(langKey === "en" ? `Key specs: ${payload.specs}` : `Thông số chính: ${payload.specs}`);
    if (payload.compatibility) advancedNotes.push(langKey === "en" ? `Compatibility: ${payload.compatibility}` : `Tương thích: ${payload.compatibility}`);
    if (payload.warranty) advancedNotes.push(langKey === "en" ? `Warranty: ${payload.warranty}` : `Bảo hành: ${payload.warranty}`);
  }

  if (payload.category === "fashion") {
    if (payload.sizeGuide) advancedNotes.push(langKey === "en" ? `Size guide: ${payload.sizeGuide}` : `Bảng size: ${payload.sizeGuide}`);
    if (payload.careGuide) advancedNotes.push(langKey === "en" ? `Care guide: ${payload.careGuide}` : `Bảo quản: ${payload.careGuide}`);
    if (payload.exchangePolicy) advancedNotes.push(langKey === "en" ? `Exchange / sizing: ${payload.exchangePolicy}` : `Đổi trả / size: ${payload.exchangePolicy}`);
  }

  const advancedNotesText = advancedNotes.length
    ? advancedNotes.map((line) => `- ${line}`).join("\n")
    : (langKey === "en" ? "- N/A" : "- Chưa có");

  const narrativeConstraints = langKey === "en"
    ? [
        "- Paragraph 1 must open with a concrete buyer context and why this product is relevant now.",
        "- Paragraph 2 must include 2-3 concrete value points (sensory, practical, or workflow outcome), not generic praise.",
        "- Paragraph 3 must include operational notes (if any), one buyer-fit line, and a soft CTA.",
        "- Keep each paragraph 2-4 sentences, with mobile-friendly sentence rhythm.",
        "- Hashtags must include at least one category-fit tag and one intent tag (review, setup, routine, etc.)."
      ]
    : [
        "- Đoạn 1 phải mở bằng bối cảnh người mua cụ thể và vì sao sản phẩm này đáng quan tâm ngay.",
        "- Đoạn 2 phải có 2-3 điểm giá trị cụ thể (cảm giác dùng, công năng, kết quả thực tế), không khen chung chung.",
        "- Đoạn 3 phải có ghi chú vận hành (nếu có), một câu chốt đúng nhóm khách và CTA mềm.",
        "- Mỗi đoạn giữ 2-4 câu, nhịp câu dễ đọc trên mobile.",
        "- Hashtag cần có ít nhất 1 tag đúng ngành và 1 tag đúng ý định mua (review, setup, routine...)."
      ];

  const antiGenericRules = langKey === "en"
    ? [
        "- Do not reuse cliche openings (must-have, game changer, best ever) unless backed by concrete proof.",
        "- Avoid repetitive adjective stacking; every key sentence must add new information.",
        "- Prefer specific nouns and concrete outcomes over abstract claims."
      ]
    : [
        "- Không mở kiểu sáo rỗng (must-have, cực phẩm, đỉnh của chóp) nếu không có bằng chứng cụ thể.",
        "- Tránh chồng tính từ lặp nghĩa; mỗi câu chính phải thêm thông tin mới.",
        "- Ưu tiên danh từ cụ thể và kết quả dễ hình dung thay vì claim trừu tượng."
      ];

  const promptQualityBlock = [...narrativeConstraints, ...antiGenericRules].join("\n");

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
- If category-specific operational notes are provided (usage, routine, care, warranty, compatibility, size/exchange), include them naturally and briefly in paragraph 3.
- Keep language natural and brand-safe.
- Output language is locked to ${outputLanguageLabel}. Every JSON text value must be written in ${outputLanguageLabel}.
- Do not mix Vietnamese, English, or any other language unless it is exactly ${outputLanguageLabel}.

Style direction:
- Tone: ${toneGuide}
- Brand style: ${brandGuide}
- Mood: ${moodGuide}
- Channel direction: ${channelGuide}
- Category note: ${categoryNote}
- Brand preset guide: ${brandPresetGuide || "N/A"}
- Quality target: ${qualityRule.good}
- Avoid: ${qualityRule.avoid}

Narrative quality constraints:
${promptQualityBlock}

Product information:
- Name: ${payload.productName || "N/A"}
- Category: ${categoryLabel}
- Sub-category: ${subcategoryHint} (index ${payload.subcategory || 0})
- Short description: ${payload.shortDescription || "N/A"}
- Highlights: ${highlights || "N/A"}
- Attributes: ${attributes || "N/A"}
- Price segment: ${payload.priceSegment || "N/A"}
- Target customer: ${payload.targetCustomer || "N/A"}
- Industry preset: ${industryPreset || "N/A"}
- Category operational notes:
${advancedNotesText}
- Images uploaded: ${(payload.images || []).length}
${improveContext}

Prompt version: ${PROMPT_VERSION}

Reference examples (style learning only, never copy text):
${fewShotBlock}${promptRepairBlock}

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
- Nếu có dữ liệu vận hành theo ngành (cách dùng, routine, bảo quản, bảo hành, tương thích, size/đổi trả) thì phải lồng ghép tự nhiên và ngắn gọn ở đoạn 3.
- Giữ giọng thương hiệu, không rao hàng lố.
- Khóa ngôn ngữ đầu ra: bắt buộc viết toàn bộ nội dung bằng ${outputLanguageLabel}.
- Mọi giá trị text trong JSON phải cùng ngôn ngữ ${outputLanguageLabel}, không trộn ngôn ngữ khác.

Định hướng giọng điệu:
- Tone: ${toneGuide}
- Style thương hiệu: ${brandGuide}
- Mood: ${moodGuide}
- Định hướng theo kênh: ${channelGuide}
- Ghi chú ngành: ${categoryNote}
- Gợi ý brand preset: ${brandPresetGuide || "N/A"}
- Chất lượng cần đạt: ${qualityRule.good}
- Điều cần tránh: ${qualityRule.avoid}

Ràng buộc chất lượng diễn đạt:
${promptQualityBlock}

Thông tin sản phẩm:
- Tên sản phẩm: ${payload.productName || "N/A"}
- Danh mục: ${categoryLabel}
- Dòng sản phẩm: ${subcategoryHint} (mã ${payload.subcategory || 0})
- Mô tả ngắn: ${payload.shortDescription || "N/A"}
- Điểm nổi bật: ${highlights || "N/A"}
- Thuộc tính bổ sung: ${attributes || "N/A"}
- Phân khúc giá: ${payload.priceSegment || "N/A"}
- Khách hàng mục tiêu: ${payload.targetCustomer || "N/A"}
- Template ngành hàng: ${industryPreset || "N/A"}
- Ghi chú vận hành theo ngành:
${advancedNotesText}
- Số ảnh đã tải lên: ${(payload.images || []).length}
${improveContext}

Phiên bản prompt: ${PROMPT_VERSION}

Ví dụ tham chiếu (chỉ học phong cách, tuyệt đối không chép nguyên văn):
${fewShotBlock}${promptRepairBlock}

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
            const error = new Error(parsed.error?.message || parsed.error || `HTTP ${response.statusCode}`);
            error.statusCode = response.statusCode || 500;
            error.responseBody = parsed;
            reject(error);
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
  const outputConfig = getOutputLanguageConfig(payload.lang);
  const name = payload.productName || outputConfig.productFallbackName;
  const firstLine = payload.shortDescription
    ? `${name}\n${compact(payload.shortDescription)}`
    : `${name}\n${outputConfig.fallbackIntro}`;

  return {
    paragraphs: [
      firstLine,
      buildDefaultSecondLines(payload, langKey).join("\n"),
      buildDefaultClosingLine(payload, langKey)
    ],
    hashtags: normalizeHashtags([], payload),
    source: "fallback",
    promptVersion: PROMPT_VERSION,
    meta: buildLocalizedResultMeta(payload.lang, payload.improved),
    quality: {
      score: 35,
      grade: "C",
      reasons: [outputConfig.fallbackUnavailableReason],
      retryRecommended: true
    }
  };
}

function attachPromptVersion(result) {
  return {
    ...result,
    promptVersion: PROMPT_VERSION
  };
}

export async function generateProductCopy(payload) {
  const apiBase = process.env.AI_API_BASE;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "cx/gpt-5.4";

  payload.lang = normalizeOutputLanguage(payload?.lang);

  if (!apiBase || !apiKey) {
    trackAiUsageEvent({ type: "generate_fallback" });
    return buildFallback(payload);
  }

  const content = [{ type: "text", text: buildPrompt(payload) }];
  for (const image of (payload.images || []).slice(0, 4)) {
    if (!image?.src) continue;
    if (!/^data:image\/(png|jpeg|jpg|gif|webp);/i.test(image.src)) continue;
    content.push({ type: "image_url", image_url: { url: image.src } });
  }

  const requestBody = {
    model,
    messages: [{ role: "user", content }],
    stream: false,
    response_format: { type: "json_object" }
  };

  const requestHeaders = { Authorization: `Bearer ${apiKey}` };
  if (/openrouter\.ai/i.test(apiBase)) {
    if (process.env.PUBLIC_BASE_URL) {
      requestHeaders["HTTP-Referer"] = process.env.PUBLIC_BASE_URL;
    }
    requestHeaders["X-Title"] = "gen-script";
  }

  try {
    const endpoint = `${apiBase.replace(/\/$/, "")}/chat/completions`;
    let quality = null;
    let finalResult = null;

    const langKey = getLangKey(payload.lang);
    const gradeByScore = (score) => {
      if (score >= 92) return "S";
      if (score >= 84) return "A";
      if (score >= 74) return "B";
      return "C";
    };
    const toFormattedResult = (aiResult) => {
      const rawMessage = aiResult.choices?.[0]?.message?.content;
      const parsed = parseJsonObject(extractMessageText(rawMessage));
      if (!parsed || typeof parsed !== "object") return null;
      const normalized = normalizeAiPayloadResult(payload, parsed);
      return applyCategoryFormatting(normalized, payload, langKey);
    };

    const runAttempt = async (attempt, previousQuality = null) => {
      trackAiUsageEvent({ type: "generate_request" });
      const repairBlock = attempt > 1
        ? buildCriticRepairPrompt(payload, langKey, previousQuality)
        : "";
      const attemptBody = {
        ...requestBody,
        messages: [{ role: "user", content: [{ type: "text", text: `${buildPrompt(payload, { previousQuality })}${repairBlock}` }, ...content.slice(1)] }]
      };
      const attemptRaw = await postJson(endpoint, attemptBody, requestHeaders);
      const attemptResult = toFormattedResult(attemptRaw);
      const attemptQuality = attemptResult ? evaluateOutputQuality(attemptResult, payload, langKey) : null;

      return {
        attempt,
        result: attemptResult,
        quality: attemptQuality
      };
    };

    const firstAttempt = await runAttempt(1, null);
    finalResult = firstAttempt.result;
    quality = firstAttempt.quality;

    if (!finalResult || resultNeedsRetry(finalResult) || quality?.retryRecommended) {
      const secondAttempt = await runAttempt(2, quality);
      const retried = secondAttempt.result;
      const retriedQuality = secondAttempt.quality;
      if (retried) {
        if (!quality || (retriedQuality?.score || 0) >= (quality?.score || 0)) {
          finalResult = retried;
          quality = retriedQuality;
        }
      }
    }

    if (!finalResult?.paragraphs?.length) return buildFallback(payload);

    if (!quality) {
      quality = evaluateOutputQuality(finalResult, payload, langKey);
    }

    finalResult.quality = {
      score: quality.score,
      grade: gradeByScore(quality.score),
      reasons: quality.reasons.slice(0, 3),
      retryRecommended: quality.retryRecommended
    };

    finalResult.meta = buildLocalizedResultMeta(payload.lang, payload.improved, finalResult.quality);
    finalResult = attachPromptVersion(finalResult);

    if (finalResult.source === "fallback") {
      trackAiUsageEvent({ type: "generate_fallback" });
    } else {
      trackAiUsageEvent({ type: "generate_success" });
    }

    return finalResult;
  } catch (error) {
    console.error("[AI] generateProductCopy failed", error?.message || error);
    trackAiUsageEvent({ type: "generate_fallback" });
    return buildFallback(payload);
  }
}

export async function generateProductCopyVariants(payload) {
  const requested = Number(payload?.variantCount || 1);
  const variantCount = Math.max(1, Math.min(2, requested));

  const primary = await generateProductCopy(payload);
  if (variantCount <= 1) {
    return {
      primary,
      variants: [primary],
      selectedVariant: 0
    };
  }

  const altPreset = payload.brandPreset === "conversion" ? "premium" : "conversion";
  const secondary = await generateProductCopy({
    ...payload,
    improved: true,
    previousResult: {
      paragraphs: primary.paragraphs || [],
      hashtags: primary.hashtags || []
    },
    brandPreset: altPreset
  });

  const variants = [primary, secondary].filter(Boolean);
  const selectedVariant = variants[1] && (variants[1].quality?.score || 0) > (variants[0].quality?.score || 0) ? 1 : 0;

  return {
    primary: variants[selectedVariant] || primary,
    variants,
    selectedVariant
  };
}

export async function suggestProductFromImages(payload) {
  const outputConfig = getOutputLanguageConfig(payload?.lang);
  const outputLanguageLabel = `${outputConfig.labelEn} (${outputConfig.code})`;
  const fallback = {
    category: "other",
    tone: 0,
    channel: 2,
    mood: 0,
    brandStyle: 0,
    targetCustomer: "",
    shortDescription: "",
    highlights: [],
    attributes: [],
    confidence: 0.35,
    notes: [outputConfig.suggestNoDataNote]
  };

  const images = Array.isArray(payload?.images) ? payload.images.slice(0, 4) : [];
  if (!images.length) {
    trackAiUsageEvent({ type: "suggest_fallback" });
    return fallback;
  }

  const apiBase = process.env.AI_API_BASE;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "cx/gpt-5.4";
  if (!apiBase || !apiKey) {
    trackAiUsageEvent({ type: "suggest_fallback" });
    return fallback;
  }

  const prompt = `You are a senior ecommerce vision analyst.

Critical instruction:
- If image evidence is weak/ambiguous, do NOT force a specific category.
- Prefer conservative output with clear uncertainty notes instead of hallucinating specs.

Task: based on the uploaded images and product name (if available), suggest suitable form prefill values.
Return only valid JSON with this schema:
{
  "generatedProductName":"...",
  "category":"fashion|skincare|beautyTools|home|furnitureDecor|electronics|food|householdEssentials|footwear|bags|accessories|fragrance|pet|sports|motherBaby|healthCare|booksStationery|toysGames|autoMoto|phoneTablet|computerOffice|cameraDrone|homeAppliances|toolsHardware|digitalGoods|other",
  "tone":0|1|2,
  "channel":0|1|2,
  "mood":0|1|2|3,
  "brandStyle":0|1|2|3,
  "targetCustomer":"...",
  "shortDescription":"...",
  "highlights":["...","..."],
  "attributes":[{"type":0,"value":"..."},{"type":1,"value":"..."}],
  "confidence":0.0,
  "notes":["..."]
}
Constraints:
- Do not invent hard specs that are not visible in the images.
- Focus on practical prefill suggestions for form fields.
- If product name strongly indicates product type (e.g. "tai nghe"), prioritize that signal over weak image context.
- For electronics-like products, only output "computerOffice" when visible cues clearly show keyboard/mouse/laptop workflow.
- For audio accessories (headphones/earbuds), prefer "electronics" unless evidence contradicts.
- confidence must be from 0 to 1.
- generatedProductName rules:
  - If the product can be identified with reasonable confidence, return a concise market-ready product name in ${outputLanguageLabel}.
  - If product is ambiguous, set generatedProductName to exactly "Không nhận dạng tên sản phẩm được" when output language is Vietnamese, otherwise "Unable to identify product name".
- Output language is locked to ${outputLanguageLabel}. Every JSON text value must be written in ${outputLanguageLabel}.
- Do not mix any language other than ${outputLanguageLabel}.
Product name: ${payload.productName || "N/A"}`;

  const endpoint = `${apiBase.replace(/\/$/, "")}/chat/completions`;
  const basePrompt = prompt;
  const bodyBase = {
    model,
    stream: false,
    response_format: { type: "json_object" }
  };

  const buildVisionBody = async (promptText, contentOptions = {}) => ({
    ...bodyBase,
    messages: [{ role: "user", content: await buildVisionContent(payload, promptText, contentOptions) }]
  });

  const buildNameOnlyBody = (promptText = basePrompt) => {
    const fallbackPrompt = `${promptText}\n\nImage note: image ingestion is unavailable for this provider request. Infer safe broad category and brief prefill from product name only. Never invent hard specs.`;
    return {
      ...bodyBase,
      messages: [{ role: "user", content: [{ type: "text", text: fallbackPrompt }] }]
    };
  };

  const headers = { Authorization: `Bearer ${apiKey}` };
  if (/openrouter\.ai/i.test(apiBase)) {
    if (process.env.PUBLIC_BASE_URL) headers["HTTP-Referer"] = process.env.PUBLIC_BASE_URL;
    headers["X-Title"] = "gen-script";
  }

  const requestWithVisionFallback = async (promptText) => {
    if (DEBUG_FORCE_NAME_ONLY) {
      trackAiUsageEvent({ type: "suggest_request" });
      return await postJson(endpoint, buildNameOnlyBody(promptText), headers);
    }

    const initialBody = await buildVisionBody(promptText);
    const primaryBody = bodyHasImageParts(initialBody)
      ? initialBody
      : {
          ...bodyBase,
          messages: [{ role: "user", content: asDataUrlImageContent(images, promptText) }]
        };

    if (!bodyHasImageParts(primaryBody)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[AI][suggest] request has no usable image payload; using name-only mode fallback path");
      }
      trackAiUsageEvent({ type: "suggest_request" });
      return await postJson(endpoint, buildNameOnlyBody(promptText), headers);
    }

    const attempts = [primaryBody];
    if (bodyUsesDataUrlImages(primaryBody)) {
      const publicBody = await buildVisionBody(promptText, { forcePublicUrl: true });
      if (bodyHasImageParts(publicBody) && !bodyUsesDataUrlImages(publicBody)) {
        attempts.push(publicBody);
      }
    } else {
      const directDataBody = {
        ...bodyBase,
        messages: [{ role: "user", content: asDataUrlImageContent(images, promptText) }]
      };
      if (bodyHasImageParts(directDataBody)) {
        attempts.push(directDataBody);
      }
    }

    for (const attemptBody of attempts) {
      try {
        trackAiUsageEvent({ type: "suggest_request" });
        return await postJson(endpoint, attemptBody, headers);
      } catch (error) {
        if (!isImageIngestionError(error)) {
          throw error;
        }
      }
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn("[AI][suggest] image ingestion failed on all image modes, retrying with name-only mode");
    }

    trackAiUsageEvent({ type: "suggest_request" });
    return await postJson(endpoint, buildNameOnlyBody(promptText), headers);
  };

  try {
    const result = await requestWithVisionFallback(basePrompt);
    const raw = result.choices?.[0]?.message?.content;
    const parsed = parseJsonObject(extractMessageText(raw));
    if (!parsed || typeof parsed !== "object") {
      if (process.env.NODE_ENV !== "production") {
        console.log(JSON.stringify({
          level: "warn",
          event: "suggest.parse_failed",
          endpoint,
          hasRaw: Boolean(raw),
          imagesCount: images.length
        }));
      }
      trackAiUsageEvent({ type: "suggest_fallback" });
      return fallback;
    }

    const suggestion = {
      category: normalizeCategoryValue(parsed.category || "other"),
      tone: toNumberOr(parsed.tone, 0),
      channel: toNumberOr(parsed.channel, 2),
      mood: toNumberOr(parsed.mood, 0),
      brandStyle: toNumberOr(parsed.brandStyle, 0),
      generatedProductName: normalizeGeneratedProductName(parsed.generatedProductName || parsed.inferredProductName || "", payload?.lang),
      targetCustomer: compact(parsed.targetCustomer || ""),
      shortDescription: compact(parsed.shortDescription || ""),
      highlights: asStringArray(parsed.highlights, { max: 5, maxLength: 90 }),
      attributes: Array.isArray(parsed.attributes)
        ? parsed.attributes
            .map((item, idx) => ({ type: toNumberOr(item?.type, idx), value: compact(item?.value || "") }))
            .filter((item) => item.value)
            .slice(0, 6)
        : [],
      confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.45)),
      notes: asStringArray(parsed.notes, { max: 4, maxLength: 120 })
    };

    const normalizedCategory = getCategoryValuesByGroup(getCategoryGroupValue(suggestion.category)).includes(suggestion.category)
      ? suggestion.category
      : "other";
    suggestion.category = normalizedCategory;

    if (shouldOverrideSuggestedCategoryByName(payload?.productName, suggestion.category)) {
      suggestion.category = inferCategoryFromProductName(payload?.productName) || suggestion.category;
      suggestion.confidence = Math.max(0.4, Math.min(0.88, suggestion.confidence || 0.55));
      const mismatchNote = buildCategoryMismatchNote(payload?.productName, normalizedCategory, payload?.lang);
      if (mismatchNote) {
        suggestion.notes = [mismatchNote, ...suggestion.notes].slice(0, 4);
      }
    }

    if (!suggestion.notes.length) {
      suggestion.notes = [outputConfig.suggestNoDataNote];
    }

    if (isLikelyImageAnalysisFallback(suggestion, outputConfig)) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[AI][suggest] primary result looks like fallback; attempting strict retry");
      }

      const strictPrompt = `${basePrompt}\n\nStrict retry rules:\n- Return category based on strongest evidence between product name and image.\n- If unsure, explain uncertainty in notes but still choose the most likely broad category.\n- Avoid defaulting to other unless both signals are weak.`;

      try {
        const retryResult = await requestWithVisionFallback(strictPrompt);
        const retryRaw = retryResult.choices?.[0]?.message?.content;
        const retryParsed = parseJsonObject(extractMessageText(retryRaw));
        if (retryParsed && typeof retryParsed === "object") {
          const retrySuggestion = {
            category: normalizeCategoryValue(retryParsed.category || suggestion.category || "other"),
            tone: toNumberOr(retryParsed.tone, suggestion.tone),
            channel: toNumberOr(retryParsed.channel, suggestion.channel),
            mood: toNumberOr(retryParsed.mood, suggestion.mood),
            brandStyle: toNumberOr(retryParsed.brandStyle, suggestion.brandStyle),
            generatedProductName: normalizeGeneratedProductName(retryParsed.generatedProductName || retryParsed.inferredProductName || suggestion.generatedProductName || "", payload?.lang),
            targetCustomer: compact(retryParsed.targetCustomer || suggestion.targetCustomer || ""),
            shortDescription: compact(retryParsed.shortDescription || suggestion.shortDescription || ""),
            highlights: asStringArray(retryParsed.highlights, { max: 5, maxLength: 90 }),
            attributes: Array.isArray(retryParsed.attributes)
              ? retryParsed.attributes
                  .map((item, idx) => ({ type: toNumberOr(item?.type, idx), value: compact(item?.value || "") }))
                  .filter((item) => item.value)
                  .slice(0, 6)
              : suggestion.attributes,
            confidence: Math.max(0, Math.min(1, Number(retryParsed.confidence) || suggestion.confidence || 0.45)),
            notes: asStringArray(retryParsed.notes, { max: 4, maxLength: 120 })
          };

          const retryCategory = getCategoryValuesByGroup(getCategoryGroupValue(retrySuggestion.category)).includes(retrySuggestion.category)
            ? retrySuggestion.category
            : suggestion.category;
          retrySuggestion.category = retryCategory;

          if (shouldOverrideSuggestedCategoryByName(payload?.productName, retrySuggestion.category)) {
            retrySuggestion.category = inferCategoryFromProductName(payload?.productName) || retrySuggestion.category;
            retrySuggestion.confidence = Math.max(0.45, Math.min(0.9, retrySuggestion.confidence || 0.6));
            const mismatchNote = buildCategoryMismatchNote(payload?.productName, retryCategory, payload?.lang);
            if (mismatchNote) {
              retrySuggestion.notes = [mismatchNote, ...retrySuggestion.notes].slice(0, 4);
            }
          }

          if (!isLikelyImageAnalysisFallback(retrySuggestion, outputConfig)) {
            trackAiUsageEvent({ type: "suggest_success" });
            return retrySuggestion;
          }
        }
      } catch (retryError) {
        if (process.env.NODE_ENV !== "production") {
          console.warn("[AI][suggest] strict retry failed", retryError?.statusCode || "", retryError?.message || retryError);
        }
      }

      const imageOnlyHeuristic = buildImageOnlyHeuristicSuggestion(payload, outputConfig);
      if (imageOnlyHeuristic.category !== "other") {
        trackAiUsageEvent({ type: "suggest_success" });
        return imageOnlyHeuristic;
      }
    }

    trackAiUsageEvent({ type: "suggest_success" });
    return suggestion;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[AI][suggest] failed", error?.statusCode || "", error?.message || error);
    }
    const imageOnlyHeuristic = buildImageOnlyHeuristicSuggestion(payload, outputConfig);
    if (imageOnlyHeuristic.category !== "other") {
      trackAiUsageEvent({ type: "suggest_fallback" });
      return imageOnlyHeuristic;
    }

    const nameOnly = buildNameOnlySuggestion(payload, outputConfig);
    trackAiUsageEvent({ type: "suggest_fallback" });
    return nameOnly;
  }
}
