"use client";

import { useState } from "react";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";
import { apiPost } from "@/lib/client/api";
import { routes } from "@/lib/routes";

function safeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return safeText(value).toLowerCase();
}

function validateAuthInput(mode, step, form) {
  const email = normalizeEmail(form.email);
  const password = safeText(form.password);
  const code = safeText(form.code);
  const newPassword = safeText(form.newPassword);
  const name = safeText(form.name);

  if (mode === "login") {
    if (!email) return "Vui lòng nhập email.";
    if (!password) return "Vui lòng nhập mật khẩu.";
    return "";
  }

  if (mode === "signup") {
    if (step === "request") {
      if (!name) return "Vui lòng nhập tên hiển thị.";
      if (!email) return "Vui lòng nhập email.";
      if (password.length < 6) return "Mật khẩu cần ít nhất 6 ký tự.";
      return "";
    }

    if (!email) return "Vui lòng nhập email.";
    if (!code) return "Vui lòng nhập mã OTP.";
    return "";
  }

  if (step === "request") {
    if (!email) return "Vui lòng nhập email.";
    return "";
  }

  if (!email) return "Vui lòng nhập email.";
  if (!code) return "Vui lòng nhập mã OTP.";
  if (newPassword.length < 6) return "Mật khẩu mới cần ít nhất 6 ký tự.";
  return "";
}

export function useAuthWorkspace() {
  const { session, authConfig } = useAuthBootstrap();
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", code: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [otpStep, setOtpStep] = useState("request");
  const [debugCode, setDebugCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitPrimary() {
    const validationMessage = validateAuthInput(mode, otpStep, form);
    if (validationMessage) {
      setMessage(validationMessage);
      return;
    }

    setLoading(true);
    try {
      if (mode === "login") {
        await apiPost(routes.api.loginPassword, {
          email: normalizeEmail(form.email),
          password: safeText(form.password)
        });
        window.location.href = routes.scriptProductInfo;
        return;
      }

      if (mode === "signup") {
        if (otpStep === "request") {
          const data = await apiPost(routes.api.requestOtp, {
            name: safeText(form.name),
            email: normalizeEmail(form.email),
            password: safeText(form.password)
          });
          setOtpStep("verify");
          setDebugCode(data.debugCode || "");
          setMessage(data.emailSent ? "OTP đã được gửi đến email của bạn." : `OTP demo: ${data.debugCode}`);
          return;
        }

        await apiPost(routes.api.verifyOtp, {
          email: normalizeEmail(form.email),
          code: safeText(form.code)
        });
        window.location.href = routes.scriptProductInfo;
        return;
      }

      if (otpStep === "request") {
        const data = await apiPost(routes.api.requestPasswordReset, {
          email: normalizeEmail(form.email)
        });
        setOtpStep("verify");
        setDebugCode(data.debugCode || "");
        setMessage(data.emailSent ? "OTP đặt lại mật khẩu đã được gửi." : `OTP demo: ${data.debugCode}`);
        return;
      }

      await apiPost(routes.api.verifyPasswordReset, {
        email: normalizeEmail(form.email),
        code: safeText(form.code),
        newPassword: safeText(form.newPassword)
      });
      setMode("login");
      setOtpStep("request");
      setForm((prev) => ({ ...prev, code: "", newPassword: "", password: "" }));
      setMessage("Đặt lại mật khẩu thành công. Bạn có thể đăng nhập ngay.");
    } catch (error) {
      setMessage(error.message || "Đã xảy ra lỗi.");
    } finally {
      setLoading(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setOtpStep("request");
    setMessage("");
    setDebugCode("");
    setForm((prev) => ({
      ...prev,
      password: "",
      code: "",
      newPassword: ""
    }));
  }

  return {
    session,
    authConfig,
    mode,
    form,
    message,
    otpStep,
    debugCode,
    loading,
    actions: {
      submitPrimary,
      switchMode,
      setForm,
      googleLogin: () => {
        window.location.href = "/api/auth/google/start";
      }
    }
  };
}
