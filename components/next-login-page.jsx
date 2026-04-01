"use client";

import NextShellHeader from "@/components/next-shell-header";
import NextAuthForm from "@/components/next-auth-form";
import NextSupportChatShell from "@/components/next-support-chat-shell";
import { useAuthWorkspace } from "@/hooks/use-auth-workspace";
import NextPageFrame from "@/components/next-page-frame";
import { getCopy } from "@/lib/i18n";
import { useUiLanguage } from "@/hooks/use-ui-language";

export default function NextLoginPage() {
  const { language, setLanguage } = useUiLanguage("vi");
  const { session, authConfig, mode, form, message, otpStep, debugCode, loading, actions } = useAuthWorkspace(language);
  const copy = getCopy(language);

  return (
    <NextPageFrame>
      <section className="panel full-span">
        <NextShellHeader
          eyebrow="Seller Studio"
          title={copy.auth.login}
          subtitle=""
          user={session}
          language={language}
          onLanguageChange={setLanguage}
        />
        <section className="login-shell">
          <div className="login-hero">
            <span className="brand-eyebrow">Seller Studio</span>
            <h2 className="page-title login-title">{copy.auth.login}</h2>
            <p className="page-subtitle">{copy.auth.loginSubtitle}</p>
          </div>
          <NextAuthForm
            mode={mode}
            form={form}
            otpStep={otpStep}
            message={message}
            debugCode={debugCode}
            googleEnabled={authConfig.googleEnabled}
            loading={loading}
            language={language}
            onSwitchMode={actions.switchMode}
            onFieldChange={(key, value) => actions.setForm((prev) => ({ ...prev, [key]: value }))}
            onPrimarySubmit={actions.submitPrimary}
            onGoogleLogin={actions.googleLogin}
          />
        </section>
      </section>
      <NextSupportChatShell
        language={language}
        page="login"
        user={session}
        context={{
          hasResult: false,
          hasHistory: false,
          hasImages: false,
          category: ""
        }}
      />
    </NextPageFrame>
  );
}
