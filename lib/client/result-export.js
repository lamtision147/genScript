export async function copyResultText(result) {
  if (!result) return;
  const text = [...(result.paragraphs || []), ...(result.hashtags?.length ? [result.hashtags.join(" ")] : [])].join("\n\n");
  await navigator.clipboard.writeText(text);
}

export function downloadResultDoc(result, productName) {
  if (!result) return;
  const html = `<!doctype html><html><body><h1>${productName || "Nội dung mô tả sản phẩm"}</h1>${(result.paragraphs || []).map((p) => `<p>${p}</p>`).join("")}${result.hashtags?.length ? `<p>${result.hashtags.join(" ")}</p>` : ""}</body></html>`;
  const blob = new Blob([html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${(productName || "product-description").replace(/\s+/g, "-")}.doc`;
  link.click();
  URL.revokeObjectURL(url);
}
