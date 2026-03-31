"use client";

import { useState } from "react";
import NextShellHeader from "@/components/next-shell-header";
import NextHistoryCard from "@/components/next-history-card";
import NextOutputCard from "@/components/next-output-card";
import NextProductFormPanel from "@/components/next-product-form-panel";
import NextPageFrame from "@/components/next-page-frame";
import NextGenerationControls from "@/components/next-generation-controls";
import NextBulkGeneratorPanel from "@/components/next-bulk-generator-panel";
import NextSelectField from "@/components/next-select-field";
import NextTextareaField from "@/components/next-textarea-field";
import { samplePresets } from "@/lib/product-config";
import { useProductWorkspace } from "@/hooks/use-product-workspace";
import { getCopy, getLocalizedProductConfig } from "@/lib/i18n";
import { useUiLanguage } from "@/hooks/use-ui-language";
import { getCategoryGroupOptions, getCategoryValuesByGroup } from "@/lib/category-marketplace-presets";

export default function NextScriptProductInfoPage({ initialHistoryId = "" }) {
  const { language, setLanguage } = useUiLanguage("vi");
  const copy = getCopy(language);
  const localized = getLocalizedProductConfig(language);
  const isVi = language === "vi";
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackType, setFeedbackType] = useState("general");
  const [feedbackSending, setFeedbackSending] = useState(false);

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
    brandPreset,
    variantCount,
    onboardingState,
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

  async function handleFeedbackSubmit() {
    const trimmed = String(feedbackMessage || "").trim();
    if (!trimmed) return;

    setFeedbackSending(true);
    try {
      await actions.submitFeedback({
        type: feedbackType,
        rating: feedbackRating,
        message: trimmed
      });
      setFeedbackMessage("");
      setFeedbackRating(0);
      setFeedbackType("general");
    } finally {
      setFeedbackSending(false);
    }
  }

  return (
    <NextPageFrame>
        <NextShellHeader
          eyebrow={copy.script.eyebrow || "Seller Studio"}
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
              onGenerate={() => actions.handleGenerate(false)}
              loading={loading}
              language={language}
            />

            <NextGenerationControls
              language={language}
              brandPreset={brandPreset}
              variantCount={variantCount}
              onBrandPresetChange={actions.setBrandPreset}
              onVariantCountChange={actions.setVariantCount}
            />

            <section className="panel-section launch-feedback-box">
              <div className="panel-head">
                <h3 className="subsection-title">{isVi ? "Góp ý nhanh" : "Quick feedback"}</h3>
                <span className="inline-note">{isVi ? "Giúp tụi mình fix nhanh trước launch" : "Helps us fix faster before launch"}</span>
              </div>
              <div className="form-grid">
                <NextSelectField
                  label={isVi ? "Loại góp ý" : "Feedback type"}
                  value={feedbackType}
                  options={[
                    { value: "general", label: isVi ? "Tổng quan" : "General" },
                    { value: "bug", label: isVi ? "Lỗi" : "Bug" },
                    { value: "suggest", label: isVi ? "Đề xuất" : "Suggestion" }
                  ]}
                  onChange={setFeedbackType}
                />
                <NextSelectField
                  label={isVi ? "Mức hài lòng" : "Satisfaction"}
                  value={feedbackRating}
                  options={[
                    { value: 0, label: isVi ? "Chưa chấm" : "No rating" },
                    { value: 1, label: "1" },
                    { value: 2, label: "2" },
                    { value: 3, label: "3" },
                    { value: 4, label: "4" },
                    { value: 5, label: "5" }
                  ]}
                  onChange={(value) => setFeedbackRating(Number(value) || 0)}
                />
              </div>
              <NextTextareaField
                label={isVi ? "Nội dung góp ý" : "Feedback message"}
                value={feedbackMessage}
                onChange={setFeedbackMessage}
                placeholder={isVi ? "Ví dụ: upload ảnh ổn, nhưng gợi ý template còn lệch ở vài ngành..." : "Example: image upload works, but template suggestions still drift in a few categories..."}
              />
              <div className="user-actions">
                <button
                  type="button"
                  className="ghost-button"
                  disabled={feedbackSending || !String(feedbackMessage || "").trim()}
                  onClick={handleFeedbackSubmit}
                >
                  {feedbackSending
                    ? (isVi ? "Đang gửi..." : "Sending...")
                    : (isVi ? "Gửi góp ý" : "Send feedback")}
                </button>
              </div>
            </section>

            <NextBulkGeneratorPanel language={language} />
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
              selectedVariant={selectedVariant}
              variants={result?.variants || []}
              onPickVariant={(index) => {
                const next = result?.variants?.[index];
                if (!next) return;
                actions.setSelectedVariant(index);
                actions.setResult({
                  ...next,
                  historyId: result?.historyId || null,
                  title: result?.title || next.title,
                  variantLabel: result?.variantLabel || next.variantLabel,
                  variants: result.variants,
                  selectedVariant: index
                });
              }}
              language={language}
            />
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
          </section>
        </section>
    </NextPageFrame>
  );
}
