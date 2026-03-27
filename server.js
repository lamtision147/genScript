const http = require("http");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const nodemailer = require("nodemailer");

const PORT = Number(process.env.PORT || 4174);
const ROOT = __dirname;
const HISTORY_FILE = path.join(ROOT, "history-store.json");
const USERS_FILE = path.join(ROOT, "users-store.json");

const sessions = new Map();
const otpStore = new Map();
const oauthStateStore = new Map();
const passwordResetStore = new Map();

let mailTransport = null;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8"
};

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": MIME_TYPES[".json"] });
  response.end(JSON.stringify(payload));
}

function sendJsonWithHeaders(response, statusCode, payload, headers = {}) {
  response.writeHead(statusCode, { "Content-Type": MIME_TYPES[".json"], ...headers });
  response.end(JSON.stringify(payload));
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";
    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(new Error("Payload too large"));
        request.destroy();
      }
    });
    request.on("end", () => resolve(data));
    request.on("error", reject);
  });
}

function readHistoryStore() {
  try {
    if (!fs.existsSync(HISTORY_FILE)) return [];
    const raw = fs.readFileSync(HISTORY_FILE, "utf8");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function writeHistoryStore(items) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(items, null, 2), "utf8");
}

function readUsersStore() {
  try {
    if (!fs.existsSync(USERS_FILE)) return [];
    const raw = fs.readFileSync(USERS_FILE, "utf8");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_error) {
    return [];
  }
}

function writeUsersStore(items) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(items, null, 2), "utf8");
}

function parseCookies(request) {
  const raw = request.headers.cookie || "";
  return raw.split(";").reduce((acc, item) => {
    const [key, ...rest] = item.trim().split("=");
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join("="));
    return acc;
  }, {});
}

function getMailTransport() {
  if (mailTransport) return mailTransport;
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }

  mailTransport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  return mailTransport;
}

async function sendOtpEmail(email, code) {
  const transport = getMailTransport();
  if (!transport) return false;

  await transport.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: "Seller Studio - Ma OTP dang nhap",
    text: `Seller Studio\n\nMa OTP dang nhap cua ban la: ${code}\nMa co hieu luc trong 10 phut. Neu ban khong yeu cau dang nhap, vui long bo qua email nay.`,
    html: `
      <div style="font-family:Arial,sans-serif;background:#f7f4ee;padding:32px;color:#171411">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #eadfce;border-radius:18px;padding:28px">
          <div style="font-size:12px;letter-spacing:1.4px;text-transform:uppercase;color:#c95d06;font-weight:700">Seller Studio</div>
          <h2 style="margin:10px 0 8px;font-size:28px;line-height:1.1">Ma OTP dang nhap</h2>
          <p style="margin:0 0 18px;color:#6d645b;line-height:1.6">Su dung ma ben duoi de dang nhap vao Seller Studio. Ma co hieu luc trong 10 phut.</p>
          <div style="font-size:32px;font-weight:800;letter-spacing:6px;padding:18px 20px;border-radius:16px;background:#fff4e8;border:1px solid #f2d0ab;text-align:center">${code}</div>
          <p style="margin:18px 0 0;color:#6d645b;line-height:1.6">Neu ban khong yeu cau dang nhap, vui long bo qua email nay.</p>
        </div>
      </div>`
  });

  return true;
}

function getCurrentUser(request) {
  const cookies = parseCookies(request);
  const sessionId = cookies.session_id;
  if (!sessionId) return null;
  const userId = sessions.get(sessionId);
  if (!userId) return null;
  return readUsersStore().find((user) => user.id === userId) || null;
}

function hashPassword(password) {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function getPublicBaseUrl(request) {
  return process.env.PUBLIC_BASE_URL || `${request.headers["x-forwarded-proto"] || "http"}://${request.headers.host}`;
}

function getJson(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === "http:" ? http : https;
    const request = transport.request(
      {
        method: "GET",
        hostname: target.hostname,
        port: target.port || (target.protocol === "http:" ? 80 : 443),
        path: `${target.pathname}${target.search}`,
        headers
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (response.statusCode >= 400) {
              reject(new Error(parsed.error_description || parsed.error?.message || parsed.error || `HTTP ${response.statusCode}`));
              return;
            }
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      }
    );
    request.on("error", reject);
    request.end();
  });
}

function getTextSet(lang) {
  if (lang === "en") {
    return {
      channels: ["TikTok", "Shopee", "Both"],
      tones: ["Natural review", "Expert", "Hard sell"],
      attrTypes: ["Ingredients", "Size", "Use Case", "Material", "Advantage"],
      metaFirst: "First product description draft",
      metaImprove: "Improved expert-style version",
      metaClose: "Conversion-focused product version"
    };
  }

  return {
    channels: ["TikTok", "Shopee", "Cả 2"],
    tones: ["Review tự nhiên", "Chuyên gia", "Chốt sale mạnh"],
      attrTypes: ["Thành phần", "Kích thước", "Công dụng", "Chất liệu", "Ưu điểm"],
      metaFirst: "Bản mô tả sản phẩm đầu tiên",
      metaImprove: "Bản cải tiến theo phong cách chuyên gia",
      metaClose: "Bản tối ưu chuyển đổi cho sản phẩm"
    };
  }

function getLangKey(lang) {
  return lang === "en" ? "en" : "vi";
}

const categoryConfigs = {
  skincare: {
    vi: {
      subcategories: ["Serum", "Kem dưỡng", "Toner", "Sữa rửa mặt", "Chống nắng"],
      angle: "thành phần, kết cấu và cảm giác trên da",
      buyerFocus: "độ dịu nhẹ, cảm giác dùng hằng ngày và hiệu quả dễ cảm nhận",
      hook: "gây thiện cảm ngay từ 3 giây đầu bằng cảm giác sang da, mướt da và dễ đưa vào routine",
      proof: "nói rõ thành phần, kết cấu và cảm giác sau khi dùng để tạo niềm tin",
      close: "cảm giác chăm da chỉn chu, dễ dùng hằng ngày và phù hợp nhiều loại da"
    },
    en: {
      subcategories: ["Serum", "Moisturizer", "Toner", "Cleanser", "Sunscreen"],
      angle: "ingredients, texture, and skin feel",
      buyerFocus: "gentleness, daily use, and easy-to-feel results",
      hook: "open with a quick skin-feel payoff that sounds instantly relatable",
      proof: "explain ingredients, texture, and after-use feeling to build trust",
      close: "a polished daily-care feel, easy routine fit, and broad skin compatibility"
    }
  },
  fashion: {
    vi: {
      subcategories: ["Đồ ngủ", "Áo thun", "Quần short", "Đồ mặc nhà", "Streetwear"],
      angle: "chất liệu, form dáng và khả năng phối đồ",
      buyerFocus: "độ tôn dáng, độ thoải mái và tính linh hoạt khi mặc",
      hook: "đánh vào cảm giác mặc đẹp, mặc mát và lên dáng gọn gàng ngay từ câu đầu",
      proof: "nhấn chất vải, độ rũ, độ thoải mái và cách phối đồ thực tế",
      close: "cảm giác mặc thoải mái, lên dáng gọn và dễ ứng dụng trong nhiều hoàn cảnh"
    },
    en: {
      subcategories: ["Sleepwear", "T-shirt", "Shorts", "Loungewear", "Streetwear"],
      angle: "fabric, fit, and styling versatility",
      buyerFocus: "shape, comfort, and outfit flexibility",
      hook: "lead with how good it feels and how easy it looks on body",
      proof: "highlight fabric feel, drape, comfort, and real styling use",
      close: "comfort, easy styling, and a polished everyday look"
    }
  },
  home: {
    vi: {
      subcategories: ["Nhà bếp", "Phòng ngủ", "Lưu trữ", "Dọn dẹp", "Trang trí"],
      angle: "công năng, độ tiện lợi và độ bền sử dụng",
      buyerFocus: "tiết kiệm thời gian, dễ dùng và hợp không gian sống",
      hook: "mở bằng nỗi đau hằng ngày và cảm giác tiện hơn rõ rệt khi có sản phẩm",
      proof: "đi vào công năng thực tế, độ bền và điểm tiện trong quá trình sử dụng",
      close: "giá trị sử dụng bền, tiện và thực sự đáng đầu tư cho nhịp sống hằng ngày"
    },
    en: {
      subcategories: ["Kitchen", "Bedroom", "Storage", "Cleaning", "Decor"],
      angle: "function, convenience, and durability",
      buyerFocus: "time-saving use, simplicity, and fit for daily living",
      hook: "open with the everyday pain point it solves",
      proof: "show practical function, durability, and ease of use",
      close: "reliable everyday value, ease, and long-term usefulness"
    }
  },
  food: {
    vi: {
      subcategories: ["Ăn vặt", "Healthy", "Đồ uống", "Thực phẩm tiện lợi", "Quà tặng"],
      angle: "hương vị, thành phần và trải nghiệm dùng thực tế",
      buyerFocus: "độ ngon, độ tiện và cảm giác yên tâm khi dùng",
      hook: "gợi vị ngon, cảm giác thèm và tính tiện ngay câu đầu",
      proof: "nhấn thành phần, hương vị, cách dùng và tình huống dùng thực tế",
      close: "trải nghiệm ngon, tiện và dễ dùng trong nhịp sống hằng ngày"
    },
    en: {
      subcategories: ["Snack", "Healthy", "Drink", "Convenience Food", "Giftable"],
      angle: "flavor, ingredients, and real usage experience",
      buyerFocus: "taste, convenience, and trust",
      hook: "open with appetite and convenience right away",
      proof: "focus on ingredients, taste, and realistic usage moments",
      close: "taste, convenience, and strong repeat value"
    }
  },
  momBaby: {
    vi: {
      subcategories: ["Chăm bé", "Đồ dùng ăn dặm", "Quần áo bé", "Chăm mẹ", "Đồ ngủ bé"],
      angle: "độ an toàn, độ dịu nhẹ và sự tiện cho mẹ",
      buyerFocus: "an tâm sử dụng, phù hợp độ tuổi và sự thoải mái cho bé",
      hook: "mở bằng yếu tố an tâm và dễ dùng cho mẹ",
      proof: "đi sâu vào độ an toàn, độ mềm, độ phù hợp theo độ tuổi hoặc tình huống dùng",
      close: "cảm giác an tâm, dịu nhẹ và thuận tiện trong quá trình chăm sóc"
    },
    en: {
      subcategories: ["Baby Care", "Feeding", "Baby Wear", "Mom Care", "Baby Sleep"],
      angle: "safety, softness, and convenience for parents",
      buyerFocus: "trust, age fit, and baby comfort",
      hook: "lead with parent trust and ease of use",
      proof: "highlight safety, softness, and age suitability",
      close: "trust, softness, and practical everyday reassurance"
    }
  },
  electronics: {
    vi: {
      subcategories: ["Tai nghe", "Sạc", "Phụ kiện điện thoại", "Thiết bị bàn làm việc", "Đồ thông minh"],
      angle: "tính năng, hiệu năng và trải nghiệm sử dụng",
      buyerFocus: "độ ổn định, tiện lợi và giá trị dùng thực tế",
      hook: "mở bằng tính năng nổi bật hoặc vấn đề sản phẩm giải quyết ngay lập tức",
      proof: "đi vào thông số, trải nghiệm dùng và điểm tiện trong thực tế",
      close: "trải nghiệm dùng ổn định, tiện lợi và xứng đáng trong tầm giá"
    },
    en: {
      subcategories: ["Earbuds", "Charger", "Phone Accessories", "Desk Setup", "Smart Devices"],
      angle: "features, performance, and usage experience",
      buyerFocus: "reliability, convenience, and practical value",
      hook: "open with the standout feature or problem it solves instantly",
      proof: "focus on specs, usage feel, and real convenience",
      close: "reliable performance, convenience, and practical value"
    }
  },
  footwear: {
    vi: {
      subcategories: ["Sneaker", "Giày bệt", "Sandal", "Giày cao gót", "Dép"],
      angle: "form giày, độ êm chân và khả năng hoàn thiện outfit",
      buyerFocus: "độ thoải mái, độ dễ đi và tính ứng dụng hằng ngày",
      hook: "mở bằng cảm giác lên chân gọn, êm và hoàn thiện tổng thể trang phục",
      proof: "nhấn chất liệu, form đế và cảm giác mang trong nhịp di chuyển thật",
      close: "cảm giác đi êm, lên dáng gọn và dễ kết hợp trong nhiều hoàn cảnh"
    },
    en: {
      subcategories: ["Sneakers", "Flats", "Sandals", "Heels", "Slides"],
      angle: "shape, comfort, and outfit-finishing appeal",
      buyerFocus: "comfort, ease of wear, and daily versatility",
      hook: "open with how clean and comfortable the pair feels on foot",
      proof: "highlight material, sole feel, and real walking comfort",
      close: "easy comfort, clean shape, and versatile outfit pairing"
    }
  },
  bags: {
    vi: {
      subcategories: ["Túi đeo vai", "Túi tote", "Túi mini", "Ba lô", "Ví"],
      angle: "form túi, chất liệu và cảm giác hoàn thiện tổng thể trang phục",
      buyerFocus: "độ tiện dụng, độ gọn và sự chỉn chu khi mang theo",
      hook: "mở bằng dáng túi và cách món đồ hoàn thiện outfit ngay từ cái nhìn đầu tiên",
      proof: "nhấn chất liệu, kích thước, ngăn chứa và trải nghiệm mang hằng ngày",
      close: "cảm giác gọn gàng, tiện dụng và đủ tinh tế để dùng lâu dài"
    },
    en: {
      subcategories: ["Shoulder Bag", "Tote", "Mini Bag", "Backpack", "Wallet"],
      angle: "shape, material, and outfit-finishing appeal",
      buyerFocus: "practical use, compactness, and polished everyday carry",
      hook: "open with the bag shape and how it completes the look at first glance",
      proof: "focus on material, size, compartments, and daily carrying ease",
      close: "compact practicality with a polished and lasting presence"
    }
  },
  accessories: {
    vi: {
      subcategories: ["Nón", "Thắt lưng", "Khăn", "Kính", "Trang sức"],
      angle: "điểm nhấn thị giác, độ hoàn thiện và khả năng phối cùng outfit",
      buyerFocus: "tính dễ phối, độ tinh tế và khả năng nâng tổng thể trang phục",
      hook: "mở bằng cảm giác món phụ kiện giúp tổng thể trông gọn và có gu hơn",
      proof: "nhấn chất liệu, chi tiết thiết kế và hiệu quả khi phối cùng trang phục",
      close: "một điểm nhấn nhỏ nhưng đủ tạo độ hoàn thiện cho toàn bộ outfit"
    },
    en: {
      subcategories: ["Hat", "Belt", "Scarf", "Eyewear", "Jewelry"],
      angle: "visual accent, finish, and styling versatility",
      buyerFocus: "easy pairing, refinement, and outfit elevation",
      hook: "open with how the accessory sharpens the overall look",
      proof: "highlight material, design detail, and styling effect",
      close: "a subtle finishing detail that upgrades the entire outfit"
    }
  },
  fragrance: {
    vi: {
      subcategories: ["Nước hoa", "Body mist", "Tinh dầu thơm", "Nến thơm", "Xịt phòng"],
      angle: "nhóm hương, cảm xúc và ấn tượng để lại sau khi sử dụng",
      buyerFocus: "cảm giác tinh tế, dấu ấn cá nhân và độ dễ dùng hằng ngày",
      hook: "mở bằng cảm giác mùi hương tạo nên không khí hoặc dấu ấn cá nhân rõ ràng",
      proof: "nhấn nhóm hương, độ lưu lại và bối cảnh sử dụng phù hợp",
      close: "một trải nghiệm hương vừa tinh tế, vừa dễ lưu lại trong trí nhớ"
    },
    en: {
      subcategories: ["Perfume", "Body Mist", "Essential Oil", "Scented Candle", "Room Spray"],
      angle: "scent family, mood, and lingering impression",
      buyerFocus: "refinement, personal signature, and easy daily wear",
      hook: "open with the mood and signature feeling the scent creates",
      proof: "focus on scent family, staying impression, and fitting occasions",
      close: "a refined scent experience that lingers naturally in memory"
    }
  },
  pet: {
    vi: {
      subcategories: ["Đồ ăn", "Phụ kiện", "Đồ chơi", "Chăm sóc", "Đệm / ổ nằm"],
      angle: "sự an toàn, tiện lợi và cảm giác thoải mái cho thú cưng",
      buyerFocus: "độ phù hợp, sự yên tâm và trải nghiệm dùng hằng ngày",
      hook: "mở bằng cảm giác an tâm và sự dễ chịu mà sản phẩm mang lại cho thú cưng",
      proof: "nhấn độ phù hợp, chất liệu/thành phần và lợi ích thực tế khi dùng",
      close: "một lựa chọn giúp việc chăm sóc thú cưng trở nên yên tâm và nhẹ nhàng hơn"
    },
    en: {
      subcategories: ["Food", "Accessories", "Toys", "Care", "Beds"],
      angle: "safety, convenience, and comfort for pets",
      buyerFocus: "fit, reassurance, and everyday usability",
      hook: "open with comfort and reassurance for the pet owner",
      proof: "focus on fit, material/ingredients, and practical daily value",
      close: "an easy choice that supports comfort and everyday care"
    }
  },
  sports: {
    vi: {
      subcategories: ["Đồ tập", "Phụ kiện tập", "Bình nước", "Yoga", "Chạy bộ"],
      angle: "độ linh hoạt, cảm giác vận động và tính thực dụng khi sử dụng",
      buyerFocus: "sự thoải mái, độ bền và hiệu quả trong quá trình tập luyện",
      hook: "mở bằng cảm giác linh hoạt và sự sẵn sàng cho nhịp vận động",
      proof: "nhấn chất liệu/công năng/độ bền và trải nghiệm khi tập thực tế",
      close: "một lựa chọn thực dụng, bền bỉ và đồng hành tốt trong tập luyện"
    },
    en: {
      subcategories: ["Activewear", "Training Accessories", "Bottle", "Yoga", "Running"],
      angle: "mobility, performance feel, and practical use",
      buyerFocus: "comfort, durability, and workout usefulness",
      hook: "open with movement, flexibility, and readiness for action",
      proof: "highlight material/function/durability in real workout use",
      close: "a practical piece that supports movement with ease and reliability"
    }
  },
  other: {
    vi: {
      subcategories: ["Phổ thông", "Quà tặng", "Lifestyle", "Theo mùa", "Khác"],
      angle: "điểm khác biệt và lợi ích dễ hiểu",
      buyerFocus: "sự rõ ràng, ngắn gọn và dễ ra quyết định",
      hook: "mở bằng điểm đáng chú ý nhất của sản phẩm",
      proof: "giải thích lợi ích theo cách dễ hình dung và gần nhu cầu thật",
      close: "lợi ích rõ ràng, dễ hiểu và tạo cảm giác đáng cân nhắc"
    },
    en: {
      subcategories: ["General", "Gift", "Lifestyle", "Seasonal", "Other"],
      angle: "clear differentiators and easy benefits",
      buyerFocus: "clarity, simplicity, and purchase confidence",
      hook: "lead with the most immediately interesting angle",
      proof: "explain benefits in a relatable, easy-to-picture way",
      close: "clear benefits and easy purchase confidence"
    }
  }
};

function getCategoryConfig(category, lang) {
  const config = categoryConfigs[category] || categoryConfigs.other;
  const langKey = getLangKey(lang);
  return config[langKey] || config.vi;
}

function getSubcategoryLabel(category, subcategory, lang) {
  const langKey = getLangKey(lang);
  const subcategories = categoryConfigs[category]?.[langKey]?.subcategories || categoryConfigs.other[langKey].subcategories;
  return subcategories[subcategory] || subcategories[0] || (lang === "en" ? "product line" : "dòng sản phẩm");
}

function getBrandStyleGuide(lang, brandStyle) {
  const guides = {
    0: {
      vi: "giữ tinh thần tối giản, chỉn chu, hạn chế phô trương nhưng vẫn toát lên độ cao cấp",
      en: "keep the language minimal, polished, and quietly premium"
    },
    1: {
      vi: "giữ cảm giác trẻ trung, hiện đại, dễ tiếp cận nhưng vẫn gọn gàng",
      en: "keep the language modern, youthful, and approachable while still clean"
    },
    2: {
      vi: "giữ giọng văn có chiều sâu, đáng tin và mang cảm giác am hiểu sản phẩm",
      en: "use a voice that feels credible, informed, and product-aware"
    },
    3: {
      vi: "giữ giọng điệu thân thiện, dễ mua nhưng vẫn đủ chỉn chu như một thương hiệu nghiêm túc",
      en: "keep it accessible and easy to buy, but still polished and brand-safe"
    }
  };

  const langKey = getLangKey(lang);
  return guides[brandStyle]?.[langKey] || guides[0][langKey];
}

function getMoodGuide(lang, mood) {
  const guides = {
    0: {
      vi: "sang, gọn, sạch câu chữ",
      en: "clean, elevated, and restrained"
    },
    1: {
      vi: "ấm áp, dễ gần, tạo thiện cảm",
      en: "warm, approachable, and reassuring"
    },
    2: {
      vi: "năng động, bắt mắt, có sức hút",
      en: "energetic, appealing, and eye-catching"
    },
    3: {
      vi: "tự tin, thuyết phục và rõ giá trị",
      en: "confident, persuasive, and value-forward"
    }
  };

  const langKey = getLangKey(lang);
  return guides[mood]?.[langKey] || guides[0][langKey];
}

function getGoalGuide(lang) {
  const langKey = getLangKey(lang);
  const guides = {
    vi: "ưu tiên giới thiệu sản phẩm một cách chuyên nghiệp, rõ giá trị và có cảm giác thương hiệu",
    en: "prioritize professional product introduction copy with clear value and strong brand feel"
  };
  return guides[langKey];
}

function getBrandPhrase(lang, brandStyle) {
  const phrases = {
    0: {
      vi: "tinh thần tối giản và cao cấp",
      en: "with a minimal premium feel"
    },
    1: {
      vi: "cảm giác trẻ trung và hiện đại",
      en: "with a youthful modern feel"
    },
    2: {
      vi: "cảm giác đáng tin và hiểu sản phẩm",
      en: "with an informed, trustworthy feel"
    },
    3: {
      vi: "tinh thần dễ tiếp cận nhưng vẫn chỉn chu",
      en: "with an accessible but polished feel"
    }
  };

  const langKey = getLangKey(lang);
  return phrases[brandStyle]?.[langKey] || phrases[0][langKey];
}

function getMoodPhrase(lang, mood) {
  const phrases = {
    0: {
      vi: "giọng điệu gọn, sang và sạch",
      en: "a clean, elevated, restrained tone"
    },
    1: {
      vi: "giọng điệu ấm áp và dễ tạo thiện cảm",
      en: "a warm and reassuring tone"
    },
    2: {
      vi: "giọng điệu năng động và cuốn hút",
      en: "an energetic, appealing tone"
    },
    3: {
      vi: "giọng điệu tự tin và giàu sức thuyết phục",
      en: "a confident, persuasive tone"
    }
  };

  const langKey = getLangKey(lang);
  return phrases[mood]?.[langKey] || phrases[0][langKey];
}

function getTonePhrase(lang, toneKey) {
  const phrases = {
    natural: {
      vi: "gần gũi nhưng vẫn có chọn lọc",
      en: "approachable yet curated"
    },
    expert: {
      vi: "rõ ràng, chắc và có độ tin cậy cao",
      en: "clear, assured, and highly credible"
    },
    hardSell: {
      vi: "giàu sức hút và nhấn rõ giá trị mua hàng",
      en: "desirable and strongly value-led"
    }
  };

  return phrases[toneKey]?.[getLangKey(lang)] || phrases.natural[getLangKey(lang)];
}

function normalizeText(value) {
  return typeof value === "string" ? value.trim() : "";
}

function joinNatural(list, lang) {
  const items = list.filter(Boolean);
  if (!items.length) return "";
  if (items.length === 1) return items[0];
  if (items.length === 2) return lang === "en" ? `${items[0]} and ${items[1]}` : `${items[0]} và ${items[1]}`;
  const head = items.slice(0, -1).join(", ");
  const tail = items[items.length - 1];
  return lang === "en" ? `${head}, and ${tail}` : `${head}, và ${tail}`;
}

function lowerFirst(value) {
  if (!value) return value;
  return value.charAt(0).toLowerCase() + value.slice(1);
}

function formatAttributeSentence(list, lang) {
  if (!list.length) return "";
  const joined = joinNatural(list, lang);
  if (lang === "en") return `Details such as ${joined.toLowerCase()}.`;
  return `Những chi tiết như ${lowerFirst(joined)}.`;
}

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function compactSentence(value) {
  return value.replace(/\s+/g, " ").trim();
}

function ensurePeriod(value) {
  const text = compactSentence(value);
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function postJson(url, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const transport = target.protocol === "http:" ? http : https;
    const request = transport.request(
      {
        method: "POST",
        hostname: target.hostname,
        port: target.port || (target.protocol === "http:" ? 80 : 443),
        path: `${target.pathname}${target.search}`,
        headers: {
          "Content-Type": "application/json",
          ...headers
        }
      },
      (response) => {
        let data = "";
        response.on("data", (chunk) => {
          data += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (response.statusCode >= 400) {
              reject(new Error(parsed.error?.message || parsed.error || `HTTP ${response.statusCode}`));
              return;
            }
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", reject);
    request.write(JSON.stringify(body));
    request.end();
  });
}

function getToneGuide(lang, toneKey) {
  const guides = {
    natural: {
      vi: {
        intro: "giữ giọng văn gần gũi nhưng vẫn tinh gọn, có chọn lọc",
        cta: "gợi mở nhẹ nhàng, tinh tế và tạo thiện cảm"
      },
      en: {
        intro: "keep the tone approachable but still polished",
        cta: "make the close soft, tasteful, and inviting"
      }
    },
    expert: {
      vi: {
        intro: "giữ câu chữ chắc, rõ, chuẩn chỉnh và giàu tính thuyết phục",
        cta: "tạo cảm giác đáng tin, chuẩn thương hiệu và có cơ sở"
      },
      en: {
        intro: "sound informed, refined, and brand-confident",
        cta: "build trust through clear, polished reasoning"
      }
    },
    hardSell: {
      vi: {
        intro: "đẩy mạnh tính hấp dẫn và giá trị mua hàng nhưng vẫn giữ độ chuyên nghiệp",
        cta: "kêu gọi hành động rõ hơn nhưng không bị chợ hoặc quá gắt"
      },
      en: {
        intro: "push desirability and buyer value while staying premium",
        cta: "make the CTA stronger without sounding cheap or noisy"
      }
    }
  };

  return guides[toneKey]?.[lang] || guides.natural[lang];
}

function getChannelGuide(lang, channelKey) {
  const guides = {
    tiktok: {
      vi: "ưu tiên mở đầu gọn, nhịp câu rõ và thông tin đủ sắc để dùng cho caption hoặc mô tả ngắn",
      en: "favor concise openings and sharp lines that work for short-form captions and product intros"
    },
    shopee: {
      vi: "ưu tiên mô tả rõ lợi ích, thông tin sản phẩm và lý do nên chọn mua",
      en: "favor clear product benefits, details, and purchase reasons"
    },
    both: {
      vi: "cân bằng giữa tính cô đọng cho TikTok và độ rõ ràng cho Shopee",
      en: "balance concise social copy with marketplace clarity"
    }
  };

  return guides[channelKey]?.[lang] || guides.both[lang];
}

function getCategoryAttributeLabels(category, lang) {
  const attrTypeMap = {
    skincare: {
      vi: ["Thành phần", "Loại da", "Công dụng", "Kết cấu", "Dung tích"],
      en: ["Ingredients", "Skin Type", "Benefits", "Texture", "Volume"]
    },
    fashion: {
      vi: ["Chất liệu", "Size", "Màu sắc", "Form dáng", "Phong cách phối"],
      en: ["Material", "Size", "Color", "Fit", "Styling"]
    },
    home: {
      vi: ["Công dụng", "Kích thước", "Chất liệu", "Công suất", "Điểm tiện lợi"],
      en: ["Use Case", "Size", "Material", "Power", "Convenience"]
    },
    food: {
      vi: ["Thành phần", "Hương vị", "Khối lượng", "Cách dùng", "Điểm nổi bật"],
      en: ["Ingredients", "Flavor", "Weight", "Usage", "Key Benefit"]
    },
    momBaby: {
      vi: ["Độ tuổi phù hợp", "Chất liệu", "Công dụng", "Độ an toàn", "Kích thước"],
      en: ["Age Range", "Material", "Benefits", "Safety", "Size"]
    },
    electronics: {
      vi: ["Tính năng", "Thông số", "Pin / Nguồn", "Kết nối", "Điểm tiện lợi"],
      en: ["Features", "Specs", "Battery / Power", "Connectivity", "Convenience"]
    },
    footwear: {
      vi: ["Chất liệu", "Size", "Màu sắc", "Đế / form", "Phong cách phối"],
      en: ["Material", "Size", "Color", "Sole / Shape", "Styling"]
    },
    bags: {
      vi: ["Chất liệu", "Kích thước", "Màu sắc", "Ngăn chứa", "Phong cách"],
      en: ["Material", "Size", "Color", "Compartments", "Style"]
    },
    accessories: {
      vi: ["Chất liệu", "Kích thước", "Màu sắc", "Chi tiết thiết kế", "Phong cách phối"],
      en: ["Material", "Size", "Color", "Design Detail", "Styling"]
    },
    fragrance: {
      vi: ["Nhóm hương", "Dung tích", "Độ lưu hương", "Tầng hương", "Không gian / dịp dùng"],
      en: ["Scent Family", "Volume", "Longevity", "Notes", "Occasion / Space"]
    },
    pet: {
      vi: ["Đối tượng phù hợp", "Chất liệu / Thành phần", "Công dụng", "Kích thước", "Điểm tiện lợi"],
      en: ["Suitable For", "Material / Ingredients", "Benefits", "Size", "Convenience"]
    },
    sports: {
      vi: ["Chất liệu", "Kích thước", "Công năng", "Độ bền", "Đối tượng phù hợp"],
      en: ["Material", "Size", "Function", "Durability", "Suitable For"]
    },
    other: {
      vi: ["Đặc điểm", "Kích thước", "Chất liệu", "Công dụng", "Ưu điểm"],
      en: ["Feature", "Size", "Material", "Use Case", "Advantage"]
    }
  };

  const langKey = getLangKey(lang);
  return attrTypeMap[category]?.[langKey] || attrTypeMap.other[langKey];
}

function getCategoryPromptNote(category, lang) {
  const langKey = getLangKey(lang);
  const notes = {
    skincare: {
      vi: "Ưu tiên cảm giác trên da, kết cấu, độ thấm, độ dịu nhẹ và cảm nhận sau khi dùng. Tránh viết như tư vấn y khoa.",
      en: "Prioritize skin feel, texture, absorption, gentleness, and after-use feeling. Avoid medical-sounding claims."
    },
    fashion: {
      vi: "Ưu tiên mô tả chất liệu, form dáng, cảm giác mặc, khả năng phối đồ và tổng thể lên người. Tránh văn rao bán chợ hoặc quá khoa trương.",
      en: "Prioritize fabric, silhouette, comfort, styling versatility, and how the item sits on the body. Avoid cheap sales language."
    },
    home: {
      vi: "Ưu tiên công năng, độ tiện lợi, độ bền, cảm giác gọn gàng trong không gian sống và lợi ích dùng hằng ngày.",
      en: "Prioritize practical function, convenience, durability, and day-to-day usefulness in the home."
    },
    food: {
      vi: "Ưu tiên hương vị, thành phần, cảm giác thưởng thức, độ tiện và cảm giác yên tâm khi dùng. Tránh phóng đại quá mức.",
      en: "Prioritize flavor, ingredients, enjoyment, convenience, and a sense of trust. Avoid exaggerated claims."
    },
    momBaby: {
      vi: "Ưu tiên độ an toàn, sự mềm mại, cảm giác an tâm và độ phù hợp theo nhu cầu thực tế của mẹ và bé.",
      en: "Prioritize safety, softness, reassurance, and suitability for real parent and baby needs."
    },
    electronics: {
      vi: "Ưu tiên tính năng hữu ích, trải nghiệm dùng, độ ổn định và giá trị thực dụng. Tránh liệt kê khô cứng như spec sheet thuần túy.",
      en: "Prioritize useful features, usage experience, reliability, and practical value. Avoid sounding like a dry spec sheet."
    },
    footwear: {
      vi: "Ưu tiên cảm giác lên chân, độ êm, phom giày và cách đôi giày hoàn thiện tổng thể outfit.",
      en: "Prioritize on-foot feel, comfort, shoe shape, and how the pair completes the outfit."
    },
    bags: {
      vi: "Ưu tiên form túi, chất liệu, ngăn chứa và cảm giác chỉn chu khi mang theo.",
      en: "Prioritize bag shape, material, compartment logic, and a polished carry feel."
    },
    accessories: {
      vi: "Ưu tiên chi tiết thiết kế, độ tinh tế và hiệu quả khi phối cùng trang phục.",
      en: "Prioritize design detail, refinement, and styling impact."
    },
    fragrance: {
      vi: "Ưu tiên nhóm hương, cảm xúc gợi ra và bối cảnh sử dụng phù hợp. Tránh mô tả rập khuôn hoặc quá hô hào.",
      en: "Prioritize scent family, emotional mood, and fitting use occasions. Avoid cliché fragrance copy."
    },
    pet: {
      vi: "Ưu tiên sự an tâm, độ phù hợp và lợi ích rõ ràng cho thú cưng lẫn người nuôi.",
      en: "Prioritize reassurance, suitability, and clear everyday value for both pets and owners."
    },
    sports: {
      vi: "Ưu tiên cảm giác vận động, độ thoải mái, độ bền và công năng trong lúc tập luyện thật.",
      en: "Prioritize movement feel, comfort, durability, and practical workout function."
    },
    other: {
      vi: "Ưu tiên làm rõ điểm khác biệt, trải nghiệm sử dụng và lý do khiến sản phẩm đáng cân nhắc.",
      en: "Prioritize product differentiation, usage feel, and clear reasons the product is worth considering."
    }
  };

  return notes[category]?.[langKey] || notes.other[langKey];
}

function getSubcategoryPromptNote(category, subcategory, lang) {
  const langKey = getLangKey(lang);
  const vi = {
    fashion: {
      0: "Với đồ ngủ, nhấn cảm giác mặc nhẹ, dễ chịu, sạch sẽ, thư giãn nhưng vẫn gọn gàng và có gu. Không viết như rao hàng giá rẻ.",
      1: "Với áo thun, nhấn chất vải, form lên người, độ dễ phối và cảm giác mặc hằng ngày.",
      2: "Với quần short, nhấn form chân, độ thoải mái, độ linh hoạt và khả năng mặc trong nhiều hoàn cảnh.",
      3: "Với đồ mặc nhà, nhấn cảm giác thư giãn, sạch sẽ, dễ chịu và sự chỉn chu khi mặc thường nhật.",
      4: "Với streetwear, nhấn cá tính, form, layer và ấn tượng thị giác nhưng vẫn giữ văn cao cấp."
    },
    skincare: {
      0: "Với serum, nhấn kết cấu, độ thấm, cảm giác trên da và hiệu quả cảm nhận sau vài lần dùng.",
      1: "Với kem dưỡng, nhấn độ ôm da, độ ẩm và cảm giác dễ chịu sau khi thoa.",
      2: "Với toner, nhấn cảm giác cân bằng, nhẹ da và sự dễ chịu trong routine.",
      3: "Với sữa rửa mặt, nhấn độ sạch, độ êm và cảm giác sau khi rửa.",
      4: "Với chống nắng, nhấn kết cấu, độ ráo, độ thoải mái khi dùng hằng ngày."
    }
  };

  const en = {
    fashion: {
      0: "For sleepwear, emphasize ease, softness, calm comfort, clean appearance, and a quietly polished feel.",
      1: "For T-shirts, emphasize fabric, fit, styling ease, and day-to-day wearability.",
      2: "For shorts, emphasize comfort, leg line, versatility, and relaxed utility.",
      3: "For loungewear, emphasize softness, ease, cleanliness, and the feeling of being put together at home.",
      4: "For streetwear, emphasize silhouette, edge, layering potential, and visual identity while staying premium."
    },
    skincare: {
      0: "For serum, emphasize texture, absorption, skin feel, and visible after-use impression.",
      1: "For moisturizer, emphasize skin comfort, moisture feel, and finish after application.",
      2: "For toner, emphasize balance, lightness, and its place in the routine.",
      3: "For cleanser, emphasize clean feel, gentleness, and after-wash comfort.",
      4: "For sunscreen, emphasize texture, wear comfort, and easy everyday use."
    }
  };

  const source = langKey === "en" ? en : vi;
  return source[category]?.[subcategory] || (langKey === "en"
    ? "Use product-specific detail and keep the wording polished, sensory, and concrete."
    : "Hãy dùng chi tiết đặc thù của sản phẩm và giữ câu chữ cụ thể, giàu cảm giác, nhưng vẫn chỉn chu.");
}

function getCategoryVoiceRules(category, lang) {
  const langKey = getLangKey(lang);
  const rules = {
    fashion: {
      vi: "Giọng văn cần gợi được cảm giác mặc lên người, cách món đồ rơi trên cơ thể, độ gọn, độ thoải mái và tổng thể outfit sau khi hoàn thiện.",
      en: "The writing should make the garment feel worn on the body: how it falls, how it moves, and how it completes the outfit."
    },
    skincare: {
      vi: "Giọng văn cần gợi được cảm giác sản phẩm trên da: độ mỏng, độ thấm, độ êm, độ ráo và cảm nhận sau khi dùng đều đặn.",
      en: "The writing should make the skincare feel tangible on skin: texture, absorption, comfort, finish, and after-use impression."
    },
    home: {
      vi: "Giọng văn cần gợi được bối cảnh sử dụng thực tế trong nhà và cảm giác tiện lợi rõ ràng trong đời sống hằng ngày.",
      en: "The writing should place the product inside real living spaces and highlight day-to-day convenience."
    },
    electronics: {
      vi: "Giọng văn cần biến tính năng thành trải nghiệm dùng thực tế, không chỉ dừng ở việc kể tên thông số.",
      en: "The writing should turn features into lived user experience instead of just listing specs."
    },
    food: {
      vi: "Giọng văn cần gợi được hương vị, cảm giác thưởng thức và hoàn cảnh sử dụng một cách tự nhiên, dễ hình dung.",
      en: "The writing should evoke taste, enjoyment, and realistic usage moments in a natural way."
    },
    momBaby: {
      vi: "Giọng văn cần tạo cảm giác an tâm, dịu nhẹ và đáng tin, không được quá khoa trương hoặc cường điệu.",
      en: "The writing should feel reassuring, gentle, and trustworthy, never exaggerated or noisy."
    },
    footwear: {
      vi: "Giọng văn cần gợi cảm giác lên chân, độ êm, độ gọn và cách đôi giày hoàn thiện dáng người lẫn outfit.",
      en: "The writing should evoke on-foot feel, comfort, shape, and how the pair finishes the outfit."
    },
    bags: {
      vi: "Giọng văn cần thể hiện được form túi, cách mang theo, độ gọn và cảm giác chỉn chu khi kết hợp cùng trang phục.",
      en: "The writing should convey bag shape, carry feel, compactness, and polish when paired with an outfit."
    },
    accessories: {
      vi: "Giọng văn cần cho thấy đây là điểm nhấn nhỏ nhưng tạo hiệu ứng lớn cho tổng thể trang phục hoặc diện mạo.",
      en: "The writing should show how a small accessory creates a noticeable styling impact."
    },
    fragrance: {
      vi: "Giọng văn cần gợi được mood, cá tính và không khí mà mùi hương tạo ra, thay vì chỉ liệt kê nốt hương khô cứng.",
      en: "The writing should evoke mood, identity, and atmosphere rather than dry note listing."
    },
    pet: {
      vi: "Giọng văn cần tạo cảm giác yên tâm cho người nuôi và cho thấy lợi ích thực tế đối với thú cưng.",
      en: "The writing should reassure pet owners while showing everyday practical benefit for the animal."
    },
    sports: {
      vi: "Giọng văn cần gợi chuyển động, cảm giác linh hoạt và tính hữu ích trong lúc tập luyện thật.",
      en: "The writing should evoke movement, flexibility, and practical workout usefulness."
    },
    other: {
      vi: "Giọng văn cần làm rõ giá trị và trải nghiệm sử dụng, tránh mơ hồ hoặc khen chung chung.",
      en: "The writing should clarify value and usage experience, avoiding vague generic praise."
    }
  };

  return rules[category]?.[langKey] || rules.other[langKey];
}

function getCategoryAntiPatterns(category, lang) {
  const langKey = getLangKey(lang);
  const patterns = {
    fashion: {
      vi: "Tránh văn rao sale chợ, tránh khen kiểu 'siêu xinh', 'must-have' nếu không có chi tiết nâng đỡ.",
      en: "Avoid cheap hype like 'super cute' or 'must-have' unless grounded in real details."
    },
    skincare: {
      vi: "Tránh ngôn ngữ y khoa, tránh hứa hẹn điều trị hoặc kết quả tuyệt đối.",
      en: "Avoid medical claims, treatment language, or absolute result promises."
    },
    electronics: {
      vi: "Tránh biến nội dung thành bảng thông số khô cứng hoặc slogan công nghệ rỗng.",
      en: "Avoid turning the copy into a dry spec sheet or empty tech slogans."
    },
    food: {
      vi: "Tránh mô tả quá khoa trương về hương vị nếu không có chi tiết cụ thể để nâng đỡ.",
      en: "Avoid exaggerated taste claims without concrete sensory detail."
    },
    other: {
      vi: "Tránh sáo rỗng, tránh lặp lại cùng một ý bằng nhiều câu khác nhau.",
      en: "Avoid cliché language and repeating the same idea in different wording."
    }
  };

  return patterns[category]?.[langKey] || patterns.other[langKey];
}

function getFormattingNote(category, lang) {
  const langKey = getLangKey(lang);
  const notes = {
    fashion: {
      vi: "Với thời trang, có thể trình bày theo kiểu catalog sang trọng: tên sản phẩm, 1-2 câu giới thiệu ngắn, rồi đến các dòng thông tin rõ ràng bằng bullet như • Chất liệu, • Màu sắc, • Size, • Điểm nổi bật, • Lưu ý. Nếu thiếu dữ liệu thì bỏ mục đó, không bịa.",
      en: "For fashion, you may use a premium catalog-style layout: product name, 1-2 short intro lines, then clean bullet lines such as • Material, • Color, • Size, • Key details, • Notes. Skip any field that is not provided; never invent data."
    },
    other: {
      vi: "Có thể dùng cấu trúc nhiều dòng nếu giúp nội dung rõ và đẹp hơn, nhưng vẫn phải giữ cảm giác thành phẩm chuyên nghiệp.",
      en: "You may use a multi-line structure when it improves clarity and polish, but it must still feel like finished professional copy."
    }
  };

  return notes[category]?.[langKey] || notes.other[langKey];
}

function buildFallbackHashtags(payload) {
  const langKey = getLangKey(payload.lang);
  const productTag = (normalizeText(payload.productName) || (langKey === "en" ? "product" : "sanpham"))
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .join("");
  const subcategoryTag = normalizeText(getSubcategoryLabel(payload.category, payload.subcategory, payload.lang))
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .join("");
  const langTags = langKey === "en"
    ? ["#productfind", "#brandstyle", `#${productTag || "product"}`, `#${subcategoryTag || "stylepick"}`, "#worthbuying"]
    : ["#goiysanpham", "#phongcachthuonghieu", `#${productTag || "sanpham"}`, `#${subcategoryTag || "goiy"}`, "#dangcannhac"];

  return Array.from(new Set(langTags));
}

function getCategoryStructureGuide(category, lang) {
  const langKey = getLangKey(lang);
  const guides = {
    fashion: {
      vi: "Thời trang thường hợp với cấu trúc: tên sản phẩm + cảm giác tổng thể, sau đó đến chất liệu/form/màu/size hoặc điểm nhấn thiết kế, cuối cùng là cách mặc, bảo quản hoặc đổi size nếu có dữ liệu.",
      en: "Fashion works well with: product name + overall aesthetic, then material/fit/color/size or design details, and finally wearability, care, or size-note details when available."
    },
    skincare: {
      vi: "Skincare thường hợp với cấu trúc: tác động đầu tiên trên da, sau đó là kết cấu/thành phần/loại da phù hợp, cuối cùng là cảm giác sau khi dùng và vị trí trong routine.",
      en: "Skincare works well with: immediate skin impression, then texture/ingredients/skin fit, and finally after-use feel and place within the routine."
    },
    home: {
      vi: "Gia dụng thường hợp với cấu trúc: công năng nổi bật, chi tiết tiện dụng/chất liệu/kích thước, cuối cùng là giá trị sử dụng trong đời sống thật.",
      en: "Home products work well with: standout function, then convenience/material/size details, and finally everyday living value."
    },
    food: {
      vi: "Thực phẩm hợp với cấu trúc: hương vị/cảm giác thưởng thức, sau đó là thành phần hoặc cách dùng, cuối cùng là lý do dùng hằng ngày hoặc mang theo.",
      en: "Food works well with: flavor/enjoyment first, then ingredients or usage, and finally everyday or on-the-go relevance."
    },
    momBaby: {
      vi: "Mẹ & Bé hợp với cấu trúc: độ an tâm, sau đó là chất liệu/độ dịu/độ phù hợp, cuối cùng là sự tiện trong chăm sóc hằng ngày.",
      en: "Mom & Baby works well with: reassurance first, then softness/material/suitability, and finally daily care convenience."
    },
    electronics: {
      vi: "Điện tử hợp với cấu trúc: tính năng hoặc lợi ích rõ nhất, sau đó là trải nghiệm dùng/thông số hữu ích, cuối cùng là giá trị thực dụng trong tầm giá.",
      en: "Electronics work well with: strongest feature first, then useful specs/experience, and finally practical value for the price."
    },
    other: {
      vi: "Ưu tiên cấu trúc: ấn tượng đầu tiên, chi tiết tạo tin tưởng, rồi khép lại bằng giá trị sử dụng hoặc lý do đáng cân nhắc.",
      en: "Prefer: first impression, trust-building detail, then finish with practical value or a strong reason to consider it."
    }
  };

  return guides[category]?.[langKey] || guides.other[langKey];
}

function getRelevantHistoryExamples(payload, limit = 2) {
  const store = readHistoryStore();
  return store
    .filter((item) => item.result?.source === "ai")
    .filter((item) => item.form?.category === payload.category)
    .filter((item) => item.form?.subcategory === payload.subcategory)
    .filter((item) => item.form?.lang === payload.lang)
    .slice(0, limit)
    .map((item) => ({
      productName: item.form?.productName,
      paragraphs: item.result?.paragraphs || [],
      hashtags: item.result?.hashtags || []
    }));
}

function generateParagraphs(payload) {
  const {
    lang = "vi",
    productName = "",
    category = "other",
    subcategory = 0,
    channel = 0,
    tone = 0,
    brandStyle = 0,
    mood = 0,
    targetCustomer = "",
    shortDescription = "",
    priceSegment = "",
    highlights = [],
    attributes = [],
    improved = false,
    historyLength = 0
  } = payload;

  const textSet = getTextSet(lang);
  const categoryConfig = getCategoryConfig(category, lang);
  const subcategoryLabel = getSubcategoryLabel(category, subcategory, lang);
  const categoryAttrTypes = getCategoryAttributeLabels(category, lang);
  const brandStyleGuide = getBrandStyleGuide(lang, brandStyle);
  const moodGuide = getMoodGuide(lang, mood);
  const goalGuide = getGoalGuide(lang);
  const brandPhrase = getBrandPhrase(lang, brandStyle);
  const moodPhrase = getMoodPhrase(lang, mood);
  const channelName = textSet.channels[channel] || textSet.channels[0];
  const toneName = textSet.tones[tone] || textSet.tones[0];
  const channelKey = textSet.channels[channel] === "TikTok" ? "tiktok" : textSet.channels[channel] === "Shopee" ? "shopee" : channel === 0 ? "tiktok" : channel === 1 ? "shopee" : "both";
  const toneKey = tone === 1 ? "expert" : tone === 2 ? "hardSell" : "natural";
  const toneGuide = getToneGuide(lang, toneKey);
  const tonePhrase = getTonePhrase(lang, toneKey);
  const channelGuide = getChannelGuide(lang, channelKey);
  const cleanName = normalizeText(productName);
  const cleanShortDescription = normalizeText(shortDescription);
  const cleanTargetCustomer = normalizeText(targetCustomer);
  const cleanPriceSegment = normalizeText(priceSegment);
  const usedHighlights = highlights.map(normalizeText).filter(Boolean).slice(0, 4);
  const usedAttributes = attributes.filter((item) => item && typeof item.value === "string" && item.value.trim());
  const attrPairs = usedAttributes
    .map((item) => `${categoryAttrTypes[item.type] || categoryAttrTypes[0]}: ${item.value.trim()}`)
    .filter(Boolean);
  const highlightText = joinNatural(usedHighlights, lang);
  const attrText = formatAttributeSentence(attrPairs, lang);

  const langKey = getLangKey(lang);

  const openings = langKey === "vi"
    ? [
        `${cleanName || "Sản phẩm này"} mang đến cảm giác chỉn chu ngay từ ấn tượng đầu tiên.`,
        `${cleanName || "Sản phẩm này"} gợi lên tinh thần hiện đại, gọn gàng và dễ tạo thiện cảm.`,
        `${cleanName || "Sản phẩm này"} là lựa chọn dễ ghi điểm ở cả hình ảnh lẫn cảm giác sử dụng.`,
        `${cleanName || "Sản phẩm này"} tạo ấn tượng nhờ cách tiếp cận tinh gọn nhưng vẫn đủ điểm nhấn.`
      ]
    : [
        `${cleanName || "This product"} creates a polished first impression right away.`,
        `${cleanName || "This product"} feels modern, clean, and easy to appreciate at a glance.`,
        `${cleanName || "This product"} stands out through both visual appeal and product feel.`,
        `${cleanName || "This product"} makes an impression through a clean yet distinctive presence.`
      ];

  const positioning = langKey === "vi"
    ? [
        `Trong dòng ${subcategoryLabel}, sản phẩm nổi bật ở ${highlightText || categoryConfig.angle}.`,
        `Ở nhóm ${subcategoryLabel}, điểm hấp dẫn nằm ở ${highlightText || categoryConfig.angle}.`,
        `Thuộc dòng ${subcategoryLabel}, sản phẩm tạo khác biệt bằng ${highlightText || categoryConfig.angle}.`
      ]
    : [
        `Within the ${subcategoryLabel} line, it stands out through ${highlightText || categoryConfig.angle}.`,
        `In the ${subcategoryLabel} segment, its appeal comes from ${highlightText || categoryConfig.angle}.`,
        `As part of the ${subcategoryLabel} category, it differentiates itself through ${highlightText || categoryConfig.angle}.`
      ];

  const detailLead = langKey === "vi"
    ? [
        `Phần giá trị của sản phẩm được thể hiện rõ hơn qua ${attrText ? lowerFirst(attrText.replace(/^Những chi tiết như\s*/i, "").replace(/[.]$/g, "")) : categoryConfig.proof}.`,
        `Điểm khiến sản phẩm thuyết phục hơn nằm ở ${attrText ? lowerFirst(attrText.replace(/^Những chi tiết như\s*/i, "").replace(/[.]$/g, "")) : categoryConfig.proof}.`,
        `Giá trị của sản phẩm không chỉ nằm ở hình ảnh mà còn ở ${attrText ? lowerFirst(attrText.replace(/^Những chi tiết như\s*/i, "").replace(/[.]$/g, "")) : categoryConfig.proof}.`
      ]
    : [
        `Its depth becomes clearer through ${attrText ? attrText.replace(/^Details such as\s*/i, "").replace(/[.]$/g, "").toLowerCase() : categoryConfig.proof}.`,
        `What makes it more convincing is ${attrText ? attrText.replace(/^Details such as\s*/i, "").replace(/[.]$/g, "").toLowerCase() : categoryConfig.proof}.`,
        `Its product value is reinforced by ${attrText ? attrText.replace(/^Details such as\s*/i, "").replace(/[.]$/g, "").toLowerCase() : categoryConfig.proof}.`
      ];

  const audienceLines = langKey === "vi"
    ? [
        `Sản phẩm đặc biệt phù hợp với ${cleanTargetCustomer || `những người quan tâm tới ${categoryConfig.buyerFocus}`}.`,
        `Đây là lựa chọn hợp với ${cleanTargetCustomer || `nhóm khách hàng ưu tiên ${categoryConfig.buyerFocus}`}.`,
        `${cleanTargetCustomer || `Nhóm khách hàng phù hợp nhất là những người coi trọng ${categoryConfig.buyerFocus}`}.`
      ]
    : [
        `It feels especially relevant for ${cleanTargetCustomer || `buyers who care about ${categoryConfig.buyerFocus}`}.`,
        `This makes it well suited to ${cleanTargetCustomer || `customers who prioritize ${categoryConfig.buyerFocus}`}.`,
        `Its strongest audience fit is ${cleanTargetCustomer || `buyers who value ${categoryConfig.buyerFocus}`}.`
      ];

  const closingLines = langKey === "vi"
    ? [
        `Ở mức ${cleanPriceSegment || "giá dễ tiếp cận"}, sản phẩm mang lại ${categoryConfig.close}.`,
        `Với mức giá ${cleanPriceSegment || "dễ tiếp cận"}, sản phẩm tạo cảm giác ${categoryConfig.close}.`,
        `Trong tầm giá ${cleanPriceSegment || "hợp lý"}, sản phẩm nổi bật nhờ ${categoryConfig.close}.`
      ]
    : [
        `At ${cleanPriceSegment || "an accessible price point"}, it delivers ${categoryConfig.close}.`,
        `Within the ${cleanPriceSegment || "accessible"} range, it brings ${categoryConfig.close}.`,
        `At this price point, its appeal comes through ${categoryConfig.close}.`
      ];

  const finishLines = langKey === "vi"
    ? [
        `Tổng thể, đây là lựa chọn đủ chỉn chu để tạo thiện cảm ngay từ lần chạm đầu tiên.`,
        `Nhìn chung, sản phẩm để lại cảm giác gọn gàng, đáng tin và dễ được cân nhắc mua.`,
        `Đây là kiểu sản phẩm dễ tạo ấn tượng tốt nhờ sự cân bằng giữa hình ảnh, trải nghiệm và giá trị sử dụng.`,
        `Sản phẩm phù hợp với những ai tìm kiếm một lựa chọn vừa đẹp hình, vừa rõ giá trị và dễ đưa ra quyết định.`
      ]
    : [
        `Overall, it feels polished enough to leave a strong first impression.`,
        `In the end, it comes across as clean, trustworthy, and easy to consider.`,
        `It works well as a product that balances visual appeal, user feel, and clear value.`,
        `It suits buyers looking for something that feels attractive, credible, and easy to choose.`
      ];

  const improvedTouches = langKey === "vi"
    ? [
        `Phần mô tả có thể nhấn thêm vào độ hoàn thiện và cảm giác dùng thực tế để tăng sức thuyết phục.`,
        `Nếu cần tăng chiều sâu, có thể nhấn mạnh hơn vào trải nghiệm sử dụng và sự khác biệt khi so với lựa chọn phổ thông.`,
        `Bản nội dung này phù hợp để làm nổi rõ tính chỉn chu và cảm giác đáng tiền của sản phẩm.`
      ]
    : [
        `The copy can lean further into finish quality and real usage feel for stronger persuasion.`,
        `If needed, it can push harder on lived product experience and differentiation from generic alternatives.`,
        `This version is especially useful when the goal is to sharpen perceived value and product refinement.`
      ];

  let paragraphs;
  if (lang === "en") {
    paragraphs = [
      ensurePeriod(`${pick(openings)} ${pick(positioning)} ${cleanShortDescription || "It brings a clear, refined product presence that feels easy to understand and easy to place."}`),
      ensurePeriod(`${pick(detailLead)} ${pick(audienceLines)} The overall presentation stays ${brandPhrase}, ${moodPhrase}, and ${tonePhrase}, while remaining suitable for ${channelGuide}.`),
      ensurePeriod(`${pick(closingLines)} ${pick(finishLines)} ${improved ? pick(improvedTouches) : "The description should feel polished, brand-safe, and easy to trust."}`)
    ];
  } else {
    paragraphs = [
      ensurePeriod(`${pick(openings)} ${pick(positioning)} ${cleanShortDescription || "Sản phẩm mang đến cảm giác rõ ràng, dễ hiểu và đủ chỉn chu để tạo thiện cảm ngay từ đầu."}`),
      ensurePeriod(`${pick(detailLead)} ${pick(audienceLines)} Tổng thể phần mô tả giữ ${brandPhrase}, ${moodPhrase}, và ${tonePhrase} để tạo cảm giác chỉn chu mà vẫn dễ tiếp cận.`),
      ensurePeriod(`${pick(closingLines).replace('cảm giác cảm giác', 'cảm giác')} ${pick(finishLines)} ${improved ? pick(improvedTouches) : "Phần mô tả nên giữ được cảm giác chuyên nghiệp, có gu và đủ rõ giá trị sản phẩm."}`)
    ];
  }

  const hashtags = buildFallbackHashtags(payload);

  let meta = textSet.metaClose;
  if (historyLength === 0) meta = textSet.metaFirst;
  else if (historyLength === 1) meta = textSet.metaImprove;

  return { paragraphs, hashtags, meta };
}

function buildOpenAIPrompt(payload) {
  const langKey = getLangKey(payload.lang);
  const categoryConfig = getCategoryConfig(payload.category, payload.lang);
  const subcategoryLabel = getSubcategoryLabel(payload.category, payload.subcategory, payload.lang);
  const textSet = getTextSet(payload.lang);
  const categoryAttrTypes = getCategoryAttributeLabels(payload.category, payload.lang);
  const categoryPromptNote = getCategoryPromptNote(payload.category, payload.lang);
  const subcategoryPromptNote = getSubcategoryPromptNote(payload.category, payload.subcategory, payload.lang);
  const formattingNote = getFormattingNote(payload.category, payload.lang);
  const structureGuide = getCategoryStructureGuide(payload.category, payload.lang);
  const categoryVoiceRules = getCategoryVoiceRules(payload.category, payload.lang);
  const categoryAntiPatterns = getCategoryAntiPatterns(payload.category, payload.lang);
  const retrievedExamples = getRelevantHistoryExamples(payload);
  const toneKey = payload.tone === 1 ? "expert" : payload.tone === 2 ? "hardSell" : "natural";
  const imageCount = (payload.images || []).filter((item) => item?.src).length;

  const attributeText = (payload.attributes || [])
    .filter((item) => item && typeof item.value === "string" && item.value.trim())
    .map((item) => `${categoryAttrTypes[item.type] || categoryAttrTypes[0]}: ${item.value.trim()}`)
    .join(langKey === "en" ? ", " : ", ");

  const highlights = (payload.highlights || []).filter(Boolean).join(langKey === "en" ? ", " : ", ");
  const advancedFieldText = Object.entries(payload.advancedFields || {})
    .filter(([, value]) => typeof value === "string" && value.trim())
    .map(([key, value]) => `${key}: ${value.trim()}`)
    .join(langKey === "en" ? ", " : ", ");
  const examplesText = retrievedExamples.length
    ? retrievedExamples.map((item, index) => `${langKey === "en" ? "Reference" : "Tham chiếu"} ${index + 1} - ${item.productName || "N/A"}: ${(item.paragraphs || []).join(" ")} ${(item.hashtags || []).join(" ")}`).join("\n")
    : (langKey === "en" ? "No stored references yet." : "Chưa có mẫu tham chiếu lưu trữ.");

  if (langKey === "en") {
    return `You are a senior ecommerce brand copywriter.

Task:
- Write polished product-description copy for page 1 of a product content tool.
- This is NOT a spoken script, NOT a review script, and NOT prompt/instruction text.
- The output must read like finished product introduction copy a premium or well-managed brand could publish.
- Avoid meta-writing phrases such as "the tone should", "this description should", "the content should", "suggested message", or anything that explains the writing process.
- Write 3 short paragraphs only.
- Each paragraph must be natural, directly readable, and ready to publish.
- Make the copy flexible and slightly varied on each generation.
- If product images are provided, look at them and use visible details such as fabric feel, color, silhouette, finish, packaging, overall premium level, and visual mood. Do not invent details that cannot be inferred.
- Infer a richer ecommerce-ready structure from minimal user input, similar to how Shopee listings still feel complete even when the seller enters only core details.

Professional copy rules:
- Write like final product page copy, not writing guidance.
- When specific operational details are missing, you may add light, safe, generic shopper-friendly notes that fit the category without inventing hard facts.
- For example, you may mention that size/color can vary slightly, or that actual shade may differ a little due to lighting, but only in a generic non-factual way.
- Use tangible product language: material, finish, shape, comfort, fit, texture, visual mood, and usage.
- Keep the language premium, composed, and clean.
- Avoid empty praise unless it is grounded by actual product details.
- Make each generation slightly different in phrasing and rhythm.

Image grounding checklist:
- If images are present, inspect them first before writing.
- Ground the copy in what is visibly present: shape, fabric or surface feel, color tone, shine/matte finish, structure, packaging, fit, silhouette, and overall aesthetic impression.
- If the image suggests a premium, minimal, soft, sporty, or casual feel, reflect that in wording.
- If a detail is not visible, do not fabricate it.
- If the uploaded images are limited, still use their visual mood to guide the copy.

Absolutely avoid this kind of bad output:
- "the tone should..."
- "this content should..."
- "suggested message"
- "overall the description should..."
- anything that explains writing strategy instead of being the final copy

Good output feels like:
- finished product introduction copy
- clean brand language
- no prompt logic visible
- no self-referential explanation
- every paragraph can be published as-is

Never use these phrases or anything similar:
- "the description should"
- "the content should"
- "overall the description"
- "suggested message"
- "tone should"
- "this product is suitable for"
- "these details help"
- "overall, this is"

Bad example:
- "The description should feel professional and attractive."
- "Overall, the content should build trust."

Good example:
- "Soft cotton and a clean short silhouette give the piece an easy, relaxed finish."
- "The bottle feels minimal and refined, making it easy to place in a polished daily routine."

For fashion specifically, a strong structure can look like this:
- Paragraph 1: product name + short premium introduction
- Paragraph 2: bullet lines such as • Material • Color • Fit • Size notes
- Paragraph 3: care notes, styling notes, or exchange/support notes when relevant

Writing goal:
- Professional product introduction copy
- Brand-quality language
- Clear value, polished feel, easy to trust

Product context:
- Product name: ${payload.productName || "N/A"}
- Category: ${payload.category || "other"}
- Sub-category: ${subcategoryLabel}
- Sales channel: ${textSet.channels[payload.channel] || textSet.channels[0]}
- Tone: ${textSet.tones[payload.tone] || textSet.tones[0]}
- Brand style: ${getBrandStyleGuide(payload.lang, payload.brandStyle)}
- Mood: ${getMoodGuide(payload.lang, payload.mood)}
- Target customer: ${payload.targetCustomer || "N/A"}
- Short description: ${payload.shortDescription || "N/A"}
- Highlights: ${highlights || "N/A"}
- Attributes: ${attributeText || "N/A"}
- Advanced fields: ${advancedFieldText || "N/A"}
- Price segment: ${payload.priceSegment || "N/A"}
- Category cues: ${categoryConfig.angle}; ${categoryConfig.buyerFocus}
- Category-specific note: ${categoryPromptNote}
- Sub-category-specific note: ${subcategoryPromptNote}
- Formatting note: ${formattingNote}
- Structure guide: ${structureGuide}
- Category voice rule: ${categoryVoiceRules}
- Category anti-patterns to avoid: ${categoryAntiPatterns}
- Uploaded image count: ${imageCount}
- Reference examples from previous strong outputs:
${examplesText}
- Use those references only to learn structure and polish. Do not copy phrases verbatim.

Premium writing expectations:
- The first paragraph should establish the product's first impression and positioning.
- The second paragraph should deepen trust through material, finish, fit, feel, or usage detail.
- The third paragraph should close with brand value and purchase appeal, without sounding pushy.
- Also return 5-7 relevant hashtags that feel natural for product discovery and trend relevance, not spam.
- Prefer sensory and visual detail over generic claims.
- If the product is fashion, make the copy feel worn, seen, and styled - not merely listed.
- If the product is skincare, make the copy feel like a refined daily ritual - not a medical explanation.
- If the product is home or electronics, make the copy feel lived-in, practical, and considered.
- Keep verbs active and specific.
- When useful, use line breaks inside a paragraph string to create a polished catalog feel.
- For fashion, bullet points with the symbol • are allowed and encouraged when they make the description clearer and more premium.
- For fashion, prefer a premium catalog feel. Paragraph 2 or 3 may include line breaks and bullet points such as:
  • Chất liệu / Material
  • Màu sắc / Color
  • Size
  • Điểm nhấn thiết kế / Design details
  • Lưu ý size / care / exchange notes when data exists

Output format:
- Return valid JSON only.
- Shape:
{
  "paragraphs": ["paragraph 1", "paragraph 2", "paragraph 3"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}

Rules:
- No markdown
- No bullet points
- No labels like "Opening", "Details", or "Suggested message"
- No explanation about writing style
- No repetition across paragraphs
- Keep each paragraph concise but premium
- Write different phrasing on repeated generations for the same product`;
  }

  return `Bạn là senior brand copywriter cho ecommerce.

Nhiệm vụ:
- Viết nội dung mô tả và giới thiệu sản phẩm cho trang 1 của công cụ tạo nội dung sản phẩm.
- Đây KHÔNG phải là kịch bản để nói, không phải review script, không phải prompt hướng dẫn viết.
- Output phải là văn thành phẩm hoàn chỉnh, đọc vào là dùng được ngay như phần mô tả sản phẩm chuyên nghiệp của brand hoặc shop vận hành tốt.
- Tuyệt đối tránh các câu meta như: "giọng văn nên", "nội dung nên", "thông điệp gợi ý", "tổng thể phần mô tả", hoặc bất kỳ câu nào nói về quá trình viết.
- Viết đúng 3 đoạn ngắn.
- Mỗi đoạn phải tự nhiên, liền mạch, đọc như văn mô tả sản phẩm thực sự.
- Mỗi lần sinh cần có biến thể nhất định để không lặp lại cứng.
- Bắt buộc giữ đầy đủ dấu tiếng Việt tự nhiên, không bỏ dấu, không phiên âm ASCII.
- Nếu có ảnh sản phẩm, hãy quan sát ảnh và tận dụng các chi tiết nhìn thấy được như: chất liệu, màu sắc, form dáng, độ hoàn thiện, cảm giác premium/casual, packaging, bề mặt sản phẩm, tổng thể hình ảnh. Không bịa chi tiết nếu ảnh không thể hiện rõ.
- Hãy suy luận cấu trúc mô tả ecommerce đầy đủ hơn từ lượng input tối thiểu, theo tinh thần các mô tả sản phẩm trên Shopee: ít input nhưng output vẫn phải gọn, đủ ý và có cảm giác hoàn chỉnh.

Quy tắc viết chuyên nghiệp:
- Viết như văn thành phẩm sẽ đặt thẳng lên trang sản phẩm, brand page hoặc mô tả sàn.
- Khi thiếu một số chi tiết vận hành, bạn được phép bổ sung những lưu ý nhẹ, an toàn và phổ biến theo ngành hàng, nhưng không được bịa ra thông số cứng.
- Ví dụ có thể thêm các lưu ý mềm như sai số nhỏ về màu sắc do ánh sáng, size tham khảo, hoặc bảo quản nhẹ nhàng nếu phù hợp ngành thời trang.
- Dùng ngôn ngữ mô tả sản phẩm cụ thể: chất liệu, bề mặt, cảm giác mặc/dùng, form dáng, độ hoàn thiện, màu sắc, cách sản phẩm hiện diện.
- Giữ câu chữ sáng, sang, gọn và có chủ đích.
- Tránh khen sáo rỗng nếu không gắn với chi tiết thật.
- Mỗi lần sinh cần có khác biệt tự nhiên về cách diễn đạt và nhịp câu.

Checklist khi đọc ảnh:
- Nếu có ảnh upload, hãy quan sát ảnh trước rồi mới viết.
- Bám vào những gì nhìn thấy được: chất liệu, bề mặt, độ bóng/lì, phom dáng, màu sắc, độ hoàn thiện, packaging, độ gọn gàng, cảm giác cao cấp hay phổ thông.
- Nếu ảnh gợi cảm giác mềm, sạch, tối giản, hiện đại, thư giãn hay cao cấp, hãy phản ánh điều đó vào câu chữ.
- Không bịa chi tiết nếu ảnh không thể hiện rõ.
- Dù ảnh ít, vẫn phải tận dụng mood thị giác của ảnh để làm câu chữ sát hơn.

Tuyệt đối tránh kiểu output xấu như:
- "giọng văn nên..."
- "nội dung nên..."
- "tổng thể phần mô tả..."
- "thông điệp gợi ý..."
- mọi câu nói về cách viết thay vì chính nội dung thành phẩm

Output tốt phải có cảm giác:
- là phần mô tả sản phẩm hoàn chỉnh
- đọc lên dùng được ngay
- không lộ prompt, không lộ logic hướng dẫn
- có chất thương hiệu, có nhịp và có độ linh hoạt

Tuyệt đối tránh các cụm hoặc ý tương tự:
- "nội dung nên"
- "mô tả nên"
- "tổng thể phần mô tả"
- "thông điệp gợi ý"
- "sản phẩm phù hợp với"
- "những chi tiết như"
- "nhờ vậy"
- "nhìn chung"

Ví dụ xấu:
- "Nội dung nên tạo cảm giác chuyên nghiệp."
- "Tổng thể phần mô tả nên gần gũi nhưng có chọn lọc."

Ví dụ tốt:
- "Chất cotton mềm và thoáng giúp bề mặt quần nhẹ hơn khi mặc, đồng thời giữ cảm giác gọn gàng trong nhịp sinh hoạt hằng ngày."
- "Thiết kế tối giản, màu sắc sạch và độ hoàn thiện vừa đủ khiến sản phẩm tạo thiện cảm ngay từ lần chạm đầu tiên."

Với thời trang, cấu trúc đẹp có thể là:
- Đoạn 1: tên sản phẩm + 1-2 câu giới thiệu ngắn, có chất brand
- Đoạn 2: các dòng bullet như • Chất liệu • Màu sắc • Size • Điểm nổi bật
- Đoạn 3: lưu ý size, bảo quản, đổi trả hoặc gợi ý phối đồ nếu phù hợp dữ liệu

Mục tiêu viết:
- Nội dung giới thiệu sản phẩm chuyên nghiệp
- Văn có chất thương hiệu
- Rõ giá trị, sáng sủa, dễ tin tưởng

Ngữ cảnh sản phẩm:
- Tên sản phẩm: ${payload.productName || "N/A"}
- Danh mục: ${payload.category || "other"}
- Dòng sản phẩm: ${subcategoryLabel}
- Kênh bán: ${textSet.channels[payload.channel] || textSet.channels[0]}
- Phong cách: ${textSet.tones[payload.tone] || textSet.tones[0]}
- Phong cách thương hiệu: ${getBrandStyleGuide(payload.lang, payload.brandStyle)}
- Mood: ${getMoodGuide(payload.lang, payload.mood)}
- Khách hàng mục tiêu: ${payload.targetCustomer || "N/A"}
- Mô tả ngắn: ${payload.shortDescription || "N/A"}
- Điểm nổi bật: ${highlights || "N/A"}
- Thuộc tính: ${attributeText || "N/A"}
- Thông tin chuyên sâu: ${advancedFieldText || "N/A"}
- Phân khúc giá: ${payload.priceSegment || "N/A"}
- Gợi ý theo ngành: ${categoryConfig.angle}; ${categoryConfig.buyerFocus}
- Ghi chú riêng cho ngành: ${categoryPromptNote}
- Ghi chú riêng cho dòng sản phẩm: ${subcategoryPromptNote}
- Ghi chú về cách trình bày: ${formattingNote}
- Gợi ý cấu trúc cho ngành: ${structureGuide}
- Quy tắc giọng văn theo ngành: ${categoryVoiceRules}
- Điều cần tránh theo ngành: ${categoryAntiPatterns}
- Số lượng ảnh upload: ${imageCount}
- Mẫu tham chiếu từ các output trước:
${examplesText}
- Chỉ dùng các mẫu trên để học nhịp, cấu trúc và độ chỉn chu. Không được chép lại nguyên văn.

Kỳ vọng chất lượng:
- Đoạn 1 phải tạo được ấn tượng đầu tiên và định vị sản phẩm.
- Đoạn 2 phải tăng độ tin nhờ chi tiết về chất liệu, bề mặt, form, cảm giác dùng hoặc trải nghiệm thực tế.
- Đoạn 3 phải khép lại bằng giá trị thương hiệu và lý do khiến sản phẩm đáng cân nhắc.
- Trả thêm 5-7 hashtag phù hợp để tăng khả năng khám phá và độ viral tự nhiên, nhưng không được spam hoặc quá rác.
- Ưu tiên chi tiết nhìn thấy được hoặc cảm nhận được, không khen chung chung.
- Với thời trang, câu chữ phải gợi được cảm giác mặc lên người, độ gọn, độ thoải mái và cách món đồ hiện diện.
- Với skincare, câu chữ phải gợi được kết cấu, độ thấm, cảm giác trên da và thói quen dùng hằng ngày.
- Với gia dụng và điện tử, câu chữ phải gợi được trải nghiệm dùng trong đời sống thật, tránh liệt kê khô cứng.
- Giữ động từ cụ thể, tránh văn vô thưởng vô phạt.
- Khi cần, có thể dùng xuống dòng trong cùng một đoạn để nội dung có cảm giác catalog rõ ràng hơn.
- Với thời trang, được phép dùng bullet bằng ký hiệu • nếu giúp phần mô tả sang hơn, rõ hơn và giống mô tả catalog của brand.
- Với thời trang, ưu tiên cảm giác catalog cao cấp. Đoạn 2 hoặc 3 có thể dùng xuống dòng + bullet như:
  • Chất liệu
  • Màu sắc
  • Size
  • Điểm nhấn thiết kế
  • Lưu ý size / bảo quản / đổi trả nếu có dữ liệu

Định dạng output:
- Chỉ trả về JSON hợp lệ.
- Cấu trúc:
{
  "paragraphs": ["đoạn 1", "đoạn 2", "đoạn 3"],
  "hashtags": ["#tag1", "#tag2", "#tag3", "#tag4", "#tag5"]
}

Quy tắc:
- Không markdown
- Không bullet
- Không nhãn kiểu "Mở đầu", "Chi tiết", "Thông điệp gợi ý"
- Không giải thích cách viết
- Không lặp ý giữa các đoạn
- Mỗi đoạn ngắn gọn nhưng phải đủ chất mô tả sản phẩm chuyên nghiệp
- Mỗi lần sinh lại cần có biến thể tự nhiên, không lặp cứng câu chữ`;
}

async function generateWithOpenAI(payload) {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const apiBase = process.env.AI_API_BASE || "https://api.openai.com/v1";
  const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const useChatCompletions = /openrouter\.ai/i.test(apiBase) || /localhost:20128/i.test(apiBase);

  const prompt = buildOpenAIPrompt(payload);
  const content = [{ type: "input_text", text: prompt }];

  for (const image of (payload.images || []).slice(0, 4)) {
    if (!image?.src) continue;
    if (!/^data:image\/(png|jpeg|jpg|gif|webp);/i.test(image.src)) continue;
    content.push({
      type: "input_image",
      image_url: image.src,
      detail: "high"
    });
  }

  let text;

  if (useChatCompletions) {
    const messages = [{
      role: "user",
      content: content.map((item) => {
        if (item.type === "input_text") {
          return { type: "text", text: item.text };
        }
        return {
          type: "image_url",
          image_url: { url: item.image_url }
        };
      })
    }];

    const result = await postJson(
      `${apiBase.replace(/\/$/, "")}/chat/completions`,
      {
        model,
        messages,
        response_format: { type: "json_object" }
      },
      {
        Authorization: `Bearer ${apiKey}`
      }
    );

    text = result.choices?.[0]?.message?.content;
  } else {
    const result = await postJson(
      `${apiBase.replace(/\/$/, "")}/responses`,
      {
        model,
        input: [{ role: "user", content }],
        text: {
          format: {
            type: "json_schema",
            name: "product_description_output",
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                paragraphs: {
                  type: "array",
                  minItems: 3,
                  maxItems: 3,
                  items: { type: "string" }
                },
                hashtags: {
                  type: "array",
                  minItems: 3,
                  maxItems: 8,
                  items: { type: "string" }
                }
              },
              required: ["paragraphs", "hashtags"]
            }
          }
        }
      },
      {
        Authorization: `Bearer ${apiKey}`
      }
    );

    text = result.output_text || result.output?.[0]?.content?.find((item) => item.type === "output_text")?.text;
  }

  if (!text) return null;

  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.paragraphs) || parsed.paragraphs.length < 3) {
    return null;
  }

  return {
    paragraphs: parsed.paragraphs.slice(0, 3).map((item) => compactSentence(item)),
    hashtags: Array.isArray(parsed.hashtags) && parsed.hashtags.length
      ? parsed.hashtags.slice(0, 8).map((item) => compactSentence(item))
      : buildFallbackHashtags(payload)
  };
}

function serveFile(requestPath, response) {
  const appRoutes = new Set(["/", "/login", "/scriptProductInfo", "/profile"]);
  const safePath = appRoutes.has(requestPath) ? "/index.html" : requestPath;
  const absolutePath = path.join(ROOT, path.normalize(safePath).replace(/^([.][.][/\\])+/, ""));

  if (!absolutePath.startsWith(ROOT)) {
    sendJson(response, 403, { error: "Forbidden" });
    return;
  }

  fs.readFile(absolutePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(response, 404, { error: "Not found" });
        return;
      }
      sendJson(response, 500, { error: "Unable to read file" });
      return;
    }

    const extension = path.extname(absolutePath).toLowerCase();
    response.writeHead(200, { "Content-Type": MIME_TYPES[extension] || "application/octet-stream" });
    response.end(content);
  });
}

function createHistoryEntry(payload, result, userId = null) {
  const title = (payload.productName || "Untitled Product").trim();
  const variantLabel = payload.improved
    ? "Ban cai tien"
    : "Ban mo ta";
  return {
    id: `history_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    userId,
    title,
    variantLabel,
    form: {
      lang: payload.lang,
      productName: payload.productName,
      category: payload.category,
      subcategory: payload.subcategory,
      channel: payload.channel,
      tone: payload.tone,
      brandStyle: payload.brandStyle,
      mood: payload.mood,
      targetCustomer: payload.targetCustomer,
      shortDescription: payload.shortDescription,
      priceSegment: payload.priceSegment,
      highlights: payload.highlights,
      attributes: payload.attributes,
      advancedFields: payload.advancedFields || {}
    },
    images: payload.images || [],
    result
  };
}

function getAttributeValue(attributes, typeIndex) {
  return (attributes || []).find((item) => Number(item.type) === typeIndex && typeof item.value === "string" && item.value.trim())?.value?.trim() || "";
}

function formatFashionCatalogResult(payload, result) {
  if (payload.category !== "fashion") return result;

  const paragraphs = Array.isArray(result.paragraphs) ? result.paragraphs : [];
  const productName = normalizeText(payload.productName);
  const shortDescription = normalizeText(payload.shortDescription);
  const material = getAttributeValue(payload.attributes, 0);
  const size = getAttributeValue(payload.attributes, 1);
  const color = getAttributeValue(payload.attributes, 2);
  const fit = getAttributeValue(payload.attributes, 3);
  const styling = getAttributeValue(payload.attributes, 4);
  const highlights = (payload.highlights || []).filter(Boolean);
  const sizeGuide = payload.advancedFields?.sizeGuide || "";
  const careGuide = payload.advancedFields?.careGuide || "";
  const exchangePolicy = payload.advancedFields?.exchangePolicy || "";
  const firstParagraph = paragraphs[0] || shortDescription || "";
  const intro = productName && firstParagraph.toLowerCase().startsWith(productName.toLowerCase())
    ? firstParagraph
    : [productName, firstParagraph].filter(Boolean).join("\n");

  const bullets = [];
  if (material) bullets.push(`• Chất liệu: ${material}`);
  if (color) bullets.push(`• Màu sắc: ${color}`);
  if (size) bullets.push(`• Size: ${size}`);
  if (fit) bullets.push(`• Form dáng: ${fit}`);
  if (styling) bullets.push(`• Phối đồ: ${styling}`);
  if (highlights.length) bullets.push(`• Điểm nổi bật: ${joinNatural(highlights, payload.lang)}`);

  const detailParagraph = [paragraphs[1], bullets.join("\n")].filter(Boolean).join("\n");

  const noteLines = [];
  if (payload.targetCustomer) noteLines.push(`• Phù hợp: ${payload.targetCustomer}`);
  if (payload.priceSegment) noteLines.push(`• Phân khúc giá: ${payload.priceSegment}`);
  if (sizeGuide) noteLines.push(`• Bảng size: ${sizeGuide}`);
  if (careGuide) noteLines.push(`• Bảo quản: ${careGuide}`);
  if (exchangePolicy) noteLines.push(`• Đổi trả / size: ${exchangePolicy}`);
  if (!material && !color && !size && !fit && !styling) noteLines.push(`• Ghi chú: Tùy theo chất liệu và số đo thực tế, cảm giác mặc có thể linh hoạt khác nhau giữa từng người.`);
  const closingParagraph = [paragraphs[2], noteLines.join("\n")].filter(Boolean).join("\n");

  return {
    ...result,
    paragraphs: [intro, detailParagraph, closingParagraph]
  };
}

function formatStructuredResult(payload, result) {
  if (payload.category === "fashion") {
    return formatFashionCatalogResult(payload, result);
  }

  const category = payload.category;
  const attr = (index) => getAttributeValue(payload.attributes, index);
  const paragraphs = Array.isArray(result.paragraphs) ? result.paragraphs : [];
  const blocks = [];

  if (category === "skincare") {
    const bulletLines = [];
    if (attr(0)) bulletLines.push(`• Thành phần: ${attr(0)}`);
    if (attr(1)) bulletLines.push(`• Phù hợp: ${attr(1)}`);
    if (attr(3)) bulletLines.push(`• Kết cấu: ${attr(3)}`);
    blocks.push(paragraphs[0] || "");
    blocks.push([paragraphs[1], bulletLines.join("\n")].filter(Boolean).join("\n"));
    blocks.push(paragraphs[2] || "");
    return { ...result, paragraphs: blocks.filter(Boolean) };
  }

  if (["home", "electronics", "sports", "pet"].includes(category)) {
    const bulletLines = [];
    if (attr(0)) bulletLines.push(`• Công năng / Chất liệu: ${attr(0)}`);
    if (attr(1)) bulletLines.push(`• Kích thước / Thông tin: ${attr(1)}`);
    if (attr(2)) bulletLines.push(`• Điểm dùng chính: ${attr(2)}`);
    blocks.push(paragraphs[0] || "");
    blocks.push([paragraphs[1], bulletLines.join("\n")].filter(Boolean).join("\n"));
    blocks.push(paragraphs[2] || "");
    return { ...result, paragraphs: blocks.filter(Boolean) };
  }

  if (["food", "fragrance"].includes(category)) {
    const bulletLines = [];
    if (attr(0)) bulletLines.push(`• Thành phần / Nhóm hương: ${attr(0)}`);
    if (attr(1)) bulletLines.push(`• Quy cách / Dung tích: ${attr(1)}`);
    if (attr(4)) bulletLines.push(`• Dịp dùng: ${attr(4)}`);
    blocks.push(paragraphs[0] || "");
    blocks.push([paragraphs[1], bulletLines.join("\n")].filter(Boolean).join("\n"));
    blocks.push(paragraphs[2] || "");
    return { ...result, paragraphs: blocks.filter(Boolean) };
  }

  if (["footwear", "bags", "accessories", "momBaby"].includes(category)) {
    const bulletLines = [];
    if (attr(0)) bulletLines.push(`• Chất liệu / Nhóm chính: ${attr(0)}`);
    if (attr(1)) bulletLines.push(`• Size / Kích thước: ${attr(1)}`);
    if (attr(2)) bulletLines.push(`• Màu sắc / Công dụng: ${attr(2)}`);
    blocks.push(paragraphs[0] || "");
    blocks.push([paragraphs[1], bulletLines.join("\n")].filter(Boolean).join("\n"));
    blocks.push(paragraphs[2] || "");
    return { ...result, paragraphs: blocks.filter(Boolean) };
  }

  return result;
}

function sanitizeUser(user) {
  return user ? { id: user.id, name: user.name, email: user.email } : null;
}

const server = http.createServer(async (request, response) => {
  if (!request.url) {
    sendJson(response, 400, { error: "Missing URL" });
    return;
  }

  if (request.method === "POST" && request.url === "/api/generate") {
    try {
      const currentUser = getCurrentUser(request);
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      let aiParagraphs = null;
      try {
        aiParagraphs = await generateWithOpenAI(payload);
      } catch (error) {
        console.error("AI generation failed:", error && error.message ? error.message : error);
        aiParagraphs = null;
      }

      const rawResult = aiParagraphs
        ? {
            paragraphs: aiParagraphs.paragraphs,
            hashtags: aiParagraphs.hashtags || [],
            source: "ai",
            meta: payload.historyLength === 0
              ? getTextSet(payload.lang).metaFirst
              : payload.historyLength === 1
                ? getTextSet(payload.lang).metaImprove
                : getTextSet(payload.lang).metaClose
          }
        : {
            ...generateParagraphs(payload),
            source: "fallback"
          };

      const result = formatStructuredResult(payload, rawResult);

      const existingHistory = readHistoryStore();
      const historyEntry = createHistoryEntry(payload, result, currentUser?.id || null);
      const nextHistory = [historyEntry, ...existingHistory].slice(0, 200);
      writeHistoryStore(nextHistory);

      sendJson(response, 200, { ...result, historyId: historyEntry.id, title: historyEntry.title, variantLabel: historyEntry.variantLabel });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Invalid request" });
    }
    return;
  }

  if (request.method === "GET" && request.url === "/api/history") {
    const currentUser = getCurrentUser(request);
    const items = currentUser
      ? readHistoryStore().filter((item) => item.userId === currentUser.id)
      : [];
    sendJson(response, 200, { items });
    return;
  }

  if (request.method === "POST" && request.url === "/api/history/delete") {
    const currentUser = getCurrentUser(request);
    if (!currentUser) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }
    try {
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const nextHistory = readHistoryStore().filter((item) => !(item.userId === currentUser.id && item.id === payload.historyId));
      writeHistoryStore(nextHistory);
      const users = readUsersStore();
      const user = users.find((item) => item.id === currentUser.id);
      if (user) {
        user.favorites = (user.favorites || []).filter((id) => id !== payload.historyId);
        writeUsersStore(users);
      }
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Delete failed" });
    }
    return;
  }

  if (request.method === "GET" && request.url === "/api/session") {
    const currentUser = getCurrentUser(request);
    sendJson(response, 200, { user: sanitizeUser(currentUser) });
    return;
  }

  if (request.method === "GET" && request.url === "/api/auth/config") {
    sendJson(response, 200, {
      googleEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
      otpEnabled: true
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/auth/google/start") {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      sendJson(response, 400, { error: "Google auth not configured" });
      return;
    }

    const stateToken = `google_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    oauthStateStore.set(stateToken, true);
    const redirectUri = `${getPublicBaseUrl(request)}/api/auth/google/callback`;
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
    url.searchParams.set("redirect_uri", redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", stateToken);
    url.searchParams.set("prompt", "select_account");
    response.writeHead(302, { Location: url.toString() });
    response.end();
    return;
  }

  if (request.method === "GET" && request.url.startsWith("/api/auth/google/callback")) {
    try {
      const url = new URL(request.url, getPublicBaseUrl(request));
      const code = url.searchParams.get("code");
      const stateToken = url.searchParams.get("state");
      if (!code || !stateToken || !oauthStateStore.has(stateToken)) {
        sendJson(response, 400, { error: "Invalid Google callback" });
        return;
      }
      oauthStateStore.delete(stateToken);

      const redirectUri = `${getPublicBaseUrl(request)}/api/auth/google/callback`;
      const tokenResult = await postJson(
        "https://oauth2.googleapis.com/token",
        {
          code,
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: "authorization_code"
        }
      );

      const profile = await getJson("https://www.googleapis.com/oauth2/v2/userinfo", {
        Authorization: `Bearer ${tokenResult.access_token}`
      });

      const users = readUsersStore();
      let user = users.find((item) => item.email === String(profile.email || "").toLowerCase());
      if (!user) {
        user = {
          id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          email: String(profile.email || "").toLowerCase(),
          name: profile.name || profile.email || "Google User",
          favorites: []
        };
        users.unshift(user);
      } else if (profile.name && user.name !== profile.name) {
        user.name = profile.name;
      }
      writeUsersStore(users);

      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      sessions.set(sessionId, user.id);
      response.writeHead(302, {
        Location: "/scriptProductInfo",
        "Set-Cookie": `session_id=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
      });
      response.end();
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Google login failed" });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/auth/request-otp") {
    try {
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const email = (payload.email || "").trim().toLowerCase();
      const password = (payload.password || "").trim();
      if (!email) {
        sendJson(response, 400, { error: "Email is required" });
        return;
      }
      if (!password) {
        sendJson(response, 400, { error: "Password is required" });
        return;
      }
      const users = readUsersStore();
      const existingUser = users.find((item) => item.email === email);
      if (existingUser && existingUser.passwordHash) {
        sendJson(response, 400, { error: "Account already exists. Please log in with email and password." });
        return;
      }

      const code = String(Math.floor(100000 + Math.random() * 900000));
      otpStore.set(email, {
        code,
        name: (payload.name || "").trim(),
        passwordHash: hashPassword(password),
        expiresAt: Date.now() + 10 * 60 * 1000
      });
      const emailSent = await sendOtpEmail(email, code).catch(() => false);
      sendJson(response, 200, {
        ok: true,
        emailSent,
        ...(!emailSent ? { debugCode: code } : {})
      });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "OTP request failed" });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/auth/verify-otp") {
    try {
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const email = (payload.email || "").trim().toLowerCase();
      const code = (payload.code || "").trim();
      const otp = otpStore.get(email);

      if (!otp || otp.expiresAt < Date.now() || otp.code !== code) {
        sendJson(response, 400, { error: "Invalid or expired OTP" });
        return;
      }

      otpStore.delete(email);
      const users = readUsersStore();
      let user = users.find((item) => item.email === email);
      if (!user) {
        user = {
          id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          email,
          name: otp.name || email.split("@")[0] || "User",
          favorites: [],
          passwordHash: otp.passwordHash
        };
        users.unshift(user);
      } else {
        user.name = otp.name || user.name;
        user.passwordHash = otp.passwordHash;
      }
      writeUsersStore(users);

      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      sessions.set(sessionId, user.id);
      sendJsonWithHeaders(response, 200, { user: sanitizeUser(user) }, {
        "Set-Cookie": `session_id=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
      });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "OTP verification failed" });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/auth/login-password") {
    try {
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const email = (payload.email || "").trim().toLowerCase();
      const password = (payload.password || "").trim();
      const users = readUsersStore();
      const user = users.find((item) => item.email === email);
      if (!user) {
        sendJson(response, 401, { error: "Account not found. Please create a new account first." });
        return;
      }
      if (!user.passwordHash) {
        sendJson(response, 401, { error: "This account needs to finish password setup. Use create account or reset password." });
        return;
      }
      if (user.passwordHash !== hashPassword(password)) {
        sendJson(response, 401, { error: "Invalid email or password" });
        return;
      }

      const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
      sessions.set(sessionId, user.id);
      sendJsonWithHeaders(response, 200, { user: sanitizeUser(user) }, {
        "Set-Cookie": `session_id=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
      });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Password login failed" });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/auth/request-password-reset") {
    try {
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const email = (payload.email || "").trim().toLowerCase();
      const users = readUsersStore();
      const user = users.find((item) => item.email === email);
      if (!user) {
        sendJson(response, 404, { error: "Account not found" });
        return;
      }
      const code = String(Math.floor(100000 + Math.random() * 900000));
      passwordResetStore.set(email, { code, expiresAt: Date.now() + 10 * 60 * 1000 });
      const emailSent = await sendOtpEmail(email, code).catch(() => false);
      sendJson(response, 200, { ok: true, emailSent, ...(!emailSent ? { debugCode: code } : {}) });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Password reset request failed" });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/auth/verify-password-reset") {
    try {
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const email = (payload.email || "").trim().toLowerCase();
      const code = (payload.code || "").trim();
      const newPassword = (payload.newPassword || "").trim();
      const reset = passwordResetStore.get(email);
      if (!reset || reset.expiresAt < Date.now() || reset.code !== code) {
        sendJson(response, 400, { error: "Invalid or expired OTP" });
        return;
      }
      const users = readUsersStore();
      const user = users.find((item) => item.email === email);
      if (!user) {
        sendJson(response, 404, { error: "Account not found" });
        return;
      }
      user.passwordHash = hashPassword(newPassword);
      writeUsersStore(users);
      passwordResetStore.delete(email);
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Password reset failed" });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/auth/change-password") {
    const currentUser = getCurrentUser(request);
    if (!currentUser) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }
    try {
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const currentPassword = (payload.currentPassword || "").trim();
      const newPassword = (payload.newPassword || "").trim();
      const users = readUsersStore();
      const user = users.find((item) => item.id === currentUser.id);
      if (!user || user.passwordHash !== hashPassword(currentPassword)) {
        sendJson(response, 400, { error: "Current password is incorrect" });
        return;
      }
      user.passwordHash = hashPassword(newPassword);
      writeUsersStore(users);
      sendJson(response, 200, { ok: true });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Change password failed" });
    }
    return;
  }

  if (request.method === "POST" && request.url === "/api/logout") {
    const cookies = parseCookies(request);
    if (cookies.session_id) sessions.delete(cookies.session_id);
    sendJsonWithHeaders(response, 200, { ok: true }, {
      "Set-Cookie": "session_id=; Path=/; HttpOnly; Max-Age=0; SameSite=Lax"
    });
    return;
  }

  if (request.method === "GET" && request.url === "/api/favorites") {
    const currentUser = getCurrentUser(request);
    if (!currentUser) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }
    const history = readHistoryStore();
    const items = (currentUser.favorites || []).map((id) => history.find((entry) => entry.id === id)).filter(Boolean);
    sendJson(response, 200, { items });
    return;
  }

  if (request.method === "POST" && request.url === "/api/favorites/toggle") {
    const currentUser = getCurrentUser(request);
    if (!currentUser) {
      sendJson(response, 401, { error: "Unauthorized" });
      return;
    }
    try {
      const rawBody = await readBody(request);
      const payload = rawBody ? JSON.parse(rawBody) : {};
      const historyId = payload.historyId;
      const users = readUsersStore();
      const user = users.find((item) => item.id === currentUser.id);
      if (!user) {
        sendJson(response, 404, { error: "User not found" });
        return;
      }
      user.favorites = user.favorites || [];
      if (user.favorites.includes(historyId)) {
        user.favorites = user.favorites.filter((id) => id !== historyId);
      } else {
        user.favorites.unshift(historyId);
      }
      writeUsersStore(users);
      sendJson(response, 200, { favorites: user.favorites });
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Toggle favorite failed" });
    }
    return;
  }

  if (request.method === "GET") {
    serveFile(request.url.split("?")[0], response);
    return;
  }

  sendJson(response, 405, { error: "Method not allowed" });
});

server.listen(PORT, () => {
  console.log(`Seller Studio server running at http://127.0.0.1:${PORT}`);
});
