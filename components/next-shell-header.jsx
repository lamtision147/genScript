"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { routes } from "@/lib/routes";
import { LANGUAGE_OPTIONS, getCopy } from "@/lib/i18n";
import { useThemePreference } from "@/hooks/use-theme-preference";
import { clearSessionCache } from "@/lib/client/session-cache";

export default function NextShellHeader({
  eyebrow = "SellerScript",
  title,
  subtitle,
  user,
  language = "vi",
  onLanguageChange,
  titleClassName = "",
  titleLang = undefined
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isScriptPage = pathname === routes.scriptProductInfo;
  const isScriptVideoPage = pathname === routes.scriptVideoReview;
  const isProfilePage = pathname === routes.profile;
  const isUpgradePage = pathname === routes.upgrade;
  const isAdminPage = pathname === routes.admin;
  const isLoginPage = pathname === routes.login;
  const copy = getCopy(language);
  const isVi = language === "vi";
  const isAdminUser = Boolean(user?.isAdmin);
  const isProUser = String(user?.plan || "").toLowerCase() === "pro";
  const userLabel = String(user?.name || user?.email || "").trim();
  const { isDark, toggleTheme } = useThemePreference();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    clearSessionCache();
    setMobileMenuOpen(false);
    router.push(routes.login);
    router.refresh();
  }

  return (
    <header className="header header-detached">
      <div className="header-topbar">
        {/* LEFT — brand */}
        <div className="header-topbar-brand">
          <div className="brand-mark" aria-hidden="true">
            <Image src="/brand-logo.svg" alt="" width={32} height={32} priority />
          </div>
          <div className="brand-headline">
            <span className="brand-signature">{eyebrow}</span>
          </div>
        </div>

        {/* CENTER — nav links */}
        <nav className="header-topbar-nav">
          <div className="user-actions">
            <Link className={`ghost-button nav-link ${isScriptVideoPage ? "active" : ""}`} href={routes.scriptVideoReview}>{copy.common.videoScript}</Link>
            <Link className={`ghost-button nav-link ${isScriptPage ? "active" : ""}`} href={routes.scriptProductInfo}>{copy.common.studio}</Link>
          </div>
        </nav>

        {/* RIGHT — auth */}
        <div className="header-topbar-right">
          <div className="header-utility-nav">
            <Link className={`ghost-button nav-link ${isProfilePage ? "active" : ""}`} href={routes.profile}>{copy.common.profile}</Link>
            {!user?.isAdmin
              ? (isProUser
                ? <span className="header-plan-tag" title={isVi ? "Tài khoản Pro" : "Pro account"}>PRO</span>
                : <Link className={`ghost-button nav-link ${isUpgradePage ? "active" : ""}`} href={routes.upgrade}>{copy.common.upgrade || "Upgrade Pro"}</Link>)
              : null}
            {isAdminUser ? <Link className={`ghost-button nav-link ${isAdminPage ? "active" : ""}`} href={routes.admin}>Admin</Link> : null}
          </div>
          {userLabel
            ? (
              <div className="user-badge">
                <span className="user-badge-dot" />
                <span title={userLabel}>{userLabel}</span>
              </div>
            )
            : null}
          <div className="header-auth-actions">
            {!user
              ? <Link className={`ghost-button nav-link ${isLoginPage ? "active" : ""}`} href={routes.login}>{copy.common.login}</Link>
              : <button type="button" className="ghost-button nav-link" onClick={handleLogout}>{copy.common.logout}</button>}
          </div>
          <button
            type="button"
            className={`header-burger-button ${mobileMenuOpen ? "active" : ""}`}
            aria-label={mobileMenuOpen ? (isVi ? "Đóng menu điều hướng" : "Close navigation menu") : (isVi ? "Mở menu điều hướng" : "Open navigation menu")}
            aria-expanded={mobileMenuOpen}
            aria-controls="header-mobile-menu"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
          >
            <span className="header-burger-lines" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            <span className="header-burger-label">{isVi ? "Menu" : "Menu"}</span>
          </button>
        </div>
      </div>

      {mobileMenuOpen ? (
        <section id="header-mobile-menu" className="header-mobile-menu">
          {userLabel ? (
            <div className="header-mobile-user">
              <div className="user-badge">
                <span className="user-badge-dot" />
                <span title={userLabel}>{userLabel}</span>
              </div>
            </div>
          ) : null}

          <div className="header-mobile-group">
            <Link className={`ghost-button nav-link ${isScriptVideoPage ? "active" : ""}`} href={routes.scriptVideoReview}>{copy.common.videoScript}</Link>
            <Link className={`ghost-button nav-link ${isScriptPage ? "active" : ""}`} href={routes.scriptProductInfo}>{copy.common.studio}</Link>
          </div>

          <div className="header-mobile-group">
            <Link className={`ghost-button nav-link ${isProfilePage ? "active" : ""}`} href={routes.profile}>{copy.common.profile}</Link>
            {!user?.isAdmin
              ? (isProUser
                ? <span className="header-plan-tag" title={isVi ? "Tài khoản Pro" : "Pro account"}>PRO</span>
                : <Link className={`ghost-button nav-link ${isUpgradePage ? "active" : ""}`} href={routes.upgrade}>{copy.common.upgrade || "Upgrade Pro"}</Link>)
              : null}
            {isAdminUser ? <Link className={`ghost-button nav-link ${isAdminPage ? "active" : ""}`} href={routes.admin}>Admin</Link> : null}
          </div>

          <div className="header-mobile-controls">
            <button
              type="button"
              className="theme-toggle"
              aria-label={isDark ? (isVi ? "Chuyển sang giao diện sáng" : "Switch to light mode") : (isVi ? "Chuyển sang giao diện tối" : "Switch to dark mode")}
              title={isDark ? "Light mode" : "Dark mode"}
              onClick={toggleTheme}
            >
              <span aria-hidden="true">{isDark ? "☀" : "🌙"}</span>
              <span>{isDark ? (isVi ? "Sáng" : "Light") : (isVi ? "Tối" : "Dark")}</span>
            </button>

            <div className="header-language-switch">
              <label htmlFor="header-language-mobile">{copy.common.language}</label>
              <select
                id="header-language-mobile"
                value={language}
                onChange={(event) => onLanguageChange?.(event.target.value)}
              >
                {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>

          <div className="header-mobile-group auth-only">
            {!user
              ? <Link className={`ghost-button nav-link ${isLoginPage ? "active" : ""}`} href={routes.login}>{copy.common.login}</Link>
              : <button type="button" className="ghost-button nav-link" onClick={handleLogout}>{copy.common.logout}</button>}
          </div>
        </section>
      ) : null}

      <div className="header-lang-row">
        <div className="header-lang-controls">
          <button
            type="button"
            className="theme-toggle"
            aria-label={isDark ? (language === "vi" ? "Chuyển sang giao diện sáng" : "Switch to light mode") : (language === "vi" ? "Chuyển sang giao diện tối" : "Switch to dark mode")}
            title={isDark ? (language === "vi" ? "Light mode" : "Light mode") : (language === "vi" ? "Dark mode" : "Dark mode")}
            onClick={toggleTheme}
          >
            <span aria-hidden="true">{isDark ? "☀" : "🌙"}</span>
            <span>{isDark ? (language === "vi" ? "Sáng" : "Light") : (language === "vi" ? "Tối" : "Dark")}</span>
          </button>

          <div className="header-language-switch">
            <label htmlFor="header-language">{copy.common.language}</label>
            <select
              id="header-language"
              value={language}
              onChange={(event) => onLanguageChange?.(event.target.value)}
            >
              {LANGUAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="header-main">
        <div className="brand-copy">
          <h1 className={`page-title ${titleClassName}`.trim()} lang={titleLang}>{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
      </div>
    </header>
  );
}


