"use client";

import NextShellHeader from "@/components/next-shell-header";
import NextFavoritesSection from "@/components/next-favorites-section";
import NextProfilePasswordSection from "@/components/next-profile-password-section";
import { useProfileWorkspace } from "@/hooks/use-profile-workspace";
import NextPageFrame from "@/components/next-page-frame";
import NextStatusBadge from "@/components/next-status-badge";
import { getCopy } from "@/lib/i18n";
import { useUiLanguage } from "@/hooks/use-ui-language";

export default function NextProfilePage() {
  const { language, setLanguage } = useUiLanguage("vi");
  const {
    session,
    favorites,
    favoritesByType,
    activeFavoriteTab,
    activeFavorites,
    form,
    message,
    actions
  } = useProfileWorkspace(language);
  const copy = getCopy(language);
  const profileTitleText = language === "vi" ? "C\u00E0i \u0111\u1EB7t h\u1ED3 s\u01A1" : copy.profile.title;
  const profileSettingsTitleText = language === "vi" ? "C\u00E0i \u0111\u1EB7t h\u1ED3 s\u01A1" : copy.profile.settingsTitle;

  function handleOpenFavorite(item) {
    const contentType = String(item?.form?.contentType || "").toLowerCase();
    const baseRoute = contentType === "video_script" ? "/scriptVideoReview" : "/scriptProductInfo";
    window.location.href = `${baseRoute}?historyId=${item.id}`;
  }

  const favoriteTabs = [
    {
      value: "product_copy",
      label: language === "vi" ? "Nội dung sản phẩm" : "Product content",
      count: favoritesByType.product_copy?.length || 0
    },
    {
      value: "video_script",
      label: language === "vi" ? "Kịch bản video" : "Video scripts",
      count: favoritesByType.video_script?.length || 0
    }
  ];

  return (
    <NextPageFrame>
      <section className="panel full-span">
        <NextShellHeader
          eyebrow="Seller Studio"
          title={profileTitleText}
          subtitle=""
          user={session}
          language={language}
          onLanguageChange={setLanguage}
          titleClassName="profile-header-title"
          titleLang={language === "vi" ? "vi" : "en"}
        />
        <section className="content-card">
          <div className="content-card-top">
            <h2 className="profile-settings-title profile-settings-title-safe" lang={language === "vi" ? "vi" : undefined}>{profileSettingsTitleText}</h2>
            <NextStatusBadge tone="ai" className="profile-vi-badge">{copy.profile.favoritesCount(favorites.length)}</NextStatusBadge>
          </div>
          {!session ? <div className="history-empty">{copy.profile.notLoggedIn}</div> : null}
          {session ? (
            <>
              <div className="profile-favorite-tabs" role="tablist" aria-label={language === "vi" ? "Bộ lọc yêu thích" : "Favorite filter tabs"}>
                {favoriteTabs.map((tab) => (
                  <button
                    key={tab.value}
                    type="button"
                    role="tab"
                    aria-selected={activeFavoriteTab === tab.value}
                    className={`ghost-button profile-favorite-tab ${activeFavoriteTab === tab.value ? "active" : ""}`}
                    onClick={() => actions.setActiveFavoriteTab(tab.value)}
                  >
                    {tab.label} ({tab.count})
                  </button>
                ))}
              </div>
              <NextFavoritesSection
                favorites={activeFavorites}
                onOpen={handleOpenFavorite}
                onToggleFavorite={actions.toggleFavorite}
                emptyText={copy.profile.emptyFavorites}
                language={language}
              />
            </>
          ) : null}
          {session ? <NextProfilePasswordSection form={form} message={message} onFieldChange={(key, value) => actions.setForm((prev) => ({ ...prev, [key]: value }))} onSubmit={actions.changePassword} language={language} /> : null}
        </section>
      </section>
    </NextPageFrame>
  );
}
