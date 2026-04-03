"use client";

import { useState } from "react";
import NextShellHeader from "@/components/next-shell-header";
import NextHistoryCard from "@/components/next-history-card";
import NextOutputCard from "@/components/next-output-card";
import NextProductFormPanel from "@/components/next-product-form-panel";
import NextPageFrame from "@/components/next-page-frame";
import NextSupportChatShell from "@/components/next-support-chat-shell";
import { samplePresets } from "@/lib/product-config";
import { useProductWorkspace } from "@/hooks/use-product-workspace";
import { getCopy, getLocalizedProductConfig } from "@/lib/i18n";
import { useUiLanguage } from "@/hooks/use-ui-language";
import { getCategoryGroupOptions, getCategoryValuesByGroup } from "@/lib/category-marketplace-presets";
import { routes } from "@/lib/routes";

export default function NextScriptProductInfoPage({ initialHistoryId = "" }) {
  const { language, setLanguage } = useUiLanguage("vi");
  const copy = getCopy(language);
  const localized = getLocalizedProductConfig(language);
  const isVi = language === "vi";
  const [savingEditedOutput, setSavingEditedOutput] = useState(false);

  const {
    session,
    history,
    loading,
    result,
    selectedVariant,
    suggestion,
    suggestionPulseToken,
    suggesting,
    message,
    activeHistoryId,
    form,
    favoriteIds,
    industryPresets,
    filteredIndustryPresets,
    selectedIndustryPreset,
    industrySearchKeyword,
    categoryGroupFilter,
    advancedFieldGroup,
    variantCount,
    variantStylePresets,
    isProPlan,
    onboardingState,
    generateQuota,
    actions
  } = useProductWorkspace({ initialHistoryId, samplePresets, language });

  const showOnboardingBanner = !onboardingState?.dismissed;

  const categoryGroupOptions = getCategoryGroupOptions(language);
  const filteredCategoryOptions = localized.categoryOptions.filter((option) =>
    getCategoryValuesByGroup(categoryGroupFilter).includes(option.value)
  );

  const currentCategoryOption = localized.categoryOptions.find((item) => item.value === form?.category) || null;
  const categoryOptions = filteredCategoryOptions.length
    ? (currentCategoryOption && !filteredCategoryOptions.some((item) => item.value === currentCategoryOption.value)
      ? [currentCategoryOption, ...filteredCategoryOptions]
      : filteredCategoryOptions)
    : localized.categoryOptions;

  const currentSubcategories = localized.subcategoryMap[form?.category] || localized.subcategoryMap.other || [];
  const groupCategories = getCategoryValuesByGroup(categoryGroupFilter);
  const productQuota = generateQuota?.productCopy || null;
  const isPro = Boolean(generateQuota?.isPro || session?.plan === "pro");
  const quotaHintText = isPro
    ? (isVi ? "Pro: không giới hạn lượt tạo/cải tiến trong ngày." : "Pro: unlimited generate/improve requests per day.")
    : (isVi
      ? `Free: còn ${productQuota?.remaining ?? 5}/5 lượt tạo nội dung hôm nay (tính cả Cải tiến).`
      : `Free: ${productQuota?.remaining ?? 5}/5 content generations left today (including Improve).`);

  function inferStylePresetFromForm(nextForm = form) {
    const tone = Number(nextForm?.tone);
    const brandStyle = Number(nextForm?.brandStyle);
    const mood = Number(nextForm?.mood);

    if (tone === 1 && brandStyle === 2 && mood === 3) return "expert";
    if (tone === 2 && brandStyle === 1 && mood === 3) return "sales";
    if (tone === 0 && brandStyle === 1 && mood === 1) return "lifestyle";
    if (tone === 0 && brandStyle === 0 && mood === 0) return "balanced";
    return "custom";
  }

  function getStylePresetLabel(stylePreset = "balanced") {
    const normalized = String(stylePreset || "balanced").trim().toLowerCase();
    if (normalized === "expert") return isVi ? "Chuyên gia thuyết phục" : "Expert persuasive";
    if (normalized === "sales") return isVi ? "Chốt sale mạnh" : "Hard close";
    if (normalized === "lifestyle") return isVi ? "Lifestyle gần gũi" : "Warm lifestyle";
    if (normalized === "balanced") return isVi ? "Cân bằng (gọn, an toàn)" : "Balanced (safe default)";
    return isVi ? "Tùy chỉnh thủ công" : "Custom manual";
  }

  const activeVariant = result?.variants?.[selectedVariant] || result || null;
  const activeStylePreset = String(activeVariant?.stylePreset || inferStylePresetFromForm(form)).toLowerCase();
  const styleProfileLabel = (() => {
    return getStylePresetLabel(activeStylePreset);
  })();

  async function handleSaveEditedOutput(nextResult) {
    setSavingEditedOutput(true);
    try {
      await actions.saveEditedResult(nextResult);
    } finally {
      setSavingEditedOutput(false);
    }
  }

  return (
    <NextPageFrame>
        <NextShellHeader
          eyebrow={copy.script.eyebrow || "SellerScript"}
          title={copy.script.title}
          subtitle={copy.script.subtitle || ""}
          user={session}
          language={language}
          onLanguageChange={setLanguage}
        />
        {showOnboardingBanner ? (
          <section className="onboarding-banner" role="status" aria-live="polite">
            <div className="onboarding-banner-copy">
              <strong>{isVi ? "Bắt đầu nhanh trong 30 giây" : "Quick start in 30 seconds"}</strong>
              <span>{isVi ? "1) Nhập tên sản phẩm  2) Upload ảnh  3) Bấm Tạo nội dung" : "1) Enter product name  2) Upload image  3) Click Generate"}</span>
            </div>
            <div className="onboarding-banner-actions">
              <button type="button" className="ghost-button" onClick={actions.applySample}>{isVi ? "Dùng dữ liệu mẫu" : "Use sample"}</button>
              <button type="button" className="ghost-button" onClick={actions.dismissOnboarding}>{isVi ? "Ẩn hướng dẫn" : "Dismiss"}</button>
            </div>
          </section>
        ) : null}
        <section className="layout">
          <section className="panel">
            <NextProductFormPanel
              form={form}
              categoryOptions={categoryOptions}
              channelOptions={localized.channelOptions}
              currentSubcategories={currentSubcategories}
              toneOptions={localized.toneOptions}
              brandStyleOptions={localized.brandStyleOptions}
              moodOptions={localized.moodOptions}
              categoryHints={localized.categoryHints}
              industryPresets={industryPresets}
              filteredIndustryPresets={filteredIndustryPresets}
              selectedIndustryPreset={selectedIndustryPreset}
              industrySearchKeyword={industrySearchKeyword}
              categoryGroupFilter={categoryGroupFilter}
              categoryGroupOptions={categoryGroupOptions}
              onApplySample={actions.applySample}
              onApplyIndustryPreset={actions.applyIndustryPreset}
              onClearDraft={actions.clearDraft}
              onCategoryChange={actions.handleCategoryChange}
              onFieldChange={actions.handleFieldChange}
              onIndustrySearchChange={actions.setIndustrySearchKeyword}
              onCategoryGroupFilterChange={actions.setCategoryGroupFilter}
              onImageSelect={actions.handleImageSelect}
              onRemoveImage={actions.removeImage}
              onSuggestFromImages={actions.suggestFromImages}
              suggesting={suggesting}
              suggestion={suggestion}
              suggestionPulseToken={suggestionPulseToken}
              advancedFieldGroup={advancedFieldGroup}
              variantCount={variantCount}
              variantStylePresets={variantStylePresets}
              sessionPlan={isProPlan ? "pro" : "free"}
              onVariantCountChange={actions.setVariantCount}
              onVariantStylePresetChange={actions.setVariantStylePresetAt}
              onGenerate={() => actions.handleGenerate(false)}
              loading={loading}
              language={language}
            />

            <div className={`quota-note-card ${isPro ? "pro" : "free"}`}>
              <strong>{isVi ? "Quota hôm nay" : "Today quota"}</strong>
              <span>{quotaHintText}</span>
              {!isPro ? <a className="ghost-button" href={routes.upgrade}>{isVi ? "Nâng cấp Pro" : "Upgrade Pro"}</a> : null}
            </div>

            <section className="panel-section coming-soon-card">
              <div className="panel-head">
                <h3 className="subsection-title">{isVi ? "Tạo hàng loạt" : "Bulk generation"}</h3>
                <span className="inline-note">Coming soon</span>
              </div>
              <p className="field-helper">{isVi ? "Tính năng tạo nội dung hàng loạt theo CSV đang được nâng cấp. Sẽ mở lại sớm." : "CSV-based bulk generation is being upgraded and will be back soon."}</p>
            </section>

          </section>

          <section className="panel">
            <NextOutputCard
              loading={loading}
              result={result}
              message={message}
              session={session}
              onImprove={() => actions.handleGenerate(true)}
              onCopy={actions.copyResult}
              onDownload={actions.downloadDoc}
              editable
              savingEdited={savingEditedOutput}
              onSaveEditedResult={handleSaveEditedOutput}
              selectedVariant={selectedVariant}
              variants={result?.variants || []}
              onPickVariant={(index) => {
                const next = result?.variants?.[index];
                if (!next) return;
                const nextHistoryId = next?.historyId || result?.historyId || null;
                actions.setSelectedVariant(index);
                actions.setActiveHistoryId(nextHistoryId);
                actions.setResult({
                  ...next,
                  historyId: nextHistoryId,
                  title: next?.title || result?.title || null,
                  variantLabel: next?.variantStyleLabel || result?.variantLabel || null,
                  variantGroupId: next?.variantGroupId || result?.variantGroupId || "",
                  variants: result?.variants || [next],
                  selectedVariant: index
                });
              }}
              profileMeta={{
                profileLabel: styleProfileLabel
              }}
              language={language}
            />
            {session ? (
              <div className="output-save-hint">{isVi ? "Có thể chỉnh sửa nội dung ở khung bên trên rồi bấm Lưu để cập nhật lịch sử." : "You can edit content above, then click Save to update history."}</div>
            ) : null}
            <NextHistoryCard
              session={session}
              history={history}
              activeHistoryId={activeHistoryId}
              favoriteIds={favoriteIds}
              onOpen={actions.openHistoryItem}
              onToggleFavorite={actions.toggleFavorite}
              onDelete={actions.deleteHistory}
              language={language}
            />
            {session?.plan === "free" ? (
              <div className="history-empty upgrade-inline-cta">
                {isVi ? "Bạn đang dùng gói Free. Nâng cấp Pro để mở không giới hạn lịch sử và yêu thích." : "You are on Free plan. Upgrade to Pro for unlimited history and favorites."}
                <a className="ghost-button" href={routes.upgrade}>{isVi ? "Nâng cấp Pro" : "Upgrade Pro"}</a>
              </div>
            ) : null}
          </section>
      </section>
      <NextSupportChatShell
        language={language}
        page="scriptProductInfo"
        user={session}
        context={{
          productName: form?.productName || "",
          category: form?.category || "",
          hasResult: Boolean(result),
          hasHistory: Array.isArray(history) && history.length > 0,
          hasImages: Array.isArray(form?.images) && form.images.length > 0
        }}
      />
    </NextPageFrame>
  );
}


