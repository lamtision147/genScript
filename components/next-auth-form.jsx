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
      {googleEnabled ? <button type="button" className="secondary-button login-google" onClick={onGoogleLogin}>{copy.auth.continueGoogle}</button> : null}
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
