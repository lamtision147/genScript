const CSV_HEADERS = [
  "productName",
  "category",
  "subcategory",
  "targetCustomer",
  "shortDescription",
  "highlights",
  "attributes",
  "priceSegment"
];

const CSV_HEADERS_VI = [
  "tenSanPham",
  "danhMuc",
  "dongSanPham",
  "khachHangMucTieu",
  "moTaNgan",
  "diemNoiBat",
  "thuocTinh",
  "phanKhucGia"
];

const VI_KEY_MAP = {
  tenSanPham: "productName",
  danhMuc: "category",
  dongSanPham: "subcategory",
  khachHangMucTieu: "targetCustomer",
  moTaNgan: "shortDescription",
  diemNoiBat: "highlights",
  thuocTinh: "attributes",
  phanKhucGia: "priceSegment"
};

export function buildCsvTemplate(language = "en") {
  const isVi = String(language || "").toLowerCase().trim() === "vi";
  if (isVi) {
    const sampleVi = [
      "Áo thun cổ tròn",
      "fashion",
      "0",
      "Sinh viên, nhân viên văn phòng trẻ",
      "Áo thun cotton co giãn 4 chiều, mặc thoải mái cả ngày",
      "Mềm mịn|Dễ phối đồ|Thoáng khí",
      "Cotton 4 chiều|S-XL|Trắng đen",
      "Dưới 300k"
    ];
    return `${CSV_HEADERS_VI.join(",")}\n${sampleVi.join(",")}`;
  }

  const sample = [
    "Basic crew-neck t-shirt",
    "fashion",
    "0",
    "Students and young office workers",
    "4-way stretch cotton t-shirt for all-day comfort",
    "Soft feel|Easy to style|Breathable",
    "4-way cotton|S-XL|White black",
    "Under 300k"
  ];
  return `${CSV_HEADERS.join(",")}\n${sample.join(",")}`;
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === "," && !inQuotes) {
      out.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((item) => String(item || "").trim());
}

export function parseCsvText(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return [];
  }

  const headers = splitCsvLine(lines[0]);
  const normalizedHeaders = headers.map((header) => VI_KEY_MAP[header] || header);
  const rows = [];
  for (const line of lines.slice(1)) {
    const cells = splitCsvLine(line);
    const row = {};
    normalizedHeaders.forEach((header, idx) => {
      row[header] = cells[idx] || "";
    });
    rows.push(row);
  }

  return rows;
}

export function normalizeBulkRows(rows = []) {
  return rows
    .map((row) => {
      const highlights = String(row.highlights || "")
        .split(/[|\n;]/)
        .map((item) => item.trim())
        .filter(Boolean);

      const attributes = String(row.attributes || "")
        .split(/[|\n;]/)
        .map((value, idx) => ({ type: idx, value: value.trim() }))
        .filter((item) => item.value);

      return {
        productName: String(row.productName || "").trim(),
        category: String(row.category || "other").trim() || "other",
        subcategory: Number.isFinite(Number(row.subcategory)) ? Number(row.subcategory) : 0,
        targetCustomer: String(row.targetCustomer || "").trim(),
        shortDescription: String(row.shortDescription || "").trim(),
        highlights,
        attributes,
        priceSegment: String(row.priceSegment || "").trim()
      };
    })
    .filter((row) => row.productName);
}

export function buildBulkResultCsv(results = []) {
  const headers = ["productName", "source", "quality", "headline", "paragraph1", "hashtags"];
  const lines = [headers.join(",")];
  for (const item of results) {
    const row = [
      item.productName || "",
      item.source || "",
      item.quality || "",
      item.headline || "",
      item.paragraph1 || "",
      item.hashtags || ""
    ].map((value) => `"${String(value || "").replace(/"/g, '""')}"`);
    lines.push(row.join(","));
  }
  return lines.join("\n");
}
