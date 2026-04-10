import http from "http";
import https from "https";
import { trackAiUsageEvent } from "@/lib/server/ai-usage-service";
import {
  coerceVideoStylePresetForPlan,
  getVideoStylePresetLabel,
  normalizeVideoStylePreset,
  videoOpeningStyleToPreset,
  videoStylePresetToOpeningStyle
} from "@/lib/video-style-presets";

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
    "Mở bằng tuyên bố ngược số đông nhưng vẫn hợp lý và an toàn.",
    "Mở bằng mini storytelling 2 câu, dẫn vào tình huống đời thường.",
    "Mở bằng social-proof (feedback/kết quả thật) để tăng độ tin cậy ngay."
  ],
  en: [
    "Open with a sharp pain-point in one short line.",
    "Open with a before/after curiosity line in first 2 seconds.",
    "Open with a contrarian but credible statement.",
    "Open with a two-line mini story anchored in real-life context.",
    "Open with social proof (real feedback/results) to build trust quickly."
  ]
};

const OPENING_STYLE_SHORT_LABELS = {
  vi: [
    "Nỗi đau trực diện",
    "So sánh trước/sau",
    "Tuyên bố ngược số đông",
    "Storytelling ngắn",
    "Social-proof tin cậy"
  ],
  en: [
    "Direct pain-point",
    "Before/after",
    "Contrarian statement",
    "Short storytelling",
    "Social-proof"
  ]
};

const VIDEO_MOOD_ENFORCEMENT = {
  vi: {
    "Năng động cuốn hút": [
      "Hook cần tốc độ, nhịp nhanh, có từ hành động rõ.",
      "Scene 1-2 ưu tiên nhịp chuyển động và năng lượng tích cực.",
      "CTA mang cảm giác kéo người xem hành động ngay."
    ],
    "Tự tin thuyết phục": [
      "Hook nên nêu luận điểm dứt khoát, ít rào đón.",
      "Mỗi scene phải có luận cứ cụ thể (lợi ích + bằng chứng).",
      "CTA hướng về quyết định mua rõ ràng hơn."
    ],
    "Ấm áp gần gũi": [
      "Giọng thoại thân thiện, đồng cảm bối cảnh đời thường.",
      "Ưu tiên ví dụ nhỏ thực tế để tạo cảm giác gần người xem.",
      "CTA mềm và mang tính mời gọi, không ép mua."
    ]
  },
  en: {
    "Energetic and catchy": [
      "Use faster rhythm with energetic action verbs.",
      "Scene 1-2 should feel dynamic and momentum-driven.",
      "CTA should carry immediate action energy."
    ],
    "Confident and persuasive": [
      "Hook should be assertive and direct.",
      "Each scene should include concrete claim + evidence.",
      "CTA should lean into clear buying decision."
    ],
    "Warm and close": [
      "Use friendly and relatable spoken style.",
      "Include small real-life cues for empathy.",
      "Use soft invitation CTA tone."
    ]
  }
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

const FALLBACK_VOICE_PACK = {
  vi: {
    hooks: [
      "Nếu bạn đang phân vân món này, nghe mình nói thật nhé.",
      "Mình từng nghĩ món này chỉ quảng cáo hay thôi, cho tới khi test thật.",
      "Không phải món nào cũng đáng mua, nhưng món này có vài điểm đáng nói.",
      "Mình dùng thử để kiểm chứng luôn, không nói theo quảng cáo.",
      "Mình chốt nhanh sau khi test thật, vì có vài thứ vượt kỳ vọng."
    ],
    scene1: [
      "Mình test {productName} trong đúng bối cảnh dùng hằng ngày, không setup cầu kỳ.",
      "Mình đem {productName} vào routine bình thường để xem có thực sự tiện không.",
      "Mình dùng {productName} như cách người dùng thật hay dùng mỗi ngày."
    ],
    scene2: [
      "Điểm ăn tiền là trải nghiệm thực tế mượt hơn mình tưởng, đỡ mất thao tác lặt vặt.",
      "Cái mình thích nhất là hiệu quả thấy rõ sau vài lần dùng, không cần chờ quá lâu.",
      "Sau vài ngày dùng đều, mình thấy thứ này giải quyết đúng nỗi khó chịu ban đầu."
    ],
    scene3: [
      "Nếu bạn thuộc nhóm {targetCustomer}, đây là món đáng thử trước khi mua bản đắt hơn.",
      "Nếu bạn ưu tiên {highlight}, món này hợp để bắt đầu vì dễ dùng và dễ duy trì.",
      "Nếu bạn từng lăn tăn vì {painPoint}, mình nghĩ món này đáng cân nhắc thật."
    ],
    ctas: [
      "Comment 'review' mình gửi checklist dùng thực tế cho bạn.",
      "Comment 'chi tiết' mình gửi bản so sánh nhanh theo nhu cầu của bạn.",
      "Nếu muốn mình review sâu hơn, comment 'phân tích' nhé.",
      "Comment 'inbox' để mình gửi cấu hình/gợi ý phù hợp túi tiền của bạn."
    ],
    shot1: [
      "Hook mở đầu: bối cảnh thật + vấn đề đang gặp",
      "Hook mở đầu: cận cảnh thao tác đầu tiên",
      "Hook mở đầu: nêu vấn đề trong 1 câu ngắn"
    ],
    shot2: [
      "Cận cảnh chi tiết sử dụng quan trọng",
      "Quay thao tác thực tế 1 lần liền mạch",
      "Góc camera gần để thấy rõ trải nghiệm"
    ],
    shot3: [
      "Khoảnh khắc bằng chứng: before/after hoặc phản ứng thật",
      "Chèn số liệu/ngữ cảnh dùng thật ngắn gọn",
      "Highlight kết quả quan sát được"
    ],
    shot4: [
      "CTA mềm cuối video + text overlay rõ",
      "Kết thúc bằng lời mời comment tự nhiên",
      "Chốt nhẹ bằng lợi ích chính + CTA"
    ],
    visuals1: [
      "Toàn cảnh bối cảnh dùng thật + cận tay thao tác",
      "Cận sản phẩm trong tình huống sử dụng thường ngày",
      "Góc quay đời thường, hạn chế set-up quá sạch"
    ],
    visuals2: [
      "Cận chi tiết tính năng + biểu cảm người dùng",
      "So sánh trước/sau hoặc 2 thao tác khác nhau",
      "Text overlay 1 lợi ích chính, giữ ngắn"
    ],
    visuals3: [
      "Overlay nhóm người dùng phù hợp + bối cảnh ứng dụng",
      "Góc người thật dùng thật, chèn note ngắn",
      "Nhấn 1-2 điểm chốt bằng text lớn dễ đọc"
    ]
  },
  en: {
    hooks: [
      "If you are still unsure about this product, here is an honest take.",
      "I thought this was all marketing, until I tested it in real life.",
      "Not every product is worth buying, but this one has a few strong points.",
      "I tested this in a normal routine, not a staged setup.",
      "I only kept using it because real usage felt better than expected."
    ],
    scene1: [
      "I tested {productName} in a normal daily context, no fancy setup.",
      "I put {productName} into my regular routine to see if it is truly practical.",
      "I used {productName} the way most users would use it every day."
    ],
    scene2: [
      "The best part is smoother real usage and fewer tiny frictions.",
      "What I liked most is the visible value after a few uses.",
      "After a few days, it solved the exact pain point I started with."
    ],
    scene3: [
      "If you are in {targetCustomer}, this is worth trying before pricier options.",
      "If you care about {highlight}, this is a practical starting point.",
      "If you struggle with {painPoint}, this is genuinely worth considering."
    ],
    ctas: [
      "Comment 'review' and I will send a practical usage checklist.",
      "Comment 'details' and I will share a quick need-based comparison.",
      "If you want a deeper breakdown, comment 'analysis'.",
      "Comment 'inbox' and I will send a budget-fit recommendation."
    ],
    shot1: [
      "Opening hook: real context + clear pain point",
      "Opening hook: close-up first interaction",
      "Opening hook: one-line tension statement"
    ],
    shot2: [
      "Close-up of key usage detail",
      "One continuous real-use demo",
      "Near camera angle for tactile clarity"
    ],
    shot3: [
      "Proof moment: before/after or real reaction",
      "Add one short measurable context",
      "Highlight one observable outcome"
    ],
    shot4: [
      "Soft CTA at the end with clean overlay",
      "Natural comment prompt ending",
      "Close with core benefit + CTA"
    ],
    visuals1: [
      "Real-use context wide shot + hand interaction close-up",
      "Close-up in normal daily usage scenario",
      "Everyday setup, avoid over-staged look"
    ],
    visuals2: [
      "Feature detail close-up + user expression",
      "Before/after or two-way action comparison",
      "One short benefit overlay"
    ],
    visuals3: [
      "Overlay target user fit + practical context",
      "Real user shot with brief on-screen note",
      "Emphasize 1-2 key takeaways with big text"
    ]
  }
};

const FALLBACK_STYLE_PACK = {
  vi: {
    0: {
      hooks: [
        "Nếu bạn đang {painPoint}, xem kỹ trải nghiệm thật này trước khi chốt.",
        "Bạn từng {painPoint} chưa? Mình test thật rồi mới dám nói."
      ],
      scene1: [
        "Trước đây mình cũng {painPoint}, mỗi lần dùng là mất nhịp.",
        "Mình từng bị đúng lỗi {painPoint}, khá bực khi dùng hằng ngày."
      ],
      scene2: [
        "Đổi sang {productName}, cái khác rõ nhất là {highlight}.",
        "Sau vài lần dùng {productName}, mình đỡ cảnh lặp thao tác vô nghĩa."
      ],
      scene3: [
        "Hợp nhất với {targetCustomer}, nhất là khi muốn giải pháp gọn mà hiệu quả.",
        "Nếu bạn là {targetCustomer}, đây là lựa chọn đáng cân nhắc thực tế."
      ],
      ctas: [
        "Comment 'pain' mình gửi checklist theo đúng tình huống của bạn.",
        "Comment 'gợi ý' mình gửi flow dùng nhanh theo nhu cầu của bạn."
      ],
      shot1: [
        "Hook mở đầu: nêu đau điểm thật trong 1 câu ngắn"
      ],
      shot3: [
        "Khoảnh khắc giải quyết đau điểm + phản ứng thật"
      ]
    },
    1: {
      hooks: [
        "Trước và sau khi dùng {productName}, khác nhau đúng ở điểm này.",
        "Mình cho bạn xem trước/sau thật của {productName} theo cách dễ hình dung nhất."
      ],
      scene1: [
        "Trước: mình {painPoint}, mất thời gian và dễ tụt mood.",
        "Trước khi đổi, tình huống của mình là {painPoint}."
      ],
      scene2: [
        "Sau: mình giữ được {highlight}, thao tác trơn tru hơn rõ.",
        "Sau khi dùng {productName}, sự khác biệt là mọi thứ đỡ rối hơn nhiều."
      ],
      scene3: [
        "Nếu bạn là {targetCustomer}, kiểu nâng cấp này cảm nhận khá nhanh.",
        "Với {targetCustomer}, đây là dạng nâng cấp dễ thấy nhất khi dùng thật."
      ],
      ctas: [
        "Comment 'beforeafter' mình gửi checklist so sánh theo nhu cầu của bạn.",
        "Comment 'trướcsau' mình gửi bản tự test tại nhà cực nhanh."
      ],
      shot1: [
        "Hook mở đầu: split-screen Before vs After"
      ],
      shot2: [
        "Cùng 1 tác vụ quay 2 trạng thái trước/sau"
      ],
      shot3: [
        "Overlay khác biệt rõ nhất bằng 1 dòng ngắn"
      ]
    },
    2: {
      hooks: [
        "Nhiều người nghĩ {productName} chỉ là hype, nhưng test thật thì khác.",
        "Mình từng chê {productName}, giờ lại dùng hằng ngày vì lý do này."
      ],
      scene1: [
        "Mình cũng từng bỏ qua vì nghĩ không đáng tiền.",
        "Ban đầu mình nghĩ món này không giải quyết được {painPoint}."
      ],
      scene2: [
        "Dùng thật mới thấy điểm đáng tiền là {highlight}, không phải lời quảng cáo.",
        "Điều khiến mình đổi ý là trải nghiệm thực tế ổn định hơn kỳ vọng."
      ],
      scene3: [
        "Không phải ai cũng cần, nhưng {targetCustomer} thì nên thử.",
        "Nếu bạn thuộc nhóm {targetCustomer}, mình nghĩ đây là món đáng check kỹ."
      ],
      ctas: [
        "Comment 'thật' mình gửi cả điểm đáng mua lẫn điểm cần cân nhắc.",
        "Comment 'đổi ý' mình gửi note nhanh ưu và nhược để bạn tự chốt."
      ],
      shot1: [
        "Hook mở đầu: tuyên bố ngược số đông + biểu cảm thật"
      ],
      shot3: [
        "Chốt bằng 1 luận điểm trái kỳ vọng nhưng có bằng chứng"
      ]
    },
    3: {
      hooks: [
        "Sáng nay mình suýt trễ việc chỉ vì {painPoint}.",
        "Một tình huống rất đời thường khiến mình phải thử {productName}."
      ],
      scene1: [
        "Đúng lúc đó mình lấy {productName} ra test thật luôn.",
        "Mình dùng {productName} ngay trong bối cảnh đang rối nhất."
      ],
      scene2: [
        "Kết quả: {highlight}, mọi thứ trôi hơn và đỡ ngắt mạch.",
        "Sau vài lần dùng, mình thấy trải nghiệm bớt áp lực rõ rệt."
      ],
      scene3: [
        "Sau vài ngày, mình giữ lại vì hợp nhịp sống của {targetCustomer}.",
        "Nếu bạn là {targetCustomer}, kiểu trải nghiệm này rất dễ đồng cảm."
      ],
      ctas: [
        "Comment 'story' mình kể kỹ cách mình dùng theo từng bối cảnh.",
        "Comment 'routine' mình gửi flow dùng mỗi ngày của mình."
      ],
      shot1: [
        "Hook mở đầu: mở bằng tình huống đời thường có xung đột"
      ],
      shot2: [
        "Quay theo nhịp: vấn đề -> thử -> phản ứng"
      ],
      shot4: [
        "Kết bằng mini bài học + CTA mềm"
      ]
    },
    4: {
      hooks: [
        "3 feedback giống nhau về {productName} làm mình phải test thử ngay.",
        "Mình đọc nhiều phản hồi tốt về {productName}, nên test luôn bản thân."
      ],
      scene1: [
        "Feedback lặp lại nhiều nhất là: {highlight}.",
        "Điểm mọi người nhắc nhiều là trải nghiệm ổn định và dễ dùng."
      ],
      scene2: [
        "Mình test theo nhu cầu thật và ra kết quả khá khớp: {proofPoint}.",
        "Sau test thực tế, mình thấy nhận xét đó không phải ngẫu nhiên."
      ],
      scene3: [
        "Nếu bạn là {targetCustomer}, khả năng cao bạn cũng sẽ thấy hợp.",
        "Với nhóm {targetCustomer}, đây là lựa chọn an toàn để thử trước."
      ],
      ctas: [
        "Comment 'feedback' mình gửi bảng đánh giá nhanh ưu/nhược.",
        "Comment 'chứng thực' mình gửi tổng hợp review thật để bạn đối chiếu."
      ],
      shot1: [
        "Hook mở đầu: chèn social proof ngắn (số review/feedback)"
      ],
      shot3: [
        "Chèn bằng chứng test thật + 1 chỉ số ngắn"
      ],
      shot4: [
        "Kết bằng lời mời xem thêm feedback thực tế"
      ]
    }
  },
  en: {
    0: {
      hooks: [
        "If you are dealing with {painPoint}, check this real-use take before buying.",
        "If {painPoint} sounds familiar, this quick test is for you."
      ],
      scene1: [
        "I used to run into {painPoint} all the time in daily use.",
        "My daily friction was exactly {painPoint}."
      ],
      scene2: [
        "With {productName}, the biggest change is {highlight}.",
        "After a few uses, it removed small repetitive friction clearly."
      ],
      scene3: [
        "For {targetCustomer}, this is a practical upgrade worth trying.",
        "If you are in {targetCustomer}, this likely fits your workflow."
      ],
      ctas: [
        "Comment 'pain' and I will send a fit-by-scenario checklist.",
        "Comment 'guide' and I will share a quick practical setup flow."
      ]
    },
    1: {
      hooks: [
        "Before vs after using {productName}: this is the real difference.",
        "Here is a real before/after test of {productName} in practical use."
      ],
      scene1: [
        "Before: {painPoint} kept slowing me down.",
        "My before-state was simple: {painPoint}."
      ],
      scene2: [
        "After: {highlight} and much smoother execution.",
        "After switching, I noticed less friction and faster completion."
      ],
      scene3: [
        "For {targetCustomer}, this is the easiest upgrade to feel quickly.",
        "If you are {targetCustomer}, this difference is easy to notice."
      ],
      ctas: [
        "Comment 'beforeafter' and I will send my quick comparison checklist.",
        "Comment 'compare' and I will share a simple self-test flow."
      ]
    },
    2: {
      hooks: [
        "Most people call {productName} hype, but real use says otherwise.",
        "I used to dismiss {productName}, now I use it daily."
      ],
      scene1: [
        "I also thought this was overhyped at first.",
        "Initially, I doubted it could solve {painPoint}."
      ],
      scene2: [
        "Real use changed my mind because of {highlight}.",
        "What changed my view was practical consistency, not marketing lines."
      ],
      scene3: [
        "Not for everyone, but for {targetCustomer} this is worth checking.",
        "If you are in {targetCustomer}, this is a fair contender."
      ],
      ctas: [
        "Comment 'honest' and I will send both pros and cons.",
        "Comment 'real' and I will share my buy/no-buy notes."
      ]
    },
    3: {
      hooks: [
        "This morning I almost got delayed because of {painPoint}.",
        "A normal daily problem pushed me to test {productName}."
      ],
      scene1: [
        "That is when I tested {productName} in real context.",
        "I used it in the exact messy moment, not in a studio setup."
      ],
      scene2: [
        "Result: {highlight}, and the workflow felt less interrupted.",
        "After a few tries, the routine felt noticeably smoother."
      ],
      scene3: [
        "After several days, I kept it because it fits {targetCustomer} use.",
        "If you are {targetCustomer}, this story may feel very familiar."
      ],
      ctas: [
        "Comment 'story' and I will share my real daily flow.",
        "Comment 'routine' and I will send the exact usage sequence."
      ]
    },
    4: {
      hooks: [
        "Multiple users said the same thing about {productName}, so I tested it.",
        "I saw repeated positive feedback, then I verified it myself."
      ],
      scene1: [
        "The most repeated feedback point was {highlight}.",
        "What users repeat most is stable and practical usage feel."
      ],
      scene2: [
        "My own test matched that pattern: {proofPoint}.",
        "After testing in real use, that feedback made sense."
      ],
      scene3: [
        "For {targetCustomer}, this is likely a safe option to start with.",
        "If you are in {targetCustomer}, chances are this will fit."
      ],
      ctas: [
        "Comment 'feedback' and I will send a quick pros/cons board.",
        "Comment 'proof' and I will share practical evidence notes."
      ]
    }
  }
};

function randomIndex(max, seed = 0) {
  const safeMax = Math.max(1, Number(max) || 1);
  const safeSeed = Math.max(0, Number(seed) || 0);
  return safeSeed % safeMax;
}

function pickBySeed(items = [], seed = 0, fallback = "") {
  const list = Array.isArray(items) ? items : [];
  if (!list.length) return fallback;
  return String(list[randomIndex(list.length, seed)] || fallback || "");
}

function fillTemplateTokens(template = "", values = {}) {
  return String(template || "")
    .replaceAll("{productName}", compact(values.productName || "Sản phẩm", 120))
    .replaceAll("{targetCustomer}", compact(values.targetCustomer || "người dùng phù hợp", 120))
    .replaceAll("{highlight}", compact(values.highlight || "trải nghiệm dùng", 80))
    .replaceAll("{painPoint}", compact(values.painPoint || "nỗi khó chịu thường gặp", 120))
    .replaceAll("{proofPoint}", compact(values.proofPoint || "kết quả dùng thực tế", 120));
}

function removeTimeMentions(value = "") {
  let next = String(value || "");
  next = next.replace(/\b\d+\s*(?:giay|giây|seconds?|sec|s)\b/giu, "");
  next = next.replace(/\b(?:0\s*[-:]\s*3\s*(?:giay|giây|seconds?|sec|s))\b/giu, "");
  next = next.replace(/\b(?:under|within)\s*\d+\s*seconds?\b/giu, "");
  next = next.replace(/\b\d+\s*[-–]\s*\d+\s*(?:giay|giây|seconds?|sec|s)\b/giu, "");
  return compact(next.replace(/\s{2,}/g, " ").replace(/\s+([,.;:!?])/g, "$1"), 320);
}

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

function sanitizeVariantOpeningStyles(raw, variantCount = 1, fallbackOpeningStyle = 0, variantStylePresets = [], fallbackStylePreset = "balanced") {
  const count = Math.max(1, Math.min(5, Number(variantCount) || 1));
  const fallback = clipInt(
    videoStylePresetToOpeningStyle(
      coerceVideoStylePresetForPlan(fallbackStylePreset || videoOpeningStyleToPreset(fallbackOpeningStyle), true, "balanced"),
      fallbackOpeningStyle
    ),
    0,
    4,
    0
  );
  const cleaned = Array.isArray(raw)
    ? raw
      .map((item) => clipInt(item, 0, 4, fallback))
      .slice(0, count)
    : [];

  const stylePresetHints = Array.isArray(variantStylePresets)
    ? variantStylePresets.map((preset, index) => {
      const normalizedPreset = normalizeVideoStylePreset(preset, "");
      if (!normalizedPreset) return null;
      return clipInt(videoStylePresetToOpeningStyle(normalizedPreset, cleaned[index] ?? fallback), 0, 4, fallback);
    })
    : [];

  if (!cleaned.length) {
    if (stylePresetHints.length) {
      const next = [];
      for (let index = 0; index < count; index += 1) {
        const hinted = stylePresetHints[index];
        next.push(Number.isFinite(Number(hinted)) ? hinted : (stylePresetHints[0] ?? fallback));
      }
      return next;
    }
    return [fallback];
  }

  for (let index = 0; index < cleaned.length; index += 1) {
    if (Number.isFinite(Number(stylePresetHints[index]))) {
      cleaned[index] = stylePresetHints[index];
    }
  }

  const next = [];
  for (let index = 0; index < count; index += 1) {
    next.push(Number.isFinite(Number(cleaned[index])) ? cleaned[index] : cleaned[0]);
  }
  return next;
}

function sanitizePreviousResult(raw = {}) {
  if (!raw || typeof raw !== "object") return null;
  const variantGroupId = compact(raw.variantGroupId, 120);
  const variantStyleLabel = compact(raw.variantStyleLabel, 80);
  const variantIndex = Number.isFinite(Number(raw.variantIndex)) && Number(raw.variantIndex) >= 0
    ? Math.floor(Number(raw.variantIndex))
    : null;
  const openingStyle = Number.isFinite(Number(raw.openingStyle))
    ? clipInt(raw.openingStyle, 0, 4, 0)
    : null;

  if (!variantGroupId && !variantStyleLabel && variantIndex === null && openingStyle === null) {
    return null;
  }

  return {
    variantGroupId,
    variantStyleLabel,
    ...(variantIndex === null ? {} : { variantIndex }),
    ...(openingStyle === null ? {} : { openingStyle })
  };
}

export function getVideoVariantStyleLabel(openingStyle = 0, lang = "vi") {
  const langKey = getLangKey(lang);
  const labels = OPENING_STYLE_SHORT_LABELS[langKey] || OPENING_STYLE_SHORT_LABELS.vi;
  return labels[clipInt(openingStyle, 0, 4, 0)] || labels[0];
}

function sanitizeDurationPreset(value) {
  const allowed = [15, 30, 45, 60, 90];
  const next = Number(value);
  return allowed.includes(next) ? next : 45;
}

function getTargetSceneCountByDuration(durationSec = 45) {
  const duration = sanitizeDurationPreset(durationSec);
  if (duration <= 15) return 3;
  if (duration <= 30) return 4;
  if (duration <= 45) return 5;
  return 6;
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

function extractResponsesOutputText(response = null) {
  if (!response || typeof response !== "object") return "";

  const output = Array.isArray(response.output) ? response.output : [];
  const parts = [];

  for (const item of output) {
    if (!item || item.type !== "message") continue;
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) {
      if (!part || part.type !== "output_text") continue;
      const text = String(part.text || "");
      if (text) parts.push(text);
    }
  }

  const fallbackText = String(response.output_text || "");
  const merged = [...parts, fallbackText].filter(Boolean).join("\n").trim();
  return merged;
}

function parseSseOutputText(rawSseText = "") {
  const source = String(rawSseText || "");
  if (!source || !source.includes("event:")) return "";

  let currentEvent = "";
  let collected = "";
  const lines = source.split(/\r?\n/);

  for (const line of lines) {
    const text = String(line || "");
    if (!text) continue;

    if (text.startsWith("event:")) {
      currentEvent = text.slice(6).trim();
      continue;
    }

    if (!text.startsWith("data:")) continue;
    const payload = text.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;

    let parsed = null;
    try {
      parsed = JSON.parse(payload);
    } catch {
      continue;
    }

    const eventType = String(parsed?.type || currentEvent || "").trim();
    if (eventType === "response.output_text.delta") {
      collected += String(parsed?.delta || "");
      continue;
    }

    if (eventType === "response.output_text.done" && !collected) {
      collected = String(parsed?.text || "");
    }
  }

  return String(collected || "").trim();
}

function buildModelCandidates(preferredModel = "") {
  const candidates = [
    String(preferredModel || "").trim(),
    "cx/gpt-5.1",
    "cx/gpt-5.1-codex",
    "cx/gpt-5.1-codex-max",
    "cx/gpt-5.1-codex-mini-high",
    "kr/claude-sonnet-4.5",
    "kr/claude-haiku-4.5"
  ].filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const model of candidates) {
    const key = String(model).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(model);
  }
  return unique;
}

async function requestScriptJsonViaResponses({ endpoint, headers = {}, model = "", prompt = "" } = {}) {
  const body = {
    model,
    store: false,
    stream: true,
    instructions: "You are a practical ecommerce video review writer. Return valid JSON only.",
    input: [{
      role: "user",
      content: [{
        type: "input_text",
        text: prompt
      }]
    }]
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(body)
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`responses_http_${response.status}`);
  }

  let parsedResponse = null;
  if (/^\s*\{/.test(text)) {
    try {
      parsedResponse = JSON.parse(text);
    } catch {
      parsedResponse = null;
    }
  }

  const outputText = extractResponsesOutputText(parsedResponse) || parseSseOutputText(text);
  const parsed = parseJsonObject(outputText);
  if (parsed && typeof parsed === "object") {
    return parsed;
  }

  throw new Error("responses_empty_output");
}

async function requestScriptJsonViaChat({ endpoint, headers = {}, model = "", prompt = "" } = {}) {
  const body = {
    model,
    messages: [{ role: "user", content: [{ type: "text", text: prompt }] }],
    stream: false,
    response_format: { type: "json_object" }
  };

  const result = await postJson(endpoint, body, headers);
  const raw = result.choices?.[0]?.message?.content;
  const parsed = parseJsonObject(extractMessageText(raw));
  if (parsed && typeof parsed === "object") {
    return parsed;
  }

  throw new Error("chat_empty_output");
}

async function requestScriptJsonBestEffort({
  apiBase = "",
  headers = {},
  modelCandidates = [],
  prompt = ""
} = {}) {
  const safeBase = String(apiBase || "").replace(/\/$/, "");
  const responsesEndpoint = `${safeBase}/responses`;
  const chatEndpoint = `${safeBase}/chat/completions`;
  let lastError = null;

  for (const model of modelCandidates) {
    try {
      return await requestScriptJsonViaResponses({
        endpoint: responsesEndpoint,
        headers,
        model,
        prompt
      });
    } catch (error) {
      lastError = error;
    }

    try {
      return await requestScriptJsonViaChat({
        endpoint: chatEndpoint,
        headers,
        model,
        prompt
      });
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error("ai_script_unavailable");
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
  const openingStyle = (OPENING_STYLE[langKey] || OPENING_STYLE.vi)[clipInt(payload.openingStyle, 0, 4, 0)];
  const scriptMode = String(payload.scriptMode || "standard").toLowerCase() === "teleprompter" ? "teleprompter" : "standard";
  const teleprompterRule = langKey === "en"
    ? "- Script mode teleprompter: each voice line should be 8-12 words, easy to read in one breath."
    : "- Chế độ teleprompter: mỗi dòng thoại dài 8-12 từ, đọc một hơi là xong.";
  const highlights = (payload.highlights || []).join(", ");
  const categoryDirective = CATEGORY_VIDEO_DIRECTIVES[payload.category]?.[langKey] || CATEGORY_VIDEO_DIRECTIVES.other[langKey];
  const moodRules = (VIDEO_MOOD_ENFORCEMENT[langKey] || VIDEO_MOOD_ENFORCEMENT.vi)[payload.mood] || [];
  const moodRuleBlock = moodRules.length
    ? moodRules.map((rule) => `- ${rule}`).join("\n")
    : (langKey === "en" ? "- Keep mood-consistent language and pacing." : "- Giữ ngôn ngữ và nhịp câu nhất quán theo mood.");

  const qualityBlock = langKey === "en"
    ? [
        "- Scene 1: create immediate context + pain right at the opening.",
        "- Scene 2-3: each scene must add NEW value (feature -> practical outcome -> evidence).",
        "- Include one concrete proof marker (timeframe, behavior change, measurable feeling).",
        "- Keep spoken voice natural, no hard-sell shouting, no generic filler.",
        "- CTA should be soft but action-oriented (comment, DM, save, check link)."
      ].join("\n")
    : [
      "- Cảnh 1: vào bối cảnh + nỗi đau ngay phần mở đầu.",
      "- Cảnh 2-3: mỗi cảnh phải thêm giá trị MỚI (tính năng -> kết quả thực tế -> bằng chứng).",
      "- Luôn có ít nhất 1 dấu hiệu bằng chứng cụ thể (mốc thời gian, thay đổi hành vi, cảm nhận đo được).",
      "- Lời thoại tự nhiên, không gào bán hàng, không filler rỗng.",
      "- Giọng điệu gần gũi như người Việt nói chuyện hằng ngày, đời thường, dễ nghe, không cứng văn viết.",
      "- CTA mềm nhưng có hướng hành động (comment, inbox, lưu video, xem link)."
    ].join("\n");

  const targetSceneCount = getTargetSceneCountByDuration(payload.durationSec);

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
- Target scene count: ${targetSceneCount}
- Content mood: ${payload.mood || "dynamic"}

Mood enforcement:
${moodRuleBlock}

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
- Dùng giọng văn nói tự nhiên như người Việt giao tiếp hằng ngày; tránh văn máy móc, quá khuôn mẫu hoặc quá sách vở.
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
- Số cảnh mục tiêu: ${targetSceneCount}
- Mood nội dung: ${payload.mood || "năng động"}

Quy tắc bắt buộc theo mood:
${moodRuleBlock}

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
  const targetSceneCount = getTargetSceneCountByDuration(payload.durationSec);
  const productName = compact(payload.productName, 120) || (isVi ? "Sản phẩm" : "Product");
  const langKey = isVi ? "vi" : "en";
  const pack = FALLBACK_VOICE_PACK[langKey] || FALLBACK_VOICE_PACK.vi;
  const styleIndex = clipInt(payload.openingStyle, 0, 4, 0);
  const stylePack = FALLBACK_STYLE_PACK[langKey]?.[styleIndex] || null;
  const seedBase = String(payload.productName || payload.category || "product").length
    + Number(payload.openingStyle || 0) * 13
    + Number(payload.channel || 0) * 7
    + Number(payload.durationSec || 0);

  const highlightSeed = Array.isArray(payload.highlights) && payload.highlights.length
    ? String(payload.highlights[0] || "")
    : "";

  const tokenValues = {
    productName,
    targetCustomer: payload.targetCustomer || (isVi ? "người dùng bận rộn" : "busy daily users"),
    highlight: highlightSeed || (isVi ? "độ tiện khi dùng" : "practical everyday convenience"),
    painPoint: payload.painPoint || (isVi ? "mất thời gian thao tác" : "wasting time on repeated friction"),
    proofPoint: payload.proofPoint || (isVi ? "dùng vài ngày thấy hiệu quả ổn hơn" : "after a few days, usage felt noticeably better")
  };

  const styleOrBase = (key) => {
    const styleList = Array.isArray(stylePack?.[key]) ? stylePack[key] : [];
    if (styleList.length) return styleList;
    const baseList = Array.isArray(pack?.[key]) ? pack[key] : [];
    return baseList;
  };

  const hook = removeTimeMentions(fillTemplateTokens(pickBySeed(styleOrBase("hooks"), seedBase + 1, ""), tokenValues));
  const scene1Voice = removeTimeMentions(fillTemplateTokens(pickBySeed(styleOrBase("scene1"), seedBase + 2, ""), tokenValues));
  const scene2Voice = removeTimeMentions(fillTemplateTokens(pickBySeed(styleOrBase("scene2"), seedBase + 3, ""), tokenValues));
  const scene3Voice = removeTimeMentions(fillTemplateTokens(pickBySeed(styleOrBase("scene3"), seedBase + 4, ""), tokenValues));
  const cta = removeTimeMentions(fillTemplateTokens(pickBySeed(styleOrBase("ctas"), seedBase + 5, ""), tokenValues));

  const scene1Visual = removeTimeMentions(pickBySeed(styleOrBase("visuals1"), seedBase + 6, isVi ? "Toàn cảnh sản phẩm + thao tác thực tế" : "Wide context + practical hand action"));
  const scene2Visual = removeTimeMentions(pickBySeed(styleOrBase("visuals2"), seedBase + 7, isVi ? "Cận chi tiết + overlay lợi ích" : "Close detail + key benefit overlay"));
  const scene3Visual = removeTimeMentions(pickBySeed(styleOrBase("visuals3"), seedBase + 8, isVi ? "Overlay nhóm phù hợp + lợi ích chính" : "Target-fit overlay + key benefit"));

  const shotList = [
    pickBySeed(styleOrBase("shot1"), seedBase + 9, isVi ? "Hook 0-3s" : "Hook 0-3s"),
    pickBySeed(styleOrBase("shot2"), seedBase + 10, isVi ? "Close-up detail" : "Close-up detail"),
    pickBySeed(styleOrBase("shot3"), seedBase + 11, isVi ? "Proof moment" : "Proof moment"),
    pickBySeed(styleOrBase("shot4"), seedBase + 12, isVi ? "Soft CTA end" : "Soft CTA end")
  ].map((item) => removeTimeMentions(item)).map((item) => compact(item, 120)).filter(Boolean);

  const baseScenes = isVi
    ? [
        { label: "Cảnh 1", voice: compact(scene1Voice, 260), visual: compact(scene1Visual, 180) },
        { label: "Cảnh 2", voice: compact(scene2Voice, 260), visual: compact(scene2Visual, 180) },
        { label: "Cảnh 3", voice: compact(scene3Voice, 260), visual: compact(scene3Visual, 180) }
      ]
    : [
        { label: "Scene 1", voice: compact(scene1Voice, 260), visual: compact(scene1Visual, 180) },
        { label: "Scene 2", voice: compact(scene2Voice, 260), visual: compact(scene2Visual, 180) },
        { label: "Scene 3", voice: compact(scene3Voice, 260), visual: compact(scene3Visual, 180) }
      ];

  const scenes = [];
  for (let index = 0; index < targetSceneCount; index += 1) {
    const sourceScene = baseScenes[index % baseScenes.length] || baseScenes[baseScenes.length - 1];
    const sceneLabel = isVi ? `Cảnh ${index + 1}` : `Scene ${index + 1}`;
    scenes.push({
      label: sceneLabel,
      voice: compact(sourceScene?.voice || "", 260),
      visual: compact(sourceScene?.visual || "", 180)
    });
  }

  const normalizedShotList = Array.isArray(shotList) ? shotList : [];
  const shotListTarget = Math.min(8, targetSceneCount + 2);
  const expandedShotList = [];
  for (let index = 0; index < shotListTarget; index += 1) {
    const sourceShot = normalizedShotList[index % normalizedShotList.length] || (isVi ? "Checklist quay" : "Shot checklist");
    expandedShotList.push(compact(sourceShot, 120));
  }

  return {
    title: isVi ? `Kịch bản review nhanh cho ${productName}` : `Quick review script for ${productName}`,
    hook: compact(hook, 180) || (isVi
      ? `Nếu bạn đang phân vân về ${productName}, xem bản trải nghiệm thật này.`
      : `If you are unsure about ${productName}, check this real-use take.`),
    scenes,
    cta: compact(cta, 180) || (isVi ? "Comment 'review' để mình gửi bản phù hợp nhất cho bạn." : "Comment 'review' and I will send the best-fit version for you."),
    hashtags: isVi ? ["#review", "#TikTokShop", "#Shopee", "#goiysanpham"] : ["#review", "#TikTokShop", "#Shopee", "#productfind"],
    shotList: expandedShotList,
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
  const targetSceneCount = getTargetSceneCountByDuration(payload.durationSec);

  const scenesRaw = Array.isArray(parsed.scenes) ? parsed.scenes : [];
  const scenes = scenesRaw
    .map((item, index) => ({
      label: compact(item?.label, 36) || (isVi ? `Cảnh ${index + 1}` : `Scene ${index + 1}`),
      voice: compact(item?.voice, 260),
      visual: compact(item?.visual, 180)
    }))
    .filter((scene) => scene.voice || scene.visual)
    .slice(0, targetSceneCount);

  const hashtags = normalizeVideoHashtags(parsed.hashtags, payload, getLangKey(payload.lang));

  const shotList = normalizeSegment(parsed.shotList, Math.min(8, targetSceneCount + 2));
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

function hasPriceMention(text = "") {
  const source = String(text || "").toLowerCase();
  if (!source) return false;
  return /(gia|muc\s*gia|ph[aâ]n\s*khuc|price|budget|premium|mid-range|\d+[\s,\.]*\d*\s*(k|tr|tri[eệ]u|vnd|đ|dong|usd|\$|eur)|tra\s*sua|ly\s*tra\s*sua)/i.test(source);
}

function normalizePriceSegmentHint(priceSegment = "", langKey = "vi") {
  const raw = compact(priceSegment, 60);
  if (!raw) return "";
  const key = raw.toLowerCase();
  if (langKey !== "vi") {
    if (key === "low") return "budget-friendly";
    if (key === "mid") return "mid-range";
    if (key === "high") return "premium";
    return raw;
  }

  if (key === "low") return "tầm dễ chốt";
  if (key === "mid") return "tầm trung";
  if (key === "high") return "phân khúc cao";
  return raw;
}

function buildPlayfulPriceHint(payload = {}, langKey = "vi") {
  const hint = normalizePriceSegmentHint(payload?.priceSegment || "", langKey);
  if (!hint) return "";
  if (langKey !== "vi") {
    return `Price vibe: around ${hint}, easy to justify for everyday use.`;
  }

  if (/(\d|k|tr|tri[eệ]u|vnd|đ)/i.test(hint)) {
    return `Giá tầm ${hint}, nghe một con số là chốt lý do mua luôn.`;
  }
  if (/de\s*chot|budget|thap/.test(hint)) {
    return "Giá kiểu dễ chốt, giống vài ly trà sữa là có món mới xài ngay.";
  }
  if (/cao|premium/.test(hint)) {
    return "Giá nhỉnh hơn nhưng lên trải nghiệm thấy ra tiền, không phí vibe.";
  }
  return `Giá vibe ${hint}, đủ hợp túi tiền để cân nhắc chốt nhanh.`;
}

function injectPriceHintToVideoResult(result = {}, payload = {}) {
  const langKey = getLangKey(payload?.lang);
  if (!payload?.priceSegment) return result;

  const scenes = Array.isArray(result?.scenes) ? [...result.scenes] : [];
  if (!scenes.length) return result;

  const alreadyMentioned = hasPriceMention(`${result?.hook || ""}\n${scenes.map((scene) => scene?.voice || "").join("\n")}\n${result?.cta || ""}`);
  if (alreadyMentioned) return result;

  const priceHint = buildPlayfulPriceHint(payload, langKey);
  if (!priceHint) return result;

  const targetIndex = Math.max(0, scenes.length - 1);
  const targetScene = scenes[targetIndex] || {};
  scenes[targetIndex] = {
    ...targetScene,
    voice: compact([targetScene?.voice || "", priceHint].filter(Boolean).join(" "), 260)
  };

  return {
    ...result,
    scenes
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
  const openingStyle = clipInt(raw.openingStyle, 0, 4, 0);
  const channel = clipInt(raw.channel, 0, 2, 0);
  const scriptMode = String(raw.scriptMode || "standard").toLowerCase() === "teleprompter" ? "teleprompter" : "standard";
  const stylePreset = coerceVideoStylePresetForPlan(
    normalizeVideoStylePreset(raw.stylePreset || "", videoOpeningStyleToPreset(openingStyle)),
    true,
    videoOpeningStyleToPreset(openingStyle)
  );
  const improved = Boolean(raw.improved);
  const variantCountRaw = clipInt(raw.variantCount, 1, 5, 1);
  const variantCount = improved ? 1 : variantCountRaw;
  const variantStylePresets = Array.isArray(raw.variantStylePresets)
    ? raw.variantStylePresets
        .map((item) => coerceVideoStylePresetForPlan(normalizeVideoStylePreset(item, stylePreset), true, stylePreset))
        .slice(0, variantCount)
    : [stylePreset];
  const variantOpeningStyles = sanitizeVariantOpeningStyles(
    raw.variantOpeningStyles,
    variantCount,
    openingStyle,
    variantStylePresets,
    stylePreset
  );
  const previousResult = improved ? sanitizePreviousResult(raw.previousResult) : null;

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
    stylePreset,
    channel,
    scriptMode,
    variantCount,
    variantStylePresets,
    variantOpeningStyles,
    improved,
    previousResult
  };
}

export async function generateVideoReviewScript(rawPayload = {}) {
  const payload = normalizeVideoScriptPayload(rawPayload);
  const requestedVariantCount = Math.max(1, Math.min(5, Number(payload.variantCount || 1)));
  const variantStylePresets = Array.isArray(payload.variantStylePresets) && payload.variantStylePresets.length
    ? payload.variantStylePresets
    : [payload.stylePreset || videoOpeningStyleToPreset(payload.openingStyle)];
  const variantOpeningStyles = sanitizeVariantOpeningStyles(
    payload.variantOpeningStyles,
    requestedVariantCount,
    payload.openingStyle,
    variantStylePresets,
    payload.stylePreset
  );
  const resolvedVariantStylePresets = [];
  for (let index = 0; index < requestedVariantCount; index += 1) {
    const fallbackPreset = videoOpeningStyleToPreset(variantOpeningStyles[index] ?? payload.openingStyle);
    const requestedPreset = variantStylePresets[index] || variantStylePresets[0] || payload.stylePreset;
    resolvedVariantStylePresets.push(
      coerceVideoStylePresetForPlan(
        normalizeVideoStylePreset(requestedPreset, fallbackPreset),
        true,
        fallbackPreset
      )
    );
  }
  const styleLabels = resolvedVariantStylePresets.map((stylePreset) => getVideoStylePresetLabel(stylePreset, payload.lang));
  const apiBase = process.env.AI_API_BASE;
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_MODEL || "cx/gpt-5.1";
  const modelCandidates = buildModelCandidates(model);

  if (!apiBase || !apiKey) {
    const fallbackVariants = variantOpeningStyles.map((openingStyle, index) => {
      const stylePreset = resolvedVariantStylePresets[index] || videoOpeningStyleToPreset(openingStyle);
      const fallbackPayload = { ...payload, openingStyle, stylePreset, improved: false, previousResult: null };
      const script = buildFallback(fallbackPayload);
      const scriptWithPrice = injectPriceHintToVideoResult(script, fallbackPayload);
      return {
        ...scriptWithPrice,
        openingStyle,
        stylePreset,
        variantStylePreset: stylePreset,
        styleKey: stylePreset,
        styleLabel: styleLabels[index] || getVideoStylePresetLabel(stylePreset, payload.lang),
        variantStyleLabel: styleLabels[index] || getVideoStylePresetLabel(stylePreset, payload.lang)
      };
    });
    const fallbackPrimary = fallbackVariants[0] || buildFallback(payload);
    return {
      ...fallbackPrimary,
      variants: fallbackVariants.length ? fallbackVariants : [fallbackPrimary],
      selectedVariant: 0,
      variantStyleLabel: fallbackPrimary.variantStyleLabel || getVideoStylePresetLabel(payload.stylePreset || videoOpeningStyleToPreset(payload.openingStyle), payload.lang)
    };
  }

  const headers = { Authorization: `Bearer ${apiKey}` };
  if (/openrouter\.ai/i.test(apiBase)) {
    if (process.env.PUBLIC_BASE_URL) headers["HTTP-Referer"] = process.env.PUBLIC_BASE_URL;
    headers["X-Title"] = "gen-script-video-review";
  }
  const variants = [];

  for (let index = 0; index < requestedVariantCount; index += 1) {
    const openingStyle = variantOpeningStyles[index] ?? variantOpeningStyles[0] ?? payload.openingStyle;
    const stylePreset = resolvedVariantStylePresets[index] || videoOpeningStyleToPreset(openingStyle);
    const styleLabel = styleLabels[index] || getVideoStylePresetLabel(stylePreset, payload.lang);

    try {
      const variantPayload = {
        ...payload,
        openingStyle,
        stylePreset,
        improved: index === 0 ? payload.improved : false,
        previousResult: index === 0 ? payload.previousResult : null
      };
      const prompt = buildPrompt(variantPayload);

      trackAiUsageEvent({ type: "generate_request" });
      const parsed = await requestScriptJsonBestEffort({
        apiBase,
        headers,
        modelCandidates,
        prompt
      });
      const normalized = parsed && typeof parsed === "object"
        ? normalizeResult(variantPayload, parsed)
        : buildFallback(variantPayload);
      const normalizedWithPrice = injectPriceHintToVideoResult(normalized, variantPayload);

      variants.push({
        ...normalizedWithPrice,
        openingStyle,
        stylePreset,
        variantStylePreset: stylePreset,
        styleKey: stylePreset,
        styleLabel,
        variantStyleLabel: styleLabel
      });
    } catch {
      trackAiUsageEvent({ type: "generate_fallback" });
      const fallbackPayload = { ...payload, openingStyle, improved: false, previousResult: null };
      const fallback = buildFallback(fallbackPayload);
      const fallbackWithPrice = injectPriceHintToVideoResult(fallback, fallbackPayload);
      variants.push({
        ...fallbackWithPrice,
        openingStyle,
        stylePreset,
        variantStylePreset: stylePreset,
        styleKey: stylePreset,
        styleLabel,
        variantStyleLabel: styleLabel
      });
    }
  }

  const safeFallback = injectPriceHintToVideoResult(buildFallback(payload), payload);
  const safeVariants = variants.length ? variants : [{
    ...safeFallback,
    openingStyle: variantOpeningStyles[0] ?? payload.openingStyle,
    stylePreset: resolvedVariantStylePresets[0] || payload.stylePreset || videoOpeningStyleToPreset(variantOpeningStyles[0] ?? payload.openingStyle),
    variantStylePreset: resolvedVariantStylePresets[0] || payload.stylePreset || videoOpeningStyleToPreset(variantOpeningStyles[0] ?? payload.openingStyle),
    styleKey: resolvedVariantStylePresets[0] || payload.stylePreset || videoOpeningStyleToPreset(variantOpeningStyles[0] ?? payload.openingStyle),
    styleLabel: getVideoStylePresetLabel(resolvedVariantStylePresets[0] || payload.stylePreset || videoOpeningStyleToPreset(variantOpeningStyles[0] ?? payload.openingStyle), payload.lang),
    variantStyleLabel: getVideoStylePresetLabel(resolvedVariantStylePresets[0] || payload.stylePreset || videoOpeningStyleToPreset(variantOpeningStyles[0] ?? payload.openingStyle), payload.lang)
  }];

  let selectedVariant = 0;
  let bestScore = Number(safeVariants[0]?.quality?.score || 0);
  for (let index = 1; index < safeVariants.length; index += 1) {
    const score = Number(safeVariants[index]?.quality?.score || 0);
    if (score > bestScore) {
      bestScore = score;
      selectedVariant = index;
    }
  }

  const primary = safeVariants[selectedVariant] || safeVariants[0];
  trackAiUsageEvent({ type: "generate_success" });
  return {
    ...primary,
    variants: safeVariants,
    selectedVariant,
    variantStyleLabel: primary?.variantStyleLabel || getVideoStylePresetLabel(primary?.stylePreset || payload.stylePreset || videoOpeningStyleToPreset(primary?.openingStyle ?? payload.openingStyle), payload.lang)
  };
}
