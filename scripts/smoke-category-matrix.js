const endpoint = process.env.SMOKE_ENDPOINT || "http://127.0.0.1:4174/api/generate";
const requireAi = process.env.SMOKE_REQUIRE_AI === "1";
const minScoreAi = Number(process.env.SMOKE_MIN_SCORE_AI || 65);
const minScoreFallback = Number(process.env.SMOKE_MIN_SCORE_FALLBACK || 30);

const categories = [
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

const advancedTemplates = {
  skincare: { usage: "Dung sau toner", skinConcern: "Kho rap", routineStep: "Buoc serum" },
  beautyTools: { specs: "3 muc rung", compatibility: "Da thuong, da dau", warranty: "Bao hanh 12 thang" },
  home: { dimensions: "30 x 20 x 15 cm", usageSpace: "Phong khach", warranty: "Bao hanh 6 thang" },
  furnitureDecor: { dimensions: "45 x 20 x 18 cm", usageSpace: "Phong ngu", warranty: "Bao hanh 12 thang" },
  electronics: { specs: "Bluetooth 5.3", compatibility: "iOS, Android", warranty: "Bao hanh 12 thang" },
  householdEssentials: { usage: "Dinh luong theo huong dan", dimensions: "Hop 18 x 12 x 10 cm" },
  motherBaby: { specs: "Van khi co ban", compatibility: "Num co rong", warranty: "Doi loi 7 ngay" },
  healthCare: { specs: "Do nhanh", compatibility: "Nguoi lon", warranty: "Bao hanh 12 thang" },
  phoneTablet: { specs: "RAM 6GB", compatibility: "Android app", warranty: "Bao hanh 12 thang" },
  computerOffice: { specs: "Da ket noi", compatibility: "Windows", warranty: "Bao hanh 12 thang" },
  cameraDrone: { specs: "4K30", warranty: "Bao hanh 12 thang" },
  homeAppliances: { dimensions: "36 x 30 x 33 cm", usageSpace: "Nha bep", warranty: "Bao hanh 24 thang" },
  toolsHardware: { specs: "2 cap toc do", warranty: "Bao hanh 12 thang" },
  digitalGoods: { specs: "File tai ngay", compatibility: "Canva Web", warranty: "Ho tro 3 thang" },
  fashion: { sizeGuide: "S-M-L", careGuide: "Giat nhe", exchangePolicy: "Doi size 1 lan" }
};

function buildPayload(category) {
  return {
    lang: "vi",
    productName: `San pham test ${category}`,
    category,
    subcategory: 0,
    channel: 2,
    tone: 1,
    brandStyle: 1,
    mood: 2,
    targetCustomer: "Nguoi dung mua online",
    shortDescription: "Mo ta ngan gon, de hieu, huu ich cho nhu cau hang ngay",
    highlights: ["Noi bat 1", "Noi bat 2", "Noi bat 3"],
    priceSegment: "299k",
    attributes: [
      { type: 0, value: "Thong tin 1" },
      { type: 1, value: "Thong tin 2" },
      { type: 2, value: "Thong tin 3" }
    ],
    images: [],
    improved: false,
    variantCount: 1,
    ...(advancedTemplates[category] || {})
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runOne(category) {
  const payload = buildPayload(category);
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  assert(response.status === 200, `[${category}] status ${response.status}`);
  assert(Array.isArray(data.paragraphs) && data.paragraphs.length === 3, `[${category}] missing paragraphs`);
  assert(Array.isArray(data.hashtags) && data.hashtags.length >= 3, `[${category}] missing hashtags`);

  const source = String(data.source || "unknown");
  if (requireAi) {
    assert(source === "ai", `[${category}] expected ai source but got ${source}`);
  }

  const score = Number(data?.quality?.score ?? 0);
  const threshold = source === "ai" ? minScoreAi : minScoreFallback;
  assert(score >= threshold, `[${category}] low quality score: ${score} (source=${source}, threshold=${threshold})`);

  return {
    category,
    source,
    score,
    grade: data?.quality?.grade || "n/a"
  };
}

async function main() {
  const results = [];
  let aiCount = 0;
  let fallbackCount = 0;

  for (const category of categories) {
    const result = await runOne(category);
    results.push(result);
    if (result.source === "ai") aiCount += 1;
    if (result.source === "fallback") fallbackCount += 1;
    console.log(`[${result.category}] ${result.source} | ${result.grade} (${result.score})`);
  }

  const avg = results.reduce((sum, item) => sum + item.score, 0) / results.length;
  console.log(`Matrix passed: ${results.length} categories | avg score ${avg.toFixed(1)} | ai=${aiCount} fallback=${fallbackCount}`);
  if (!requireAi && fallbackCount > 0) {
    console.log("Note: fallback outputs detected. Set SMOKE_REQUIRE_AI=1 for strict AI-only validation.");
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
