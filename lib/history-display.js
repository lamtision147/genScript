export function getHistoryTitle(item) {
  return item?.title || item?.form?.productName || "Untitled";
}

export function getHistoryMeta(item, { showSource = true } = {}) {
  const parts = [];
  if (item?.variantLabel) parts.push(item.variantLabel);
  else if (item?.result?.meta) parts.push(item.result.meta);
  if (showSource && item?.result?.source) parts.push(String(item.result.source).toUpperCase());
  if (item?.createdAt) parts.push(new Date(item.createdAt).toLocaleDateString("vi-VN"));
  return parts.join(" · ");
}
