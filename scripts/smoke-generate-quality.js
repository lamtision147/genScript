const endpoint = process.env.SMOKE_ENDPOINT || "http://127.0.0.1:4174/api/generate";

const testCases = [
  {
    name: "fashion",
    payload: {
      lang: "vi",
      productName: "Ao so mi linen tay dai",
      category: "fashion",
      subcategory: 0,
      channel: 2,
      tone: 1,
      brandStyle: 0,
      mood: 0,
      targetCustomer: "nu van phong 24-32 tuoi",
      shortDescription: "Ao so mi linen mem, form suong nhe, mac di lam va di choi deu hop.",
      highlights: ["vai linen thoang", "form suong gon", "de phoi chan vay va quan au"],
      priceSegment: "449k",
      attributes: [
        { type: 0, value: "linen pha cotton" },
        { type: 1, value: "S-M-L" },
        { type: 2, value: "trang sua, xanh nhat" }
      ],
      sizeGuide: "S: 82-86 | M: 86-90 | L: 90-94",
      careGuide: "Giat tay hoac giat tui luoi, khong ngam lau, ui nhiet thap",
      exchangePolicy: "Ho tro doi size 1 lan neu con tem mac",
      images: [],
      improved: false
    },
    requiredPatterns: [/Bảng size|Size guide/i, /Bảo quản|Care guide/i, /Đổi trả|Exchange/i]
  },
  {
    name: "skincare",
    payload: {
      lang: "vi",
      productName: "Serum B5 phuc hoi da",
      category: "skincare",
      subcategory: 0,
      channel: 2,
      tone: 1,
      brandStyle: 2,
      mood: 1,
      targetCustomer: "da nhay cam va de kich ung",
      shortDescription: "Serum cap am va lam diu da nhanh, ket cau long nhe, tham nhanh.",
      highlights: ["tham nhanh", "khong dinh", "de dua vao routine"],
      priceSegment: "329k",
      attributes: [
        { type: 0, value: "B5, Beta-Glucan" },
        { type: 1, value: "da kho, da nhay cam" },
        { type: 3, value: "long nhe, rao nhanh" }
      ],
      usage: "Dung sau toner, truoc kem duong, sang toi deu duoc",
      skinConcern: "kho rap, do nong, thieu am",
      routineStep: "buoc serum phuc hoi",
      images: [],
      improved: false
    },
    requiredPatterns: [/Cách dùng|How to use/i, /Vấn đề da|Skin concern/i, /Routine|Bước routine/i]
  },
  {
    name: "homeAppliances",
    payload: {
      lang: "vi",
      productName: "Noi chien khong dau 6L",
      category: "homeAppliances",
      subcategory: 0,
      channel: 2,
      tone: 1,
      brandStyle: 3,
      mood: 2,
      targetCustomer: "Gia dinh 2-4 nguoi can nau nhanh",
      shortDescription: "Noi chien dung tich lon, menu ro rang, de thao tac",
      highlights: ["6L rong rai", "de ve sinh", "menu tien"],
      priceSegment: "2.190k",
      attributes: [
        { type: 0, value: "1700W" },
        { type: 1, value: "6L" },
        { type: 2, value: "ro chong dinh" }
      ],
      dimensions: "36 x 30 x 33 cm",
      usageSpace: "Bep gia dinh",
      warranty: "Bao hanh 24 thang",
      images: [],
      improved: false
    },
    requiredPatterns: [/Kích thước|Detailed dimensions/i, /Không gian phù hợp|Best space/i, /Bảo hành|Warranty/i]
  },
  {
    name: "computerOffice",
    payload: {
      lang: "vi",
      productName: "Ban phim co 84 phim",
      category: "computerOffice",
      subcategory: 0,
      channel: 1,
      tone: 1,
      brandStyle: 1,
      mood: 2,
      targetCustomer: "Dan van phong va freelancer",
      shortDescription: "Ban phim gon, go em va ket noi linh hoat",
      highlights: ["layout gon", "go em", "da ket noi"],
      priceSegment: "1.290k",
      attributes: [
        { type: 0, value: "84 phim" },
        { type: 1, value: "hot-swap" },
        { type: 2, value: "RGB nhe" }
      ],
      specs: "Bluetooth + 2.4G + USB-C",
      compatibility: "Windows, macOS",
      warranty: "Bao hanh 12 thang",
      images: [],
      improved: false
    },
    requiredPatterns: [/Thông số chính|Key specs/i, /Tương thích|Compatibility/i, /Bảo hành|Warranty/i]
  },
  {
    name: "motherBaby",
    payload: {
      lang: "vi",
      productName: "Binh sua co rong chong sac",
      category: "motherBaby",
      subcategory: 0,
      channel: 2,
      tone: 1,
      brandStyle: 2,
      mood: 1,
      targetCustomer: "Me bim can do cho be an toan",
      shortDescription: "Binh sua de ve sinh va tien dung moi ngay",
      highlights: ["chat lieu an toan", "de rua", "cam chac"],
      priceSegment: "219k",
      attributes: [
        { type: 0, value: "PPSU" },
        { type: 1, value: "160ml" },
        { type: 2, value: "num ti mem" }
      ],
      specs: "Van khi chong day hoi",
      compatibility: "Num co rong cung chuan",
      warranty: "Doi loi 7 ngay",
      images: [],
      improved: false
    },
    requiredPatterns: [/Thông số chính|Key specs/i, /Tương thích|Compatibility/i, /Bảo hành|Warranty/i]
  }
];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function runCase(testCase) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(testCase.payload)
  });

  const json = await response.json();
  assert(response.status === 200, `[${testCase.name}] status ${response.status}`);
  assert(json.source === "ai", `[${testCase.name}] source must be ai`);
  assert(Array.isArray(json.paragraphs) && json.paragraphs.length === 3, `[${testCase.name}] paragraphs must have 3 items`);
  assert(Array.isArray(json.hashtags) && json.hashtags.length >= 3, `[${testCase.name}] hashtags too short`);
  assert(json.quality && typeof json.quality.score === "number", `[${testCase.name}] quality score missing`);
  assert(json.quality.score >= 70, `[${testCase.name}] quality score too low: ${json.quality.score}`);

  const paragraph3 = String(json.paragraphs[2] || "");
  for (const pattern of testCase.requiredPatterns) {
    assert(pattern.test(paragraph3), `[${testCase.name}] paragraph3 missing ${pattern}`);
  }

  return {
    name: testCase.name,
    score: json.quality.score,
    grade: json.quality.grade,
    source: json.source
  };
}

async function main() {
  const results = [];
  for (const testCase of testCases) {
    const result = await runCase(testCase);
    results.push(result);
  }

  for (const result of results) {
    console.log(`[${result.name}] ${result.source} | ${result.grade} (${result.score})`);
  }
  console.log("Smoke test passed");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
