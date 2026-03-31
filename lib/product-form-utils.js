export function createEmptyProductForm() {
  return {
    productName: "",
    category: "fashion",
    subcategory: 0,
    channel: 2,
    tone: 0,
    brandStyle: 0,
    mood: 0,
    targetCustomer: "",
    shortDescription: "",
    highlights: "",
    priceSegment: "",
    attributes: "",
    usage: "",
    skinConcern: "",
    routineStep: "",
    dimensions: "",
    warranty: "",
    usageSpace: "",
    specs: "",
    compatibility: "",
    sizeGuide: "",
    careGuide: "",
    exchangePolicy: "",
    industryPreset: "",
    images: []
  };
}

const FASHION_GROUP = new Set(["fashion"]);
const SKINCARE_GROUP = new Set(["skincare", "beautyTools"]);
const HOME_GROUP = new Set(["home", "furnitureDecor", "homeAppliances", "toolsHardware", "householdEssentials"]);
const ELECTRONICS_GROUP = new Set(["electronics", "motherBaby", "healthCare", "phoneTablet", "computerOffice", "cameraDrone", "autoMoto", "digitalGoods"]);

export function getAdvancedFieldGroup(category) {
  const key = String(category || "").trim();
  if (SKINCARE_GROUP.has(key)) return "skincare";
  if (HOME_GROUP.has(key)) return "home";
  if (ELECTRONICS_GROUP.has(key)) return "electronics";
  if (FASHION_GROUP.has(key)) return "fashion";
  return "none";
}

export function normalizeAttributesText(attributes = []) {
  return (attributes || []).map((attr) => attr.value).join("\n");
}

export function normalizeHighlightsText(highlights = []) {
  return (highlights || []).join("\n");
}

export function serializeAttributesText(text = "") {
  return String(text)
    .split("\n")
    .map((value, index) => ({ type: index, value }))
    .filter((item) => item.value.trim());
}

export function serializeHighlightsText(text = "") {
  return String(text)
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
}

export function restoreProductFormFromHistoryItem(item) {
  const form = item.form || {};
  const advancedFields = form.advancedFields || {};
  return {
    productName: form.productName || "",
    category: form.category || "fashion",
    subcategory: form.subcategory || 0,
    channel: Number.isInteger(form.channel) ? form.channel : 2,
    shortDescription: form.shortDescription || "",
    tone: form.tone || 0,
    brandStyle: form.brandStyle || 0,
    mood: form.mood || 0,
    targetCustomer: form.targetCustomer || "",
    highlights: Array.isArray(form.highlights)
      ? normalizeHighlightsText(form.highlights)
      : (form.highlights || ""),
    priceSegment: form.priceSegment || "",
    attributes: normalizeAttributesText(form.attributes || []),
    usage: form.usage || advancedFields.usage || "",
    skinConcern: form.skinConcern || advancedFields.skinConcern || "",
    routineStep: form.routineStep || advancedFields.routineStep || "",
    dimensions: form.dimensions || advancedFields.dimensions || "",
    warranty: form.warranty || advancedFields.warranty || "",
    usageSpace: form.usageSpace || advancedFields.usageSpace || "",
    specs: form.specs || advancedFields.specs || "",
    compatibility: form.compatibility || advancedFields.compatibility || "",
    sizeGuide: form.sizeGuide || advancedFields.sizeGuide || "",
    careGuide: form.careGuide || advancedFields.careGuide || "",
    exchangePolicy: form.exchangePolicy || advancedFields.exchangePolicy || "",
    industryPreset: form.industryPreset || "",
    images: item.images || []
  };
}
