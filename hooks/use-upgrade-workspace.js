"use client";

import { useEffect, useState } from "react";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";
import { apiGet, apiPost } from "@/lib/client/api";
import { routes } from "@/lib/routes";

function initialCardForm() {
  return {
    cardHolder: "",
    cardNumber: "",
    expiry: "",
    cvc: "",
    payerName: "",
    transferRef: ""
  };
}

const INTERNAL_METHOD_VALUES = new Set(["card", "bank_transfer", "momo", "zalopay"]);

function normalizeGateway(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "stripe") return "stripe";
  if (raw === "internal") return "internal";
  return "";
}

function sanitizeCardNumber(value = "") {
  return String(value || "").replace(/\D+/g, "").slice(0, 19);
}

function sanitizeExpiry(value = "") {
  const digits = String(value || "").replace(/\D+/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function sanitizeCvc(value = "") {
  return String(value || "").replace(/\D+/g, "").slice(0, 4);
}

function sanitizeTransferRef(value = "") {
  return String(value || "").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32).toUpperCase();
}

function normalizeInternalPaymentMethod(value = "") {
  const raw = String(value || "").trim().toLowerCase();
  return INTERNAL_METHOD_VALUES.has(raw) ? raw : "card";
}

function validateCardForm(form, language = "vi") {
  const isVi = language === "vi";
  const holder = String(form.cardHolder || "").trim();
  const cardNumber = sanitizeCardNumber(form.cardNumber);
  const expiry = sanitizeExpiry(form.expiry);
  const cvc = sanitizeCvc(form.cvc);

  if (!holder) return isVi ? "Vui lòng nhập tên chủ thẻ." : "Please enter card holder name.";
  if (cardNumber.length < 13) return isVi ? "Số thẻ không hợp lệ." : "Invalid card number.";
  if (!/^\d{2}\/\d{2}$/.test(expiry)) return isVi ? "Ngày hết hạn không hợp lệ (MM/YY)." : "Invalid expiry date (MM/YY).";
  if (cvc.length < 3) return isVi ? "Mã CVC không hợp lệ." : "Invalid CVC.";
  return "";
}

function validateInternalPaymentForm(form, method = "card", language = "vi") {
  const isVi = language === "vi";
  const normalizedMethod = normalizeInternalPaymentMethod(method);
  if (normalizedMethod === "card") {
    return validateCardForm(form, language);
  }

  const payerName = String(form?.payerName || "").trim();
  const transferRef = sanitizeTransferRef(form?.transferRef || "");
  if (!payerName) {
    return isVi ? "Vui lòng nhập tên người chuyển khoản/thanh toán." : "Please enter payer name.";
  }
  if (transferRef.length < 6) {
    return isVi ? "Vui lòng nhập mã giao dịch hợp lệ (ít nhất 6 ký tự)." : "Please enter a valid transaction reference (at least 6 characters).";
  }
  return "";
}

export function useUpgradeWorkspace(language = "vi") {
  const { session, setSession } = useAuthBootstrap();
  const [planInfo, setPlanInfo] = useState(null);
  const [paymentProvider, setPaymentProvider] = useState("mock");
  const [selectedGateway, setSelectedGateway] = useState("");
  const [internalPaymentMethod, setInternalPaymentMethod] = useState("card");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [successPopupOpen, setSuccessPopupOpen] = useState(false);
  const [successPopupMessage, setSuccessPopupMessage] = useState("");
  const [cardForm, setCardForm] = useState(initialCardForm);

  const isVi = language === "vi";
  const isPro = String(planInfo?.plan || session?.plan || "free") === "pro";

  async function refreshPlan() {
    setLoadingPlan(true);
    try {
      const [sessionData, planData] = await Promise.all([
        apiGet(routes.api.session, { user: null }),
        apiGet(routes.api.billingPlan, { planInfo: null })
      ]);

      setSession(sessionData?.user || null);
      setPlanInfo(planData?.planInfo || null);
      const provider = normalizeGateway(planData?.payment?.provider || "internal");
      setPaymentProvider(provider === "stripe" ? "stripe" : "mock");
      setSelectedGateway((prev) => normalizeGateway(prev));
    } catch (error) {
      setMessage(error?.message || (isVi ? "Không thể tải thông tin gói." : "Unable to load plan information."));
    } finally {
      setLoadingPlan(false);
    }
  }

  useEffect(() => {
    refreshPlan();
  }, [language]);

  useEffect(() => {
    if (selectedGateway === "stripe" && paymentProvider !== "stripe") {
      setSelectedGateway("");
    }
  }, [paymentProvider, selectedGateway]);

  useEffect(() => {
    if (selectedGateway === "stripe") {
      setInternalPaymentMethod("card");
      setCardForm((prev) => ({
        ...prev,
        payerName: "",
        transferRef: ""
      }));
    }
  }, [selectedGateway]);

  useEffect(() => {
    if (!cancelConfirmOpen) return undefined;
    const onEsc = (event) => {
      if (event.key === "Escape") {
        setCancelConfirmOpen(false);
      }
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [cancelConfirmOpen]);

  async function submitUpgrade() {
    const normalizedMethod = normalizeInternalPaymentMethod(internalPaymentMethod);
    const validationError = validateInternalPaymentForm(cardForm, normalizedMethod, language);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setProcessing(true);
    setMessage("");
    try {
      const data = await apiPost(routes.api.billingUpgrade, {
        method: normalizedMethod,
        cardHolder: String(cardForm.cardHolder || "").trim(),
        cardNumber: sanitizeCardNumber(cardForm.cardNumber),
        expiry: sanitizeExpiry(cardForm.expiry),
        cvc: sanitizeCvc(cardForm.cvc),
        payerName: String(cardForm.payerName || "").trim(),
        transferRef: sanitizeTransferRef(cardForm.transferRef)
      });

      setPlanInfo(data?.planInfo || null);
      const sessionData = await apiGet(routes.api.session, { user: null });
      setSession(sessionData?.user || null);
      setCardForm(initialCardForm());
      setInternalPaymentMethod("card");
      const successMsg = isVi ? "Thanh toán thành công. Tài khoản đã nâng cấp Pro." : "Payment successful. Your account is now Pro.";
      setMessage(successMsg);
      setSuccessPopupMessage(successMsg);
      setSuccessPopupOpen(true);
    } catch (error) {
      setMessage(error?.message || (isVi ? "Thanh toán thất bại." : "Payment failed."));
    } finally {
      setProcessing(false);
    }
  }

  async function startStripeCheckout() {
    setProcessing(true);
    setMessage("");
    try {
      const data = await apiPost(routes.api.billingCreateCheckoutSession, {
        language
      });
      const checkoutUrl = String(data?.checkoutUrl || "").trim();
      if (!checkoutUrl) {
        throw new Error(isVi ? "Không tạo được phiên Stripe checkout." : "Unable to create Stripe checkout session.");
      }
      window.location.href = checkoutUrl;
    } catch (error) {
      setMessage(error?.message || (isVi ? "Không thể chuyển sang Stripe lúc này." : "Unable to redirect to Stripe right now."));
      setProcessing(false);
    }
  }

  async function confirmStripeCheckout(sessionId) {
    const normalizedSessionId = String(sessionId || "").trim();
    if (!normalizedSessionId) return;
    setProcessing(true);
    try {
      const data = await apiPost(routes.api.billingConfirmCheckout, {
        sessionId: normalizedSessionId
      });
      setPlanInfo(data?.planInfo || null);
      const sessionData = await apiGet(routes.api.session, { user: null });
      setSession(sessionData?.user || null);
      const successMsg = isVi ? "Thanh toán Stripe thành công. Tài khoản đã nâng cấp Pro." : "Stripe payment successful. Your account is now Pro.";
      setMessage(successMsg);
      setSuccessPopupMessage(successMsg);
      setSuccessPopupOpen(true);
    } catch (error) {
      setMessage(error?.message || (isVi ? "Không xác nhận được thanh toán Stripe." : "Unable to confirm Stripe payment."));
    } finally {
      setProcessing(false);
    }
  }

  async function cancelProPlan() {
    if (!isPro) return;
    setCancelling(true);
    setMessage("");
    try {
      const data = await apiPost(routes.api.billingCancel, {});
      setPlanInfo(data?.planInfo || null);
      const sessionData = await apiGet(routes.api.session, { user: null });
      setSession(sessionData?.user || null);
      setMessage(isVi ? "Đã hủy gói Pro, tài khoản quay về Free." : "Pro plan cancelled. Your account is now Free.");
    } catch (error) {
      setMessage(error?.message || (isVi ? "Không thể hủy gói lúc này." : "Unable to cancel plan right now."));
    } finally {
      setCancelling(false);
    }
  }

  function requestCancelProPlan() {
    setCancelConfirmOpen(true);
  }

  function closeCancelConfirm() {
    setCancelConfirmOpen(false);
  }

  async function confirmCancelProPlan() {
    await cancelProPlan();
    setCancelConfirmOpen(false);
  }

  function updateCardField(key, value) {
    setCardForm((prev) => {
      if (key === "cardNumber") {
        return { ...prev, cardNumber: sanitizeCardNumber(value) };
      }
      if (key === "expiry") {
        return { ...prev, expiry: sanitizeExpiry(value) };
      }
      if (key === "cvc") {
        return { ...prev, cvc: sanitizeCvc(value) };
      }
      if (key === "transferRef") {
        return { ...prev, transferRef: sanitizeTransferRef(value) };
      }
      return { ...prev, [key]: value };
    });
  }

  return {
    session,
    planInfo,
    paymentProvider,
    selectedGateway,
    internalPaymentMethod,
    loadingPlan,
    processing,
    cancelling,
    cancelConfirmOpen,
    message,
    successPopupOpen,
    successPopupMessage,
    cardForm,
    isPro,
    actions: {
      refreshPlan,
      submitUpgrade,
      startStripeCheckout,
      confirmStripeCheckout,
      cancelProPlan,
      requestCancelProPlan,
      closeCancelConfirm,
      confirmCancelProPlan,
      updateCardField,
      setPaymentGateway: (value) => {
        const next = normalizeGateway(value);
        if (!next) {
          setSelectedGateway("");
          return;
        }
        if (next === "stripe" && paymentProvider !== "stripe") {
          setSelectedGateway("");
          return;
        }
        setSelectedGateway(next);
      },
      setInternalPaymentMethod: (value) => {
        setInternalPaymentMethod(normalizeInternalPaymentMethod(value));
      },
      setMessage,
      closeSuccessPopup: () => setSuccessPopupOpen(false)
    }
  };
}
