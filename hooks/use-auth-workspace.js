"use client";

import { useState } from "react";
import { useAuthBootstrap } from "@/hooks/use-auth-bootstrap";
import { apiPost } from "@/lib/client/api";
import { routes } from "@/lib/routes";
import { getCopy, localizeKnownMessage } from "@/lib/i18n";

function safeText(value) {
  return String(value || "").trim();
}

function normalizeEmail(value) {
  return safeText(value).toLowerCase();
}

function validateAuthInput(mode, step, form, copy) {
  const email = normalizeEmail(form.email);
  const password = safeText(form.password);
  const code = safeText(form.code);
  const newPassword = safeText(form.newPassword);
  const name = safeText(form.name);

  if (mode === "login") {
    if (!email) return copy.messages.enterEmail;
    if (!password) return copy.messages.enterPassword;
    return "";
  }

  if (mode === "signup") {
    if (step === "request") {
      if (!name) return copy.messages.enterDisplayName;
      if (!email) return copy.messages.enterEmail;
      if (password.length < 6) return copy.messages.pwdMin6;
      return "";
    }

    if (!email) return copy.messages.enterEmail;
    if (!code) return copy.messages.enterOtp;
    return "";
  }

  if (step === "request") {
    if (!email) return copy.messages.enterEmail;
    return "";
  }

  if (!email) return copy.messages.enterEmail;
  if (!code) return copy.messages.enterOtp;
  if (newPassword.length < 6) return copy.messages.newPwdMin6;
  return "";
}

export function useAuthWorkspace(language = "vi") {
  const { session, authConfig } = useAuthBootstrap();
  const copy = getCopy(language);
  const [mode, setMode] = useState("login");
  const [form, setForm] = useState({ name: "", email: "", password: "", code: "", newPassword: "" });
  const [message, setMessage] = useState("");
  const [otpStep, setOtpStep] = useState("request");
  const [debugCode, setDebugCode] = useState("");
  const [loading, setLoading] = useState(false);

  async function submitPrimary() {
    const validationMessage = validateAuthInput(mode, otpStep, form, copy);
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
          if (data.emailSent) {
            setMessage(copy.messages.otpSent);
          } else if (data.debugCode) {
            setMessage(`${copy.auth.otpDemoPrefix}: ${data.debugCode}`);
          } else {
            setMessage(copy.messages.otpFallbackNoDebug || copy.messages.genericError);
          }
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
        if (data.emailSent) {
          setMessage(copy.messages.resetOtpSent);
        } else if (data.debugCode) {
          setMessage(`${copy.auth.otpDemoPrefix}: ${data.debugCode}`);
        } else {
          setMessage(copy.messages.otpFallbackNoDebug || copy.messages.genericError);
        }
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
      setMessage(copy.messages.resetSuccess);
    } catch (error) {
      const raw = error.message || copy.messages.genericError;
      setMessage(localizeKnownMessage(raw, copy) || raw);
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
