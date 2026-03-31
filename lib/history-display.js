export function getHistoryTitle(item) {
  return item?.title || item?.form?.productName || item?.result?.title || "Item";
}

export function getHistoryMeta(item, { showSource = true, locale = "vi-VN" } = {}) {
  const parts = [];
  if (item?.variantLabel) parts.push(item.variantLabel);
  else if (item?.result?.meta) parts.push(item.result.meta);
  if (item?.result?.quality?.score) {
    parts.push(`Q:${item.result.quality.grade || "-"}${item.result.quality.score ? ` ${item.result.quality.score}` : ""}`);
  }
  if (showSource && item?.result?.source) parts.push(String(item.result.source).toUpperCase());
  if (item?.createdAt) parts.push(new Date(item.createdAt).toLocaleDateString(locale));
  return parts.join(" · ");
}
