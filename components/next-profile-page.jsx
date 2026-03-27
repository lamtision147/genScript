"use client";

import Link from "next/link";
import NextShellHeader from "@/components/next-shell-header";
import NextFavoritesSection from "@/components/next-favorites-section";
import NextProfilePasswordSection from "@/components/next-profile-password-section";
import { useProfileWorkspace } from "@/hooks/use-profile-workspace";
import { uiCopy } from "@/lib/ui-copy";
import NextPageFrame from "@/components/next-page-frame";
import NextStatusBadge from "@/components/next-status-badge";

export default function NextProfilePage() {
  const { session, favorites, form, message, actions } = useProfileWorkspace();

  return (
    <NextPageFrame>
      <section className="panel full-span">
        <NextShellHeader
          eyebrow="Seller Studio / Profile"
          title={uiCopy.profile.title}
          subtitle="Quản lý nội dung yêu thích và cập nhật mật khẩu ngay trong không gian làm việc của bạn."
          user={session}
          insightTitle={session ? `Xin chào, ${session.name}` : "Chưa đăng nhập"}
          insightText={session ? "Favorites và thiết lập tài khoản đang gắn theo session hiện tại của bạn." : "Đăng nhập để xem nội dung yêu thích và quản lý tài khoản."}
        />
        <section className="content-card">
          <div className="content-card-top">
            <h2 className="right-title content-title">Profile settings</h2>
            <NextStatusBadge tone="ai">{favorites.length} nội dung yêu thích</NextStatusBadge>
          </div>
          {!session ? <div className="history-empty">{uiCopy.profile.notLoggedIn}</div> : null}
          {session ? <NextFavoritesSection favorites={favorites} onOpen={(item) => { window.location.href = `/scriptProductInfo?historyId=${item.id}`; }} onToggleFavorite={actions.toggleFavorite} emptyText={uiCopy.profile.emptyFavorites} /> : null}
          {session ? <NextProfilePasswordSection form={form} message={message} onFieldChange={(key, value) => actions.setForm((prev) => ({ ...prev, [key]: value }))} onSubmit={actions.changePassword} /> : null}
        </section>
      </section>
    </NextPageFrame>
  );
}
