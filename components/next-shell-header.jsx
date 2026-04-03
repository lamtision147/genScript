"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { routes } from "@/lib/routes";
import { LANGUAGE_OPTIONS, getCopy } from "@/lib/i18n";

export default function NextShellHeader({
  eyebrow = "Seller Studio",
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
  const isAdminUser = Boolean(user?.isAdmin);
  const userLabel = String(user?.name || user?.email || "").trim();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(routes.login);
    router.refresh();
  }

  return (
    <header className="header header-detached">
      <div className="header-topbar">
        {/* LEFT — brand */}
        <div className="header-topbar-brand">
          <div className="brand-mark"><span className="brand-mark-core" /><span className="brand-mark-core brand-mark-core-alt" /></div>
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
            {!user?.isAdmin ? <Link className={`ghost-button nav-link ${isUpgradePage ? "active" : ""}`} href={routes.upgrade}>{copy.common.upgrade || "Upgrade Pro"}</Link> : null}
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
        </div>
      </div>

      <div className="header-lang-row">
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

      <div className="header-main">
        <div className="brand-copy">
          <h1 className={`page-title ${titleClassName}`.trim()} lang={titleLang}>{title}</h1>
          {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        </div>
      </div>
    </header>
  );
}
