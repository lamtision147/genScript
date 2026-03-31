const CATEGORY_GROUP_MAP = {
  fashion: "fashionBeauty",
  skincare: "fashionBeauty",
  beautyTools: "fashionBeauty",
  footwear: "fashionBeauty",
  bags: "fashionBeauty",
  accessories: "fashionBeauty",
  fragrance: "fashionBeauty",
  home: "homeLiving",
  furnitureDecor: "homeLiving",
  homeAppliances: "homeLiving",
  toolsHardware: "homeLiving",
  electronics: "electronicsTech",
  phoneTablet: "electronicsTech",
  computerOffice: "electronicsTech",
  cameraDrone: "electronicsTech",
  motherBaby: "motherBabyHealth",
  healthCare: "motherBabyHealth",
  booksStationery: "booksGames",
  toysGames: "booksGames",
  autoMoto: "autoMobility",
  food: "foodFmcg",
  householdEssentials: "foodFmcg",
  pet: "petSports",
  sports: "petSports",
  digitalGoods: "other",
  other: "other"
};

const CATEGORY_DEFAULT_CHANNEL = {
  fashion: 0,
  skincare: 1,
  beautyTools: 1,
  home: 1,
  furnitureDecor: 1,
  electronics: 1,
  food: 2,
  householdEssentials: 2,
  footwear: 0,
  bags: 0,
  accessories: 0,
  fragrance: 0,
  pet: 2,
  sports: 0,
  motherBaby: 1,
  healthCare: 1,
  booksStationery: 2,
  toysGames: 2,
  autoMoto: 1,
  phoneTablet: 1,
  computerOffice: 1,
  cameraDrone: 1,
  homeAppliances: 1,
  toolsHardware: 1,
  digitalGoods: 2,
  other: 2
};

const GROUP_MARKETPLACE_PRESETS = {
  fashionBeauty: {
    0: { tone: 0, brandStyle: 1, mood: 2 },
    1: { tone: 1, brandStyle: 0, mood: 0 },
    2: { tone: 1, brandStyle: 0, mood: 3 }
  },
  homeLiving: {
    0: { tone: 0, brandStyle: 3, mood: 2 },
    1: { tone: 1, brandStyle: 2, mood: 3 },
    2: { tone: 1, brandStyle: 3, mood: 2 }
  },
  electronicsTech: {
    0: { tone: 0, brandStyle: 1, mood: 2 },
    1: { tone: 1, brandStyle: 2, mood: 3 },
    2: { tone: 1, brandStyle: 2, mood: 3 }
  },
  motherBabyHealth: {
    0: { tone: 0, brandStyle: 2, mood: 1 },
    1: { tone: 1, brandStyle: 2, mood: 3 },
    2: { tone: 1, brandStyle: 2, mood: 1 }
  },
  booksGames: {
    0: { tone: 0, brandStyle: 1, mood: 2 },
    1: { tone: 0, brandStyle: 1, mood: 1 },
    2: { tone: 0, brandStyle: 1, mood: 2 }
  },
  autoMobility: {
    0: { tone: 1, brandStyle: 2, mood: 3 },
    1: { tone: 1, brandStyle: 2, mood: 3 },
    2: { tone: 1, brandStyle: 2, mood: 3 }
  },
  foodFmcg: {
    0: { tone: 0, brandStyle: 1, mood: 1 },
    1: { tone: 0, brandStyle: 3, mood: 1 },
    2: { tone: 0, brandStyle: 1, mood: 1 }
  },
  petSports: {
    0: { tone: 0, brandStyle: 1, mood: 2 },
    1: { tone: 1, brandStyle: 2, mood: 3 },
    2: { tone: 1, brandStyle: 1, mood: 2 }
  },
  other: {
    0: { tone: 0, brandStyle: 1, mood: 2 },
    1: { tone: 1, brandStyle: 2, mood: 3 },
    2: { tone: 0, brandStyle: 0, mood: 1 }
  }
};

const GROUP_LABELS = {
  vi: {
    fashionBeauty: "Thời trang, làm đẹp",
    homeLiving: "Nhà cửa, đời sống",
    electronicsTech: "Điện tử, công nghệ",
    motherBabyHealth: "Mẹ bé, sức khỏe",
    booksGames: "Sách, văn phòng phẩm, đồ chơi",
    autoMobility: "Ô tô, xe máy, xe đạp",
    foodFmcg: "Thực phẩm, đồ uống",
    petSports: "Thú cưng, thể thao",
    other: "Khác"
  },
  en: {
    fashionBeauty: "Fashion and beauty",
    homeLiving: "Home and living",
    electronicsTech: "Electronics and tech",
    motherBabyHealth: "Mother baby and health",
    booksGames: "Books, stationery, toys",
    autoMobility: "Auto and mobility",
    foodFmcg: "Food and beverage",
    petSports: "Pet and sports",
    other: "Other"
  }
};

const GROUP_ORDER = [
  "fashionBeauty",
  "homeLiving",
  "electronicsTech",
  "motherBabyHealth",
  "booksGames",
  "autoMobility",
  "foodFmcg",
  "petSports",
  "other"
];

const GROUP_CATEGORY_VALUES = {
  fashionBeauty: ["fashion", "skincare", "beautyTools", "footwear", "bags", "accessories", "fragrance"],
  homeLiving: ["home", "furnitureDecor", "homeAppliances", "toolsHardware"],
  electronicsTech: ["electronics", "phoneTablet", "computerOffice", "cameraDrone"],
  motherBabyHealth: ["motherBaby", "healthCare"],
  booksGames: ["booksStationery", "toysGames"],
  autoMobility: ["autoMoto"],
  foodFmcg: ["food", "householdEssentials"],
  petSports: ["pet", "sports"],
  other: ["digitalGoods", "other"]
};

const CATEGORY_SEARCH_TOKENS = {
  vi: {
    fashion: ["ao", "quan", "vay", "thoitrang"],
    skincare: ["mypham", "chamda", "serum", "kemduong"],
    beautyTools: ["dungculamdep", "maylamtoc", "makeup", "thietbichamsoc"],
    home: ["giadung", "nhacua", "bep", "noithat"],
    furnitureDecor: ["noithat", "ban", "ghe", "decor"],
    electronics: ["dientu", "phukien", "tainghe", "sac"],
    food: ["thucpham", "doan", "douong", "anvat"],
    householdEssentials: ["hoapham", "giatxa", "giayvesinh", "tieudung"],
    footwear: ["giay", "sandal", "sneaker"],
    bags: ["tui", "balo", "vi"],
    accessories: ["trangsuc", "kinh", "munon", "phukien"],
    fragrance: ["nuochoa", "huongthom", "bodymist"],
    pet: ["thucung", "cho", "meo", "pet"],
    sports: ["thethao", "gym", "running", "yoga"],
    motherBaby: ["mebe", "sosinh", "bim", "treem"],
    healthCare: ["suckhoe", "vitamin", "huyetap", "health"],
    booksStationery: ["sach", "vanphongpham", "planner", "but"],
    toysGames: ["dochoi", "boardgame", "lego", "game"],
    autoMoto: ["oto", "xemay", "xedap", "phukienxe"],
    phoneTablet: ["dienthoai", "tablet", "smartphone", "mobile"],
    computerOffice: ["laptop", "maytinh", "vanphong", "phimchuot"],
    cameraDrone: ["camera", "drone", "flycam", "quaychup"],
    homeAppliances: ["diengiadung", "noichien", "mayhutbui", "khongkhi"],
    toolsHardware: ["dungcu", "khoan", "suachua", "diy"],
    digitalGoods: ["sanphamsovoucher", "voucher", "license", "khoahoconline"],
    other: ["khac", "tonghop"]
  },
  en: {
    fashion: ["fashion", "apparel", "outfit"],
    skincare: ["skincare", "beauty", "serum"],
    beautyTools: ["beauty tools", "personal care device", "makeup tool", "hair tool"],
    home: ["home", "living", "kitchen"],
    furnitureDecor: ["furniture", "decor", "sofa", "desk"],
    electronics: ["electronics", "tech", "accessory"],
    food: ["food", "beverage", "snack"],
    householdEssentials: ["household essentials", "detergent", "tissue", "fmcg"],
    footwear: ["footwear", "shoes", "sneaker"],
    bags: ["bags", "wallet", "backpack"],
    accessories: ["accessories", "jewelry", "watch"],
    fragrance: ["fragrance", "perfume", "scent"],
    pet: ["pet", "cat", "dog"],
    sports: ["sports", "fitness", "running"],
    motherBaby: ["mother", "baby", "newborn"],
    healthCare: ["health", "care", "vitamin"],
    booksStationery: ["books", "stationery", "planner"],
    toysGames: ["toys", "games", "board"],
    autoMoto: ["auto", "moto", "bicycle"],
    phoneTablet: ["phone", "tablet", "mobile"],
    computerOffice: ["computer", "office", "laptop"],
    cameraDrone: ["camera", "drone", "photo"],
    homeAppliances: ["appliances", "airfryer", "vacuum"],
    toolsHardware: ["tools", "hardware", "diy"],
    digitalGoods: ["digital goods", "voucher", "license", "online course"],
    other: ["other", "general"]
  }
};

function normalizeSearchText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

function normalizeChannel(input, fallback = 2) {
  const value = Number(input);
  if (!Number.isFinite(value)) return fallback;
  const normalized = Math.floor(value);
  if (normalized < 0 || normalized > 2) return fallback;
  return normalized;
}

export function getCategoryGroupValue(category) {
  const key = String(category || "").trim();
  return CATEGORY_GROUP_MAP[key] || "other";
}

export function getCategoryValuesByGroup(groupFilter = "other") {
  const key = String(groupFilter || "other").trim();
  return GROUP_CATEGORY_VALUES[key] || GROUP_CATEGORY_VALUES.other;
}

export function getCategorySearchKeywords(category, language = "vi") {
  const lang = String(language || "vi").toLowerCase().trim() === "vi" ? "vi" : "en";
  const key = String(category || "other").trim() || "other";
  return CATEGORY_SEARCH_TOKENS[lang][key] || CATEGORY_SEARCH_TOKENS[lang].other;
}

export function getMarketplaceDefaults(category, channel) {
  const key = String(category || "other").trim() || "other";
  const group = getCategoryGroupValue(key);
  const fallbackChannel = CATEGORY_DEFAULT_CHANNEL[key] ?? 2;
  const nextChannel = normalizeChannel(channel, fallbackChannel);
  const groupDefaults = GROUP_MARKETPLACE_PRESETS[group] || GROUP_MARKETPLACE_PRESETS.other;
  const style = groupDefaults[nextChannel] || groupDefaults[fallbackChannel] || GROUP_MARKETPLACE_PRESETS.other[2];

  return {
    channel: nextChannel,
    tone: style.tone,
    brandStyle: style.brandStyle,
    mood: style.mood
  };
}

export function getCategoryGroupOptions(language = "vi") {
  const lang = String(language || "vi").toLowerCase().trim();
  const labels = GROUP_LABELS[lang === "vi" ? "vi" : "en"];
  return GROUP_ORDER.map((value) => ({
    value,
    label: labels[value] || value
  }));
}

export function getFilteredCategoryOptions(categoryOptions = [], {
  language = "vi",
  groupFilter = "fashionBeauty",
  searchKeyword = ""
} = {}) {
  const keyword = normalizeSearchText(searchKeyword);
  const groupValues = getCategoryValuesByGroup(groupFilter);
  const groupScopedOptions = (Array.isArray(categoryOptions) ? categoryOptions : []).filter((option) =>
    groupValues.includes(String(option?.value || ""))
  );

  if (!keyword) {
    return { options: groupScopedOptions, matched: true };
  }

  const filtered = groupScopedOptions.filter((option) => {
    const value = String(option?.value || "");
    if (!value) return false;

    const label = normalizeSearchText(option?.label || "");
    const tokens = getCategorySearchKeywords(value, language)
      .map((token) => normalizeSearchText(token))
      .filter(Boolean);

    if (label.includes(keyword)) {
      return true;
    }
    return tokens.some((token) => token.includes(keyword));
  });

  if (filtered.length) {
    return { options: filtered, matched: true };
  }

  return {
    options: groupScopedOptions,
    matched: false
  };
}
