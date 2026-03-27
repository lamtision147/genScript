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
    images: []
  };
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
    images: item.images || []
  };
}
