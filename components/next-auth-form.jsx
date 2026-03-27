"use client";

import NextTextField from "@/components/next-text-field";

export default function NextAuthForm({
  mode,
  form,
  otpStep,
  message,
  debugCode,
  googleEnabled,
  loading,
  onSwitchMode,
  onFieldChange,
  onPrimarySubmit,
  onGoogleLogin
}) {
  const isResetMode = mode === "reset";
  const isVerifyStep = otpStep === "verify";

  function handleSubmit(event) {
    event.preventDefault();
    if (!loading) {
      onPrimarySubmit();
    }
  }

  return (
    <form className="content-card login-card" onSubmit={handleSubmit}>
      <div className="auth-mode-switch">
        <button type="button" className={`ghost-button ${mode === "login" ? "active" : ""}`} onClick={() => onSwitchMode("login")}>Đăng nhập</button>
        <button type="button" className={`ghost-button ${mode === "signup" ? "active" : ""}`} onClick={() => onSwitchMode("signup")}>Tạo tài khoản</button>
        <button type="button" className={`ghost-button ${isResetMode ? "active" : ""}`} onClick={() => onSwitchMode("reset")}>Quên mật khẩu</button>
      </div>
      {googleEnabled ? <button type="button" className="secondary-button login-google" onClick={onGoogleLogin}>Tiếp tục với Google</button> : null}
      {!googleEnabled ? <div className="history-empty">Google sign-in sẽ bật khi có cấu hình client ID.</div> : null}

      {isResetMode ? (
        otpStep === "request" ? (
          <>
            <NextTextField label="Email" value={form.email} onChange={(value) => onFieldChange("email", value)} placeholder="you@example.com" />
            {message ? <div className="auth-message">{message}</div> : null}
            <button type="submit" className="primary-button" disabled={loading}>{loading ? "Đang gửi..." : "Gửi OTP"}</button>
          </>
        ) : (
          <>
            <NextTextField label="Email" value={form.email} onChange={(value) => onFieldChange("email", value)} placeholder="you@example.com" />
            <NextTextField label="Mã OTP" value={form.code} onChange={(value) => onFieldChange("code", value)} placeholder="123456" />
            <NextTextField label="Mật khẩu mới" type="password" value={form.newPassword} onChange={(value) => onFieldChange("newPassword", value)} placeholder="••••••••" />
            {message ? <div className="auth-message">{message}</div> : null}
            {debugCode ? <div className="history-empty">OTP demo: {debugCode}</div> : null}
            <button type="submit" className="primary-button" disabled={loading}>{loading ? "Đang xác thực..." : "Đặt lại mật khẩu"}</button>
          </>
        )
      ) : !isVerifyStep ? (
        <>
          {mode === "signup" ? <NextTextField label="Tên hiển thị" value={form.name} onChange={(value) => onFieldChange("name", value)} placeholder="Tên hiển thị" /> : null}
          <NextTextField label="Email" value={form.email} onChange={(value) => onFieldChange("email", value)} placeholder="you@example.com" />
          <NextTextField label="Mật khẩu" type="password" value={form.password} onChange={(value) => onFieldChange("password", value)} placeholder="••••••••" />
          {message ? <div className="auth-message">{message}</div> : null}
          <button type="submit" className="primary-button" disabled={loading}>{loading ? "Đang xử lý..." : mode === "signup" ? "Gửi OTP" : "Đăng nhập"}</button>
        </>
      ) : (
        <>
          <NextTextField label="Email" value={form.email} onChange={(value) => onFieldChange("email", value)} placeholder="you@example.com" />
          <NextTextField label="Mã OTP" value={form.code} onChange={(value) => onFieldChange("code", value)} placeholder="123456" />
          {message ? <div className="auth-message">{message}</div> : null}
          {debugCode ? <div className="history-empty">OTP demo: {debugCode}</div> : null}
          <button type="submit" className="primary-button" disabled={loading}>{loading ? "Đang xác thực..." : "Xác thực OTP"}</button>
        </>
      )}
    </form>
  );
}
