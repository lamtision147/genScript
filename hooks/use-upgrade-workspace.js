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
    cvc: ""
  };
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

export function useUpgradeWorkspace(language = "vi") {
  const { session, setSession } = useAuthBootstrap();
  const [planInfo, setPlanInfo] = useState(null);
  const [paymentProvider, setPaymentProvider] = useState("mock");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [message, setMessage] = useState("");
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
      setPaymentProvider(planData?.payment?.provider || "mock");
    } catch (error) {
      setMessage(error?.message || (isVi ? "Không thể tải thông tin gói." : "Unable to load plan information."));
    } finally {
      setLoadingPlan(false);
    }
  }

  useEffect(() => {
    refreshPlan();
  }, [language]);

  async function submitUpgrade() {
    const validationError = validateCardForm(cardForm, language);
    if (validationError) {
      setMessage(validationError);
      return;
    }

    setProcessing(true);
    setMessage("");
    try {
      const data = await apiPost(routes.api.billingUpgrade, {
        cardHolder: String(cardForm.cardHolder || "").trim(),
        cardNumber: sanitizeCardNumber(cardForm.cardNumber),
        expiry: sanitizeExpiry(cardForm.expiry),
        cvc: sanitizeCvc(cardForm.cvc)
      });

      setPlanInfo(data?.planInfo || null);
      const sessionData = await apiGet(routes.api.session, { user: null });
      setSession(sessionData?.user || null);
      setCardForm(initialCardForm());
      setMessage(isVi ? "Thanh toán thành công. Tài khoản đã nâng cấp Pro." : "Payment successful. Your account is now Pro.");
    } catch (error) {
      setMessage(error?.message || (isVi ? "Thanh toán thất bại." : "Payment failed."));
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
      return { ...prev, [key]: value };
    });
  }

  return {
    session,
    planInfo,
    paymentProvider,
    loadingPlan,
    processing,
    cancelling,
    message,
    cardForm,
    isPro,
    actions: {
      refreshPlan,
      submitUpgrade,
      cancelProPlan,
      updateCardField,
      setMessage
    }
  };
}
