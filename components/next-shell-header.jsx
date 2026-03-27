"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { uiCopy } from "@/lib/ui-copy";
import { routes } from "@/lib/routes";

export default function NextShellHeader({
  eyebrow = "Seller Studio / Next.js",
  title,
  subtitle,
  user,
  insightTitle = "Supabase-ready",
  insightText = "Kiến trúc mới đang được hoàn thiện để deploy production ổn định hơn."
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isScriptPage = pathname === routes.scriptProductInfo;
  const isProfilePage = pathname === routes.profile;
  const isLoginPage = pathname === routes.login;

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(routes.login);
    router.refresh();
  }

  return (
    <header className="header header-detached">
      <div className="header-topbar">
        <div className="brand-mark-row">
          <div className="brand-mark"><span className="brand-mark-core" /></div>
          <span className="brand-eyebrow">{eyebrow}</span>
        </div>
        <div className="header-top-actions">
          {user ? <div className="user-badge"><span className="user-badge-dot" /><span>{user.name}</span></div> : null}
          <div className="user-actions">
            <Link className={`ghost-button nav-link ${isScriptPage ? "active" : ""}`} href={routes.scriptProductInfo}>Trang 1</Link>
            <Link className={`ghost-button nav-link ${isProfilePage ? "active" : ""}`} href={routes.profile}>Profile</Link>
            {!user
              ? <Link className={`ghost-button nav-link ${isLoginPage ? "active" : ""}`} href={routes.login}>Đăng nhập</Link>
              : <button type="button" className="ghost-button nav-link" onClick={handleLogout}>Đăng xuất</button>}
          </div>
        </div>
      </div>

      <div className="header-main">
        <div className="brand-copy">
          <h1 className="page-title">{title}</h1>
          <p className="page-subtitle">{subtitle}</p>
        </div>
        <aside className="header-mini-panel">
          <span className="header-mini-label">Workspace</span>
          <strong>{insightTitle}</strong>
          <span>{insightText}</span>
        </aside>
      </div>
    </header>
  );
}
