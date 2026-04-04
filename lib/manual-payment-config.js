export const MANUAL_PRO_PAYMENT = {
  bankCode: "NAB",
  bankName: "Nam A Bank",
  accountNumber: "707300240600001",
  accountName: "TRAN PHUONG VU",
  amount: 129000,
  currency: "VND"
};

export function sanitizeTransferRef(value = "") {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32).toUpperCase();
}

export function buildUpgradeTransferNote(transferRef = "") {
  const normalized = sanitizeTransferRef(transferRef);
  return normalized ? `PRO ${normalized}` : "PRO UPGRADE";
}

export function buildVietQrImageUrl({ amount, transferRef }) {
  const safeAmount = Math.max(1000, Math.floor(Number(amount || MANUAL_PRO_PAYMENT.amount) || MANUAL_PRO_PAYMENT.amount));
  const params = new URLSearchParams({
    amount: String(safeAmount),
    addInfo: buildUpgradeTransferNote(transferRef),
    accountName: MANUAL_PRO_PAYMENT.accountName
  });
  return `https://img.vietqr.io/image/${MANUAL_PRO_PAYMENT.bankCode}-${MANUAL_PRO_PAYMENT.accountNumber}-compact2.jpg?${params.toString()}`;
}
