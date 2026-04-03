"use client";

import NextTextField from "@/components/next-text-field";
import { getCopy } from "@/lib/i18n";

export default function NextAuthForm({
  mode,
  form,
  otpStep,
  message,
  debugCode,
  googleEnabled,
  loading,
  language = "vi",
  onSwitchMode,
  onFieldChange,
  onPrimarySubmit,
  onGoogleLogin
}) {
  const isResetMode = mode === "reset";
  const isVerifyStep = otpStep === "verify";
  const copy = getCopy(language);

  function handleSubmit(event) {
    event.preventDefault();
    if (!loading) {
      onPrimarySubmit();
    }
  }

  return (
    <form className="content-card login-card" onSubmit={handleSubmit}>
      <div className="auth-mode-switch">
        <button type="button" className={`ghost-button ${mode === "login" ? "active" : ""}`} onClick={() => onSwitchMode("login")}>{copy.auth.login}</button>
        <button type="button" className={`ghost-button ${mode === "signup" ? "active" : ""}`} onClick={() => onSwitchMode("signup")}>{copy.auth.signup}</button>
        <button type="button" className={`ghost-button ${isResetMode ? "active" : ""}`} onClick={() => onSwitchMode("reset")}>{copy.auth.resetPassword}</button>
      </div>
      {googleEnabled ? (
        <button type="button" className="secondary-button login-google" onClick={onGoogleLogin} disabled={loading}>
          <span className="login-google-icon" aria-hidden="true">
            <svg viewBox="0 0 18 18" focusable="false" aria-hidden="true">
              <path fill="#EA4335" d="M9 3.48c1.69 0 2.84.73 3.49 1.34l2.54-2.54C13.46.83 11.42 0 9 0 5.48 0 2.44 2.02.96 4.96l2.96 2.3C4.62 5.23 6.64 3.48 9 3.48z" />
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.12-.84 2.07-1.8 2.71v2.25h2.91c1.7-1.57 2.69-3.88 2.69-6.6z" />
              <path fill="#FBBC05" d="M3.92 10.74c-.18-.54-.28-1.12-.28-1.74s.1-1.2.28-1.74V5.01H.96A8.996 8.996 0 000 9c0 1.45.35 2.82.96 3.99l2.96-2.25z" />
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.17l-2.91-2.25c-.81.54-1.85.86-3.05.86-2.35 0-4.36-1.59-5.08-3.73L.96 13.0C2.44 15.98 5.48 18 9 18z" />
            </svg>
          </span>
          <span className="login-google-label">{copy.auth.continueGoogle}</span>
        </button>
      ) : null}
      {!googleEnabled ? <div className="history-empty">{copy.auth.googleUnavailable}</div> : null}

      {isResetMode ? (
        otpStep === "request" ? (
            <>
            <NextTextField label={copy.auth.email} value={form.email} onChange={(value) => onFieldChange("email", value)} placeholder="you@example.com" />
            {message ? <div className="auth-message">{message}</div> : null}
            <button type="submit" className="primary-button" disabled={loading}>{loading ? copy.auth.sending : copy.auth.sendOtp}</button>
          </>
        ) : (
          <>
            <NextTextField label={copy.auth.email} value={form.email} onChange={(value) => onFieldChange("email", value)} placeholder="you@example.com" />
            <NextTextField label={copy.auth.otpCode} value={form.code} onChange={(value) => onFieldChange("code", value)} placeholder="123456" />
            <NextTextField label={copy.auth.newPassword} type="password" value={form.newPassword} onChange={(value) => onFieldChange("newPassword", value)} placeholder="••••••••" />
            {message ? <div className="auth-message">{message}</div> : null}
            {debugCode ? <div className="history-empty">{copy.auth.otpDemoPrefix}: {debugCode}</div> : null}
            <button type="submit" className="primary-button" disabled={loading}>{loading ? copy.auth.verifying : copy.auth.resetPasswordAction}</button>
          </>
        )
      ) : !isVerifyStep ? (
        <>
          {mode === "signup" ? <NextTextField label={copy.auth.displayName} value={form.name} onChange={(value) => onFieldChange("name", value)} placeholder={copy.auth.displayName} /> : null}
          <NextTextField label={copy.auth.email} value={form.email} onChange={(value) => onFieldChange("email", value)} placeholder="you@example.com" />
          <NextTextField label={copy.auth.password} type="password" value={form.password} onChange={(value) => onFieldChange("password", value)} placeholder="••••••••" />
          {message ? <div className="auth-message">{message}</div> : null}
          <button type="submit" className="primary-button" disabled={loading}>{loading ? copy.auth.processing : mode === "signup" ? copy.auth.sendOtp : copy.auth.submitLogin}</button>
        </>
      ) : (
        <>
          <NextTextField label={copy.auth.email} value={form.email} onChange={(value) => onFieldChange("email", value)} placeholder="you@example.com" />
          <NextTextField label={copy.auth.otpCode} value={form.code} onChange={(value) => onFieldChange("code", value)} placeholder="123456" />
          {message ? <div className="auth-message">{message}</div> : null}
          {debugCode ? <div className="history-empty">{copy.auth.otpDemoPrefix}: {debugCode}</div> : null}
          <button type="submit" className="primary-button" disabled={loading}>{loading ? copy.auth.verifying : copy.auth.verifyOtp}</button>
        </>
      )}
    </form>
  );
}
