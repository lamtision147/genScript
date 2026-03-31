const fs = require("node:fs");
const path = require("node:path");

const endpoint = process.env.BENCHMARK_ENDPOINT || "http://127.0.0.1:4174/api/suggest-from-images";
const outDir = process.env.BENCHMARK_OUT_DIR || path.join(process.cwd(), "scripts", "benchmark-output");
const now = new Date();
const stamp = `${now.toISOString().slice(0, 10)}-${now.toISOString().slice(11, 19).replace(/:/g, "")}`;
const outPath = path.join(outDir, `category-accuracy-${stamp}.json`);

const DATASET = [
  { sku: "FAS-001", name: "Áo sơ mi linen nam", expectedCategory: "fashion", expectedGroup: "fashionBeauty" },
  { sku: "FAS-002", name: "Đầm công sở nữ", expectedCategory: "fashion", expectedGroup: "fashionBeauty" },
  { sku: "SKI-001", name: "Serum B5 phục hồi da", expectedCategory: "skincare", expectedGroup: "fashionBeauty" },
  { sku: "SKI-002", name: "Kem chống nắng da nhạy cảm", expectedCategory: "skincare", expectedGroup: "fashionBeauty" },
  { sku: "BEA-001", name: "Máy rửa mặt sóng âm mini", expectedCategory: "beautyTools", expectedGroup: "fashionBeauty" },
  { sku: "BEA-002", name: "Máy sấy tóc ion âm", expectedCategory: "beautyTools", expectedGroup: "fashionBeauty" },
  { sku: "HOM-001", name: "Kệ bếp inox gọn", expectedCategory: "home", expectedGroup: "homeLiving" },
  { sku: "HOM-002", name: "Hộp đựng gia vị nhà bếp", expectedCategory: "home", expectedGroup: "homeLiving" },
  { sku: "FUR-001", name: "Bàn trà sofa mặt đá", expectedCategory: "furnitureDecor", expectedGroup: "homeLiving" },
  { sku: "FUR-002", name: "Đèn decor phòng ngủ", expectedCategory: "furnitureDecor", expectedGroup: "homeLiving" },
  { sku: "ELE-001", name: "Tai nghe bluetooth chống ồn", expectedCategory: "electronics", expectedGroup: "electronicsTech" },
  { sku: "ELE-002", name: "Sạc nhanh 65W", expectedCategory: "electronics", expectedGroup: "electronicsTech" },
  { sku: "FOD-001", name: "Yến mạch granola vị cacao", expectedCategory: "food", expectedGroup: "foodFmcg" },
  { sku: "FOD-002", name: "Snack hạt mix ăn kiêng", expectedCategory: "food", expectedGroup: "foodFmcg" },
  { sku: "HOU-001", name: "Viên giặt đậm đặc 40 viên", expectedCategory: "householdEssentials", expectedGroup: "foodFmcg" },
  { sku: "HOU-002", name: "Nước giặt khử mùi dịu nhẹ", expectedCategory: "householdEssentials", expectedGroup: "foodFmcg" },
  { sku: "FOO-001", name: "Giày chạy bộ nam", expectedCategory: "footwear", expectedGroup: "fashionBeauty" },
  { sku: "FOO-002", name: "Sneaker nữ trắng basic", expectedCategory: "footwear", expectedGroup: "fashionBeauty" },
  { sku: "BAG-001", name: "Túi tote canvas", expectedCategory: "bags", expectedGroup: "fashionBeauty" },
  { sku: "BAG-002", name: "Balo laptop 15 inch", expectedCategory: "bags", expectedGroup: "fashionBeauty" },
  { sku: "ACC-001", name: "Khuyên tai bạc basic", expectedCategory: "accessories", expectedGroup: "fashionBeauty" },
  { sku: "ACC-002", name: "Thắt lưng da nam", expectedCategory: "accessories", expectedGroup: "fashionBeauty" },
  { sku: "FRA-001", name: "Nước hoa nữ hương gỗ", expectedCategory: "fragrance", expectedGroup: "fashionBeauty" },
  { sku: "FRA-002", name: "Body mist hoa cỏ", expectedCategory: "fragrance", expectedGroup: "fashionBeauty" },
  { sku: "PET-001", name: "Pate cho mèo vị cá ngừ", expectedCategory: "pet", expectedGroup: "petSports" },
  { sku: "PET-002", name: "Thức ăn chó trưởng thành", expectedCategory: "pet", expectedGroup: "petSports" },
  { sku: "SPT-001", name: "Thảm yoga chống trượt", expectedCategory: "sports", expectedGroup: "petSports" },
  { sku: "SPT-002", name: "Dây kháng lực tập gym", expectedCategory: "sports", expectedGroup: "petSports" },
  { sku: "MAB-001", name: "Bình sữa PPSU cổ rộng", expectedCategory: "motherBaby", expectedGroup: "motherBabyHealth" },
  { sku: "MAB-002", name: "Tã quần em bé size M", expectedCategory: "motherBaby", expectedGroup: "motherBabyHealth" },
  { sku: "HEA-001", name: "Máy đo huyết áp bắp tay", expectedCategory: "healthCare", expectedGroup: "motherBabyHealth" },
  { sku: "HEA-002", name: "Vitamin tổng hợp cho người lớn", expectedCategory: "healthCare", expectedGroup: "motherBabyHealth" },
  { sku: "BKS-001", name: "Sổ planner tuần", expectedCategory: "booksStationery", expectedGroup: "booksGames" },
  { sku: "BKS-002", name: "Bút gel mực đen", expectedCategory: "booksStationery", expectedGroup: "booksGames" },
  { sku: "TOY-001", name: "Bộ LEGO lắp ráp xe", expectedCategory: "toysGames", expectedGroup: "booksGames" },
  { sku: "TOY-002", name: "Board game gia đình", expectedCategory: "toysGames", expectedGroup: "booksGames" },
  { sku: "AUT-001", name: "Giá đỡ điện thoại xe máy", expectedCategory: "autoMoto", expectedGroup: "autoMobility" },
  { sku: "AUT-002", name: "Camera hành trình ô tô", expectedCategory: "autoMoto", expectedGroup: "autoMobility" },
  { sku: "PHT-001", name: "Điện thoại Android 256GB", expectedCategory: "phoneTablet", expectedGroup: "electronicsTech" },
  { sku: "PHT-002", name: "Máy tính bảng học online", expectedCategory: "phoneTablet", expectedGroup: "electronicsTech" },
  { sku: "CPO-001", name: "Màn hình LG UltraWide 29 inch", expectedCategory: "computerOffice", expectedGroup: "electronicsTech" },
  { sku: "CPO-002", name: "Bàn phím cơ không dây", expectedCategory: "computerOffice", expectedGroup: "electronicsTech" },
  { sku: "CDR-001", name: "Camera mirrorless du lịch", expectedCategory: "cameraDrone", expectedGroup: "electronicsTech" },
  { sku: "CDR-002", name: "Drone mini quay 4K", expectedCategory: "cameraDrone", expectedGroup: "electronicsTech" },
  { sku: "HAP-001", name: "Nồi chiên không dầu 6L", expectedCategory: "homeAppliances", expectedGroup: "homeLiving" },
  { sku: "HAP-002", name: "Máy hút bụi cầm tay", expectedCategory: "homeAppliances", expectedGroup: "homeLiving" },
  { sku: "TLH-001", name: "Máy khoan pin 20V", expectedCategory: "toolsHardware", expectedGroup: "homeLiving" },
  { sku: "TLH-002", name: "Bộ tua vít đa năng", expectedCategory: "toolsHardware", expectedGroup: "homeLiving" },
  { sku: "DIG-001", name: "Gói template social media 200 mẫu", expectedCategory: "digitalGoods", expectedGroup: "other" },
  { sku: "DIG-002", name: "Voucher học online thiết kế", expectedCategory: "digitalGoods", expectedGroup: "other" }
];

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

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function summarize(results) {
  const total = results.length;
  const categoryHits = results.filter((item) => item.categoryMatched).length;
  const groupHits = results.filter((item) => item.groupMatched).length;
  const confidentCount = results.filter((item) => item.confidence >= 0.65).length;

  return {
    total,
    categoryAccuracy: total ? Number(((categoryHits / total) * 100).toFixed(2)) : 0,
    groupAccuracy: total ? Number(((groupHits / total) * 100).toFixed(2)) : 0,
    confidentRate: total ? Number(((confidentCount / total) * 100).toFixed(2)) : 0,
    categoryHits,
    groupHits,
    confidentCount
  };
}

async function runOne(item) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      lang: "vi",
      productName: item.name,
      images: []
    })
  });

  const body = await response.json().catch(() => ({}));
  assert(response.status === 200, `[${item.sku}] ${response.status}`);

  const suggestedCategory = String(body?.suggestion?.category || "other");
  const group = String(body?.suggestion?.group || CATEGORY_GROUP_MAP[suggestedCategory] || "other");
  const confidence = Number(body?.suggestion?.confidence || 0);

  const categoryMatched = suggestedCategory === item.expectedCategory;
  const groupMatched = group === item.expectedGroup;

  return {
    sku: item.sku,
    name: item.name,
    expectedCategory: item.expectedCategory,
    expectedGroup: item.expectedGroup,
    suggestedCategory,
    suggestedGroup: group || null,
    confidence,
    categoryMatched,
    groupMatched,
    generatedProductName: String(body?.suggestion?.generatedProductName || ""),
    notes: Array.isArray(body?.suggestion?.notes) ? body.suggestion.notes : []
  };
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });

  const results = [];
  for (const item of DATASET) {
    const result = await runOne(item);
    results.push(result);
    const marker = result.categoryMatched ? "OK" : "MISS";
    console.log(`[${marker}] ${item.sku} | expected=${item.expectedCategory} got=${result.suggestedCategory} | confidence=${result.confidence.toFixed(2)}`);
  }

  const summary = summarize(results);
  const report = {
    generatedAt: new Date().toISOString(),
    endpoint,
    summary,
    results
  };

  fs.writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log(`\nSaved report: ${outPath}`);
  console.log(`Category accuracy: ${summary.categoryAccuracy}% (${summary.categoryHits}/${summary.total})`);
  console.log(`Group accuracy: ${summary.groupAccuracy}% (${summary.groupHits}/${summary.total})`);
  console.log(`Confident rate (>=0.65): ${summary.confidentRate}% (${summary.confidentCount}/${summary.total})`);
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
