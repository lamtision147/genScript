"use client";

import NextShellHeader from "@/components/next-shell-header";
import NextAuthForm from "@/components/next-auth-form";
import { useAuthWorkspace } from "@/hooks/use-auth-workspace";
import NextPageFrame from "@/components/next-page-frame";
import { uiCopy } from "@/lib/ui-copy";

export default function NextLoginPage() {
  const { session, authConfig, mode, form, message, otpStep, debugCode, loading, actions } = useAuthWorkspace();

  return (
    <NextPageFrame>
      <section className="panel full-span">
        <NextShellHeader
          eyebrow="Seller Studio / Access"
          title={uiCopy.auth.login}
          subtitle={uiCopy.auth.loginSubtitle}
          user={session}
          insightTitle="OTP + Password"
          insightText="Lần đầu tạo tài khoản dùng OTP. Những lần sau có thể đăng nhập nhanh bằng email và mật khẩu."
        />
        <section className="login-shell">
          <div className="login-hero">
            <span className="brand-eyebrow">Seller Studio</span>
            <h2 className="page-title login-title">{uiCopy.auth.login}</h2>
            <p className="page-subtitle">{uiCopy.auth.loginSubtitle}</p>
          </div>
          <NextAuthForm
            mode={mode}
            form={form}
            otpStep={otpStep}
            message={message}
            debugCode={debugCode}
            googleEnabled={authConfig.googleEnabled}
            loading={loading}
            onSwitchMode={actions.switchMode}
            onFieldChange={(key, value) => actions.setForm((prev) => ({ ...prev, [key]: value }))}
            onPrimarySubmit={actions.submitPrimary}
            onGoogleLogin={actions.googleLogin}
          />
        </section>
      </section>
    </NextPageFrame>
  );
}
