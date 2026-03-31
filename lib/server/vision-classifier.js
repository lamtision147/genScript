import { postJson } from "@/lib/server/ai-service";

const CATEGORY_VALUES = [
  "fashion", "skincare", "beautyTools", "home", "furnitureDecor", "electronics", "food", "householdEssentials",
  "footwear", "bags", "accessories", "fragrance", "pet", "sports", "motherBaby", "healthCare", "booksStationery",
  "toysGames", "autoMoto", "phoneTablet", "computerOffice", "cameraDrone", "homeAppliances", "toolsHardware",
  "digitalGoods", "other"
];

const CATEGORY_SCHEMA = CATEGORY_VALUES.join("|");

function compact(value = "") {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeCategory(raw = "") {
  const normalized = String(raw || "").trim();
  return CATEGORY_VALUES.includes(normalized) ? normalized : "other";
}

function normalizeGeneratedName(raw = "", lang = "vi") {
  const text = compact(raw);
  if (!text) {
    return lang === "vi" ? "Không nhận dạng tên sản phẩm được" : "Unable to identify product name";
  }
  if (/khong nhan dang|không nhận dạng|unable to identify|cannot identify|khong xac dinh|không xác định/i.test(text.normalize("NFD").replace(/\p{Diacritic}/gu, ""))) {
    return lang === "vi" ? "Không nhận dạng tên sản phẩm được" : "Unable to identify product name";
  }
  return text.replace(/[.。]+$/g, "");
}

function parseJsonObject(content = "") {
  const text = String(content || "").trim();
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export async function classifyProductFromImage({ apiBase, apiKey, model, imageDataUrl, lang = "vi" }) {
  const prompt = `You are a strict ecommerce vision classifier.

Task:
- Analyze the uploaded image and infer product identity.
- Return ONLY valid JSON.

JSON schema:
{
  "generatedProductName": "...",
  "category": "${CATEGORY_SCHEMA}",
  "confidence": 0.0,
  "notes": ["..."]
}

Rules:
- If product is identifiable, generatedProductName must be concise and market-ready.
- If ambiguous, use generatedProductName exactly: "${lang === "vi" ? "Không nhận dạng tên sản phẩm được" : "Unable to identify product name"}".
- category MUST be one of allowed category values above.
- confidence must be number in [0,1].
- Do not add any extra keys.`;

  const endpoint = `${String(apiBase || "").replace(/\/$/, "")}/chat/completions`;
  const body = {
    model,
    stream: false,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: imageDataUrl } }
        ]
      }
    ],
    response_format: { type: "json_object" }
  };

  const headers = { Authorization: `Bearer ${apiKey}` };
  const response = await postJson(endpoint, body, headers);
  const raw = response?.choices?.[0]?.message?.content || "";
  const parsed = parseJsonObject(raw);
  if (!parsed || typeof parsed !== "object") {
    return {
      generatedProductName: normalizeGeneratedName("", lang),
      category: "other",
      confidence: 0.28,
      notes: [lang === "vi" ? "Vision parser không đọc được JSON hợp lệ." : "Vision parser could not read valid JSON output."]
    };
  }

  return {
    generatedProductName: normalizeGeneratedName(parsed.generatedProductName, lang),
    category: normalizeCategory(parsed.category),
    confidence: Math.max(0, Math.min(1, Number(parsed.confidence) || 0.35)),
    notes: Array.isArray(parsed.notes) ? parsed.notes.slice(0, 4).map((item) => compact(item)).filter(Boolean) : []
  };
}
