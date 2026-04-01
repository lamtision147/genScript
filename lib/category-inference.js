import { getCategoryGroupValue } from "@/lib/category-marketplace-presets";

export const CANONICAL_CATEGORY_VALUES = [
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

const CANONICAL_CATEGORY_SET = new Set(CANONICAL_CATEGORY_VALUES);

const NORMALIZED_CATEGORY_ALIAS_MAP = {
  khac: "other",
  other: "other",
  unknown: "other",
  fashion: "fashion",
  thoitrang: "fashion",
  skincare: "skincare",
  mypham: "skincare",
  beautytools: "beautyTools",
  beautytool: "beautyTools",
  dungculamdep: "beautyTools",
  thietbichamsoccanhan: "beautyTools",
  home: "home",
  giadung: "home",
  furnituredecor: "furnitureDecor",
  noithat: "furnitureDecor",
  trangtri: "furnitureDecor",
  electronics: "electronics",
  dientu: "electronics",
  food: "food",
  thucpham: "food",
  householdessentials: "householdEssentials",
  tieudungnhanh: "householdEssentials",
  hoapham: "householdEssentials",
  footwear: "footwear",
  giaydep: "footwear",
  bags: "bags",
  tuixach: "bags",
  accessories: "accessories",
  phukien: "accessories",
  fragrance: "fragrance",
  nuochoa: "fragrance",
  pet: "pet",
  thucung: "pet",
  sports: "sports",
  thethao: "sports",
  motherbaby: "motherBaby",
  mevabe: "motherBaby",
  healthcare: "healthCare",
  suckhoe: "healthCare",
  booksstationery: "booksStationery",
  sachvanphongpham: "booksStationery",
  toysgames: "toysGames",
  dochoi: "toysGames",
  automoto: "autoMoto",
  otoxemay: "autoMoto",
  phonetablet: "phoneTablet",
  dienthoaitablet: "phoneTablet",
  computeroffice: "computerOffice",
  maytinhvanphong: "computerOffice",
  cameradrone: "cameraDrone",
  mayanhdrone: "cameraDrone",
  homeappliances: "homeAppliances",
  diengiadung: "homeAppliances",
  toolshardware: "toolsHardware",
  dungcu: "toolsHardware",
  digitalgoods: "digitalGoods",
  sanphamso: "digitalGoods",
  sanphamsovoucher: "digitalGoods",
  voucher: "digitalGoods"
};

const UNKNOWN_GENERATED_NAME_PATTERN = /(khong nhan dang|khong xac dinh|unable to identify|cannot identify)/i;

const CATEGORY_FALLBACK_NAMES_BY_LANG = {
  vi: {
    fashion: "Sản phẩm thời trang",
    skincare: "Sản phẩm skincare",
    beautyTools: "Dụng cụ làm đẹp",
    home: "Sản phẩm gia dụng",
    furnitureDecor: "Sản phẩm nội thất trang trí",
    electronics: "Thiết bị điện tử",
    food: "Sản phẩm thực phẩm",
    householdEssentials: "Sản phẩm tiêu dùng nhanh",
    footwear: "Giày dép",
    bags: "Túi xách",
    accessories: "Phụ kiện",
    fragrance: "Nước hoa",
    pet: "Sản phẩm thú cưng",
    sports: "Sản phẩm thể thao",
    motherBaby: "Sản phẩm mẹ và bé",
    healthCare: "Sản phẩm chăm sóc sức khỏe",
    booksStationery: "Sách và văn phòng phẩm",
    toysGames: "Đồ chơi",
    autoMoto: "Phụ kiện ô tô xe máy",
    phoneTablet: "Điện thoại hoặc máy tính bảng",
    computerOffice: "Thiết bị máy tính văn phòng",
    cameraDrone: "Thiết bị camera drone",
    homeAppliances: "Điện gia dụng",
    toolsHardware: "Dụng cụ và phụ kiện",
    digitalGoods: "Sản phẩm số",
    other: "Sản phẩm"
  },
  en: {
    fashion: "Fashion product",
    skincare: "Skincare product",
    beautyTools: "Beauty tools product",
    home: "Home product",
    furnitureDecor: "Furniture decor product",
    electronics: "Electronic device",
    food: "Food product",
    householdEssentials: "Household essentials product",
    footwear: "Footwear product",
    bags: "Bag product",
    accessories: "Accessory product",
    fragrance: "Fragrance product",
    pet: "Pet product",
    sports: "Sports product",
    motherBaby: "Mother and baby product",
    healthCare: "Health care product",
    booksStationery: "Books and stationery product",
    toysGames: "Toys and games product",
    autoMoto: "Auto and moto accessory",
    phoneTablet: "Phone or tablet",
    computerOffice: "Computer office device",
    cameraDrone: "Camera drone device",
    homeAppliances: "Home appliance",
    toolsHardware: "Tools and hardware product",
    digitalGoods: "Digital goods product",
    other: "Product"
  }
};

export function normalizeTextForCategoryCheck(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();
}

export function normalizeSuggestedCategory(value = "") {
  const raw = String(value || "").trim();
  if (!raw) return "other";
  if (CANONICAL_CATEGORY_SET.has(raw)) return raw;

  const normalized = normalizeTextForCategoryCheck(raw).replace(/\s+/g, "");
  return NORMALIZED_CATEGORY_ALIAS_MAP[normalized] || "other";
}

export function inferCategoryFromProductName(name = "") {
  const normalized = normalizeTextForCategoryCheck(name);
  if (!normalized) return "";

  const has = (pattern) => pattern.test(normalized);

  if (has(/voucher|gift\s*card|license|template|preset|khoa\s*hoc\s*online|digital\b/)) return "digitalGoods";
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

  if (has(/\bao\b|dam\s*cong\s*so|dam\s*du\s*tiec|dam\s*nu|\bvay\b|so\s*mi|hoodie|\bquan\b|sleepwear|pajama|pyjama|do\s*ngu|quan\s*ngu|shorts?/)) return "fashion";
  if (has(/giay|sneaker|sandal|dep\b|boots/)) return "footwear";
  if (has(/wallet|that\s*lung|belt|khuyen\s*tai|vong\b|phu\s*kien|accessor/)) return "accessories";

  if (has(/noi\s*chien|air\s*fryer|may\s*hut\s*bui|vacuum|may\s*loc\s*khong\s*khi|air\s*purifier|may\s*xay|blender|juicer|home\s*appliance/)) return "homeAppliances";
  if (has(/vien\s*giat|nuoc\s*giat|detergent|lau\s*san|floor\s*cleaner|tissue|giay\s*ve\s*sinh|dishwash/)) return "householdEssentials";
  if (has(/ke\s*bep|gia\s*vi|hop\s*dung|do\s*bep|houseware|gia\s*dung|kitchenware/)) return "home";
  if (has(/sofa|ban\s*tra|\bke\b|shelf|\btu\b|chair|den\s*decor|decor|noi\s*that|furniture/)) return "furnitureDecor";

  if (has(/yen\s*mach|granola|snack|do\s*uong|thuc\s*pham|food|an\s*kieng/)) return "food";
  if (has(/pate|thuc\s*an\s*cho|thuc\s*an\s*meo|cat\s*litter|pet\b|thu\s*cung|dog|cat/)) return "pet";
  if (has(/yoga|gym|running|dumbbell|resistance|the\s*thao/)) return "sports";
  if (has(/planner|but\b|notebook|sach\b|stationery|van\s*phong\s*pham|book\b/)) return "booksStationery";
  if (has(/lego|board\s*game|do\s*choi|toy\b|game\b/)) return "toysGames";
  if (has(/may\s*khoan|khoan\b|tua\s*vit|dung\s*cu|tool|hardware|do\s*nghe/)) return "toolsHardware";

  return "";
}

export function shouldPreferInferredCategory(inferredCategory = "", suggestedCategory = "") {
  if (!inferredCategory || !suggestedCategory || inferredCategory === suggestedCategory) return false;
  const suggestedGroup = getCategoryGroupValue(suggestedCategory);
  const inferredGroup = getCategoryGroupValue(inferredCategory);
  const isSpecificTechCorrection = ["electronics", "computerOffice", "phoneTablet"].includes(inferredCategory);
  return suggestedGroup !== inferredGroup || isSpecificTechCorrection;
}

export function isUnknownGeneratedProductName(value = "") {
  const normalized = normalizeTextForCategoryCheck(value);
  if (!normalized) return true;
  return UNKNOWN_GENERATED_NAME_PATTERN.test(normalized);
}

export function buildCategoryFallbackProductName(category = "other", language = "vi") {
  const langKey = language === "vi" ? "vi" : "en";
  const dict = CATEGORY_FALLBACK_NAMES_BY_LANG[langKey] || CATEGORY_FALLBACK_NAMES_BY_LANG.en;
  return dict[category] || dict.other;
}
