"use client";

import { useEffect, useMemo, useState } from "react";
import NextPageFrame from "@/components/next-page-frame";
import NextShellHeader from "@/components/next-shell-header";
import NextSelectField from "@/components/next-select-field";
import NextTextField from "@/components/next-text-field";
import NextTextareaField from "@/components/next-textarea-field";
import NextImageUploadField from "@/components/next-image-upload-field";
import NextHistoryCard from "@/components/next-history-card";
import NextOutputCard from "@/components/next-output-card";
import NextSupportChatShell from "@/components/next-support-chat-shell";
import { createPortal } from "react-dom";
import { useUiLanguage } from "@/hooks/use-ui-language";
import { useVideoScriptWorkspace } from "@/hooks/use-video-script-workspace";
import { getCopy } from "@/lib/i18n";
import { copyResultText, downloadResultDoc } from "@/lib/client/result-export";
import { getCategoryGroupOptions } from "@/lib/category-marketplace-presets";
import { routes } from "@/lib/routes";

const DURATION_PRESETS = [15, 30, 45, 60, 90];

function buildResultAsProductLike(result) {
  if (!result) return null;
  const sceneBlocks = (result.scenes || []).map((scene) => {
    const label = scene.label || "Scene";
    const voice = scene.voice || "";
    const visual = scene.visual || "";
    return `${label}\nVoice: ${voice}\nVisual: ${visual}`.trim();
  });
  return {
    source: result.source || "fallback",
    quality: result.quality || null,
    promptVersion: result.promptVersion || "",
    paragraphs: [
      `${result.title || "Video script"}\n${result.hook || ""}`.trim(),
      sceneBlocks.join("\n\n"),
      `${result.cta || ""}${result.shotList?.length ? `\n\nShot list:\n- ${result.shotList.join("\n- ")}` : ""}`.trim()
    ],
    hashtags: Array.isArray(result.hashtags) ? result.hashtags : []
  };
}

function parseSceneBlocksFromParagraph(paragraph = "", language = "vi") {
  const blocks = String(paragraph || "")
    .split(/\n{2,}/g)
    .map((block) => block.trim())
    .filter(Boolean);

  const defaultSceneLabel = language === "vi" ? "Cảnh" : "Scene";

  return blocks.map((block, index) => {
    const lines = block.split("\n").map((line) => line.trim()).filter(Boolean);
    const fallbackLabel = `${defaultSceneLabel} ${index + 1}`;
    const label = lines[0] || fallbackLabel;

    const findField = (regex) => {
      const line = lines.find((item) => regex.test(item));
      if (!line) return "";
      return line.replace(/^[^:]+:\s*/u, "").trim();
    };

    const voice = findField(/^voice\s*:/i) || lines.slice(1).join(" ");
    const visual = findField(/^visual\s*:/i);

    return {
      label,
      voice,
      visual
    };
  }).filter((scene) => scene.voice || scene.visual);
}

export default function NextVideoScriptPage({ initialHistoryId = "" }) {
  const { language, setLanguage } = useUiLanguage("vi");
  const copy = getCopy(language);
  const isVi = language === "vi";

  const {
    session,
    form,
    result,
    loading,
    savingEdited,
    suggesting,
    suggestion,
    suggestionPulseToken,
    autoTemplateMeta,
    message,
    history,
    favoriteIds,
    activeHistoryId,
    localizedConfig,
    openingStyleOptions,
    scriptModeOptions,
    categoryOptions,
    industryPresetOptions,
    industryPresetCatalog,
    selectedIndustryPreset,
    categoryGroupFilter,
    generateQuota,
    variantCount,
    variantOpeningStyles,
    isProPlan,
    actions
  } = useVideoScriptWorkspace(language, { initialHistoryId });

  const [templateKeyword, setTemplateKeyword] = useState("");
  const [showProVariantPopup, setShowProVariantPopup] = useState(false);
  const [requestedProVariantCount, setRequestedProVariantCount] = useState(2);
  const [portalReady, setPortalReady] = useState(false);
  const categoryGroupOptions = getCategoryGroupOptions(language);
  const filteredIndustryPresetOptions = useMemo(() => {
    const keyword = String(templateKeyword || "").trim().toLowerCase();
    if (!keyword) return industryPresetOptions;
    const filtered = industryPresetCatalog
      .filter((item) => {
        const target = [item.label, item.targetCustomer, item.painPoint, item.highlights]
          .join(" ")
          .toLowerCase();
        return target.includes(keyword);
      })
      .map((item) => ({ value: item.value, label: item.label }));
    return filtered.length ? filtered : industryPresetOptions;
  }, [templateKeyword, industryPresetOptions, industryPresetCatalog]);

  const outputData = buildResultAsProductLike(result);
  const videoQuota = generateQuota?.videoScript || null;
  const isPro = Boolean(generateQuota?.isPro || session?.plan === "pro" || isProPlan);
  const quotaHintText = isPro
    ? (isVi ? "Pro: không giới hạn lượt tạo/cải tiến kịch bản trong ngày." : "Pro: unlimited video generate/improve requests per day.")
    : (isVi
      ? `Free: còn ${videoQuota?.remaining ?? 5}/5 lượt tạo kịch bản hôm nay (tính cả Cải tiến).`
      : `Free: ${videoQuota?.remaining ?? 5}/5 video generations left today (including Improve).`);
  const normalizedVariantCount = Math.max(1, Math.min(5, Number(variantCount) || 1));
  const resolvedVariantOpeningStyles = (() => {
    const sequence = [0, 1, 2];
    const seed = Number.isFinite(Number(form?.openingStyle)) ? Math.max(0, Math.min(2, Number(form.openingStyle))) : 0;
    const rotation = [seed, ...sequence.filter((item) => item !== seed)];
    const next = [];
    const size = isProPlan ? normalizedVariantCount : 1;
    for (let index = 0; index < size; index += 1) {
      const parsed = Number(variantOpeningStyles?.[index]);
      if (Number.isFinite(parsed) && parsed >= 0 && parsed <= 2) {
        next.push(parsed);
      } else if (size > 1) {
        next.push(rotation[index % rotation.length] || seed);
      } else {
        next.push(seed);
      }
    }
    return next;
  })();

  const selectedVariantIndex = Number.isFinite(Number(result?.selectedVariant)) ? Number(result.selectedVariant) : 0;
  const outputVariants = Array.isArray(result?.variants) && result.variants.length
    ? result.variants.map((variant, index) => ({
      ...buildResultAsProductLike(variant),
      historyId: variant?.historyId || result?.historyId || null,
      variantStyleLabel: variant?.variantStyleLabel || variant?.styleLabel || (openingStyleOptions[Number(variant?.openingStyle ?? index % 3)] || `${isVi ? "Bản" : "Variant"} ${index + 1}`),
      openingStyle: Number.isFinite(Number(variant?.openingStyle)) ? Number(variant.openingStyle) : (index % 3),
      variantGroupId: variant?.variantGroupId || result?.variantGroupId || ""
    }))
    : (outputData ? [{
      ...outputData,
      historyId: result?.historyId || null,
      variantStyleLabel: result?.variantStyleLabel || openingStyleOptions[Number(form?.openingStyle) || 0],
      openingStyle: Number.isFinite(Number(form?.openingStyle)) ? Number(form.openingStyle) : 0,
      variantGroupId: result?.variantGroupId || ""
    }] : []);

  const activeOutputVariant = outputVariants[selectedVariantIndex] || outputVariants[0] || outputData || null;
  const profileOpeningIdx = Number(activeOutputVariant?.openingStyle ?? form?.openingStyle);
  const profileLabel = (() => {
    const mode = String(form?.scriptMode || "standard").toLowerCase() === "teleprompter"
      ? (isVi ? "Teleprompter" : "Teleprompter")
      : (isVi ? "Tiêu chuẩn" : "Standard");
    const opening = openingStyleOptions[profileOpeningIdx] || "";
    return opening ? `${mode} · ${opening}` : mode;
  })();

  useEffect(() => {
    setPortalReady(true);
    return () => setPortalReady(false);
  }, []);

  useEffect(() => {
    if (!showProVariantPopup) return undefined;
    const handleEsc = (event) => {
      if (event.key === "Escape") closeProVariantPopup();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showProVariantPopup]);

  function openProVariantPopup(nextCount = 2) {
    setRequestedProVariantCount(Math.max(2, Math.min(5, Number(nextCount) || 2)));
    setShowProVariantPopup(true);
  }

  function closeProVariantPopup() {
    setShowProVariantPopup(false);
  }

  function handleVariantCountSelect(nextCount) {
    const normalized = Math.max(1, Math.min(5, Number(nextCount) || 1));
    if (!isProPlan && normalized > 1) {
      actions.setVariantCount?.(1);
      openProVariantPopup(normalized);
      return;
    }
    actions.setVariantCount?.(normalized);
  }

  function renderProUpsellPopup() {
    if (!showProVariantPopup || !portalReady) return null;
    return createPortal(
      <div className="pro-upsell-overlay" role="presentation" onClick={(event) => {
        if (event.target === event.currentTarget) closeProVariantPopup();
      }}>
        <div className="pro-upsell-modal" role="dialog" aria-modal="true" aria-labelledby="video-pro-upsell-title">
          <button type="button" className="pro-upsell-close" onClick={closeProVariantPopup} aria-label={isVi ? "Đóng" : "Close"}>×</button>
          <div className="pro-upsell-badge">
            <span className="pro-upsell-badge-dot" aria-hidden="true" />
            <span className="pro-upsell-badge-text">{isVi ? "Gói PRO" : "PRO PLAN"}</span>
          </div>
          <h3 id="video-pro-upsell-title" className="pro-upsell-title">
            {isVi ? (
              <>
                Tạo nhiều bản kịch bản video
                <br />
                khác phong cách chỉ với 1 lần bấm
              </>
            ) : (
              <>
                Generate multiple video scripts
                <br />
                with different styles in one click
              </>
            )}
          </h3>
          <p className="pro-upsell-subtitle">
            {isVi
              ? `Bạn vừa chọn ${requestedProVariantCount} bản. Nâng cấp PRO để mở nhiều phiên bản nội dung và chọn bản hiệu quả nhất.`
              : `You selected ${requestedProVariantCount} variants. Upgrade to PRO to unlock multi-style scripts and pick the best performer.`}
          </p>
          <ul className="pro-upsell-list">
            <li>{isVi ? "Không giới hạn lượt tạo/cải tiến" : "Unlimited generate/improve requests"}</li>
            <li>{isVi ? "Tạo nhiều bản kịch bản cho cùng 1 brief" : "Generate multiple scripts from one brief"}</li>
            <li>{isVi ? "So sánh theo tab, chốt nhanh bản tốt nhất" : "Compare in tabs and pick the best script quickly"}</li>
            <li>{isVi ? "Lưu trữ lịch sử nội dung không giới hạn" : "Unlimited history storage"}</li>
          </ul>
          <div className="pro-upsell-actions">
            <a className="primary-button pro-upsell-cta" href={routes.upgrade}>{isVi ? "Nâng cấp Pro ngay" : "Upgrade to Pro now"}</a>
            <button type="button" className="ghost-button" onClick={closeProVariantPopup}>{isVi ? "Tiếp tục với 1 bản" : "Continue with 1 variant"}</button>
          </div>
        </div>
      </div>,
      document.body
    );
  }

  async function handleCopy() {
    const target = activeOutputVariant || outputData;
    await copyResultText(target);
  }

  function handleDownload() {
    const fallbackTitle = isVi ? "Kịch bản review video" : "Video review script";
    const target = activeOutputVariant || outputData;
    downloadResultDoc(target, result?.title || form.productName || fallbackTitle);
  }

  function toProductLikeForSave(nextResult) {
    const title = String(nextResult?.title || "").trim();
    const hook = String(nextResult?.hook || "").trim();
    const cta = String(nextResult?.cta || "").trim();
    const parsedParagraphs = Array.isArray(nextResult?.paragraphs) ? nextResult.paragraphs : [];
    const parsedScenes = parseSceneBlocksFromParagraph(parsedParagraphs[1] || "", language);
    const scenes = Array.isArray(nextResult?.scenes)
      ? nextResult.scenes.map((scene, index) => ({
        label: String(scene?.label || `Scene ${index + 1}`).trim(),
        voice: String(scene?.voice || "").trim(),
        visual: String(scene?.visual || "").trim()
      })).filter((scene) => scene.voice || scene.visual)
      : parsedScenes;

    const paragraphs = Array.isArray(nextResult?.paragraphs) ? nextResult.paragraphs : [];
    const firstBlock = String(paragraphs[0] || "").trim();
    const firstLines = firstBlock.split("\n").map((line) => line.trim()).filter(Boolean);
    const mergedTitle = title || firstLines[0] || form.productName || (isVi ? "Kịch bản review video" : "Video review script");
    const mergedHook = hook || firstLines.slice(1).join(" ") || "";

    return {
      ...result,
      ...nextResult,
      title: mergedTitle,
      hook: mergedHook,
      cta: cta || String(parsedParagraphs[2] || "").split("\n")[0].trim(),
      scenes,
      hashtags: Array.isArray(nextResult?.hashtags) ? nextResult.hashtags : (Array.isArray(result?.hashtags) ? result.hashtags : []),
      shotList: Array.isArray(nextResult?.shotList) ? nextResult.shotList : (Array.isArray(result?.shotList) ? result.shotList : [])
    };
  }

  function toVideoResultFromOutputVariant(variant = null) {
    if (!variant) return null;
    const paragraphs = Array.isArray(variant?.paragraphs) ? variant.paragraphs : [];
    const firstBlock = String(paragraphs[0] || "").trim();
    const firstLines = firstBlock.split("\n").map((line) => line.trim()).filter(Boolean);
    const title = String(variant?.title || firstLines[0] || "").trim();
    const hook = String(variant?.hook || firstLines.slice(1).join(" ") || "").trim();
    const scenes = Array.isArray(variant?.scenes) && variant.scenes.length
      ? variant.scenes
      : parseSceneBlocksFromParagraph(paragraphs[1] || "", language);
    const cta = String(variant?.cta || String(paragraphs[2] || "").split("\n")[0].trim()).trim();

    return {
      ...(result || {}),
      ...(variant || {}),
      title,
      hook,
      scenes,
      cta,
      hashtags: Array.isArray(variant?.hashtags) ? variant.hashtags : [],
      shotList: Array.isArray(variant?.shotList) ? variant.shotList : [],
      openingStyle: Number.isFinite(Number(variant?.openingStyle)) ? Number(variant.openingStyle) : Number(form?.openingStyle || 0),
      variantStyleLabel: variant?.variantStyleLabel || variant?.styleLabel || "",
      variantGroupId: variant?.variantGroupId || result?.variantGroupId || "",
      selectedVariant: Number.isFinite(Number(result?.selectedVariant)) ? Number(result.selectedVariant) : 0,
      variants: Array.isArray(result?.variants) && result.variants.length ? result.variants : [variant]
    };
  }

  return (
    <NextPageFrame>
      <NextShellHeader
        eyebrow="Seller Studio"
        title={isVi ? "Kịch bản review video chốt đơn" : "High-conversion video review scripts"}
        subtitle={isVi
          ? "Tạo kịch bản TikTok/Shopee có hook mở đầu giữ người xem trong 3 giây đầu."
          : "Generate TikTok/Shopee scripts with high-retention hooks that stop scrolling."}
        user={session}
        language={language}
        onLanguageChange={setLanguage}
      />

      <section className="layout">
        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">{isVi ? "Brief kịch bản" : "Script brief"}</h2>
            <div className="user-actions">
              <button type="button" className="ghost-button" onClick={actions.applySample}>{isVi ? "Dữ liệu mẫu" : "Sample"}</button>
              <button type="button" className="ghost-button" onClick={actions.applyIndustryTemplate}>{isVi ? "Áp dụng template ngành" : "Apply industry template"}</button>
              <button type="button" className="ghost-button" onClick={actions.clearForm}>{isVi ? "Làm mới" : "Reset"}</button>
            </div>
          </div>

          <section className="panel-section strong">
            <div className="field-helper">
              {isVi
                ? "Mẹo: nỗi đau càng cụ thể, hook mở đầu càng dễ giữ người xem không lướt."
                : "Tip: the more specific the pain point, the stronger your opening hook retention."}
            </div>

            <div className="field-helper">
              {isVi
                ? "Shopee/TikTok tip: chọn Template ngành hàng rồi bấm Áp dụng template ngành để ra brief đúng vibe từng ngách."
                : "Shopee/TikTok tip: pick an industry template then apply it for niche-ready brief direction."}
            </div>

            <div className="field-helper group-filter-hint">
              {isVi ? "Lọc danh mục theo ngành hàng lớn:" : "Filter categories by major vertical:"}
              <span className="tag">{isVi ? "Thời trang, làm đẹp" : "Fashion and beauty"}</span>
              <span className="tag">{isVi ? "Điện tử, công nghệ" : "Electronics and tech"}</span>
              <span className="tag">{isVi ? "Mẹ bé, sức khỏe" : "Mother baby and health"}</span>
              <span className="tag">{isVi ? "Nhà cửa, đời sống" : "Home and living"}</span>
            </div>

            {suggesting ? (
              <div className="analysis-progress-card" role="status" aria-live="polite">
                <div className="analysis-progress-visual" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="analysis-progress-copy">
                  <strong>{isVi ? "Đang phân tích ảnh cho kịch bản video..." : "Analyzing images for video script..."}</strong>
                  <span>{isVi ? "AI đang tự điền ngành hàng, brief và điểm nổi bật theo ảnh." : "AI is auto-filling category, brief, and highlights from image cues."}</span>
                </div>
              </div>
            ) : null}

            <NextImageUploadField
              language={language}
              images={form.images || []}
              onImageSelect={actions.handleImageSelect}
              onRemoveImage={actions.removeImage}
              onSuggestFromImages={actions.suggestFromImages}
              suggesting={suggesting}
              suggestion={suggestion}
            />

            <fieldset className={`form-lock-zone ${suggestionPulseToken ? "pulse-highlight" : ""}`} disabled={suggesting} aria-busy={suggesting}>

            <NextTextField
              label={isVi ? "Tên sản phẩm" : "Product name"}
              value={form.productName}
              onChange={(value) => actions.setField("productName", value)}
              placeholder={isVi ? "Ví dụ: Bộ nồi chống dính 5 món" : "Example: 5-piece non-stick cookware set"}
            />

            <div className="form-grid">
              <NextSelectField
                label={isVi ? "Nhóm ngành" : "Category group"}
                value={categoryGroupFilter || "fashionBeauty"}
                options={categoryGroupOptions}
                onChange={actions.setCategoryGroupFilter}
              />
              <NextSelectField
                label={isVi ? "Danh mục" : "Category"}
                value={form.category}
                options={categoryOptions}
                onChange={(value) => actions.setField("category", value)}
              />
            </div>

            <div className="form-grid">
              <NextSelectField
                label={isVi ? "Mức giá mục tiêu" : "Target price segment"}
                value={form.priceSegment || "mid"}
                options={[
                  { value: "low", label: isVi ? "Giá rẻ / dễ chốt" : "Low / budget" },
                  { value: "mid", label: isVi ? "Tầm trung" : "Mid-range" },
                  { value: "high", label: isVi ? "Cao cấp" : "Premium" }
                ]}
                onChange={(value) => actions.setField("priceSegment", value)}
              />

              <NextSelectField
                label={isVi ? "Template ngành hàng" : "Industry template"}
                value={form.industryPreset || industryPresetOptions?.[0]?.value || ""}
                options={filteredIndustryPresetOptions}
                onChange={(value) => actions.setField("industryPreset", value)}
              />

              {autoTemplateMeta?.value && autoTemplateMeta.value === form.industryPreset ? (
                <div className="field-helper ai-template-badge">
                  <span className="tag">AI</span>
                  <span>{isVi ? `Đề xuất tự động: ${autoTemplateMeta.label || form.industryPreset}` : `Auto suggested: ${autoTemplateMeta.label || form.industryPreset}`}</span>
                </div>
              ) : null}

              <NextSelectField
                label={isVi ? "Kênh" : "Channel"}
                value={form.channel}
                options={localizedConfig.channelOptions.map((label, idx) => ({ value: idx, label }))}
                onChange={(value) => actions.setField("channel", value)}
              />
            </div>

            <NextTextField
              label={isVi ? "Tìm template theo từ khóa" : "Template keyword search"}
              value={templateKeyword}
              onChange={setTemplateKeyword}
              placeholder={isVi ? "Ví dụ: mụn, balo, running, văn phòng..." : "Example: acne, backpack, running, office..."}
            />

            {selectedIndustryPreset ? (
              <div className="video-template-preview">
                <div className="video-template-preview-head">
                  <strong>{isVi ? "Preview template" : "Template preview"}</strong>
                  <span className="inline-note">{selectedIndustryPreset.label}</span>
                </div>
                <div className="video-template-preview-grid">
                  <div><span>{isVi ? "Khách mục tiêu" : "Target"}:</span> {selectedIndustryPreset.targetCustomer}</div>
                  <div><span>{isVi ? "Pain point" : "Pain point"}:</span> {selectedIndustryPreset.painPoint}</div>
                  <div><span>{isVi ? "Highlights" : "Highlights"}:</span> {String(selectedIndustryPreset.highlights || "").split("\n").join(" • ")}</div>
                  <div><span>{isVi ? "Bằng chứng" : "Proof"}:</span> {selectedIndustryPreset.proofPoint}</div>
                  <div><span>{isVi ? "Gợi ý" : "Preset"}:</span> {selectedIndustryPreset.durationSec}s · {selectedIndustryPreset.scriptMode}</div>
                </div>
              </div>
            ) : null}

            <NextTextField
              label={isVi ? "Khách hàng mục tiêu" : "Target customer"}
              value={form.targetCustomer}
              onChange={(value) => actions.setField("targetCustomer", value)}
              placeholder={isVi ? "Ví dụ: Mẹ bỉm bận rộn cần tiết kiệm thời gian" : "Example: Busy moms who need quick daily convenience"}
            />

            <NextTextareaField
              label={isVi ? "Nỗi đau chính của người xem" : "Core viewer pain point"}
              value={form.painPoint}
              onChange={(value) => actions.setField("painPoint", value)}
              placeholder={isVi ? "Người xem đang bực ở điểm nào khiến họ muốn tìm giải pháp?" : "What pain point makes viewers search for a solution right now?"}
            />

            <NextTextareaField
              label={isVi ? "Điểm nổi bật (mỗi dòng 1 ý)" : "Highlights (one per line)"}
              value={form.highlights}
              onChange={(value) => actions.setField("highlights", value)}
              placeholder={isVi ? "Nhỏ gọn\nDễ dùng\nHiệu quả thấy nhanh" : "Compact\nEasy to use\nFast visible result"}
            />

            <NextTextField
              label={isVi ? "Bằng chứng chính" : "Main proof point"}
              value={form.proofPoint}
              onChange={(value) => actions.setField("proofPoint", value)}
              placeholder={isVi ? "Ví dụ: Sau 7 ngày da đều màu hơn khi quay camera thường" : "Example: After 7 days skin tone looked more even on normal camera"}
            />

            <div className="variant-inline-control">
              <NextSelectField
                label={isVi ? "Số bản nội dung" : "Content variants"}
                value={String(normalizedVariantCount)}
                options={[
                  { value: "1", label: isVi ? "1 bản" : "1 variant" },
                  { value: "2", label: isVi ? "2 bản (Pro)" : "2 variants (Pro)" },
                  { value: "3", label: isVi ? "3 bản (Pro)" : "3 variants (Pro)" },
                  { value: "4", label: isVi ? "4 bản (Pro)" : "4 variants (Pro)" },
                  { value: "5", label: isVi ? "5 bản (Pro)" : "5 variants (Pro)" }
                ]}
                onChange={(value) => handleVariantCountSelect(Number(value))}
              />

              {isProPlan && normalizedVariantCount > 1
                ? Array.from({ length: normalizedVariantCount }).map((_, index) => (
                  <NextSelectField
                    key={`video-variant-style-${index + 1}`}
                    label={isVi ? `Phong cách nội dung bản ${index + 1}` : `Variant ${index + 1} style`}
                    value={String(resolvedVariantOpeningStyles[index] ?? 0)}
                    options={openingStyleOptions.map((label, idx) => ({ value: String(idx), label }))}
                    onChange={(value) => actions.setVariantOpeningStyleAt?.(index, Number(value))}
                  />
                ))
                : (
                  <NextSelectField
                    label={isVi ? "Phong cách nội dung" : "Content style"}
                    value={String(resolvedVariantOpeningStyles[0] ?? form.openingStyle ?? 0)}
                    options={openingStyleOptions.map((label, idx) => ({ value: String(idx), label }))}
                    onChange={(value) => actions.setVariantOpeningStyleAt?.(0, Number(value))}
                  />
                )}

              {!isProPlan ? (
                <p className="field-helper">
                  {isVi
                    ? "Gói Free mặc định 1 bản. Khi chọn từ 2 bản, hệ thống sẽ mở popup nâng cấp Pro."
                    : "Free plan is fixed at 1 variant. Selecting 2+ variants opens the Pro upgrade popup."}
                </p>
              ) : (
                <p className="field-helper">
                  {isVi ? `Pro: đang tạo ${normalizedVariantCount} bản kịch bản video.` : `Pro: generating ${normalizedVariantCount} video script variants.`}
                </p>
              )}
            </div>

            <NextSelectField
              label={isVi ? "Chế độ kịch bản" : "Script mode"}
              value={form.scriptMode || "standard"}
              options={scriptModeOptions}
              onChange={(value) => actions.setField("scriptMode", value)}
            />

            <NextSelectField
              label={isVi ? "Mốc thời lượng" : "Duration preset"}
              value={form.durationSec}
              options={DURATION_PRESETS.map((seconds) => ({
                value: seconds,
                label: isVi ? `${seconds} giây` : `${seconds} seconds`
              }))}
              onChange={(value) => actions.setField("durationSec", Number(value))}
            />

            <div className="submit-wrap">
              <button type="button" className="primary-button" onClick={actions.generateVideoScript}>
                {loading ? (isVi ? "Đang tạo kịch bản..." : "Generating script...") : (isVi ? "Tạo kịch bản video" : "Generate video script")}
              </button>
            </div>

            <div className={`quota-note-card ${isPro ? "pro" : "free"}`}>
              <strong>{isVi ? "Quota hôm nay" : "Today quota"}</strong>
              <span>{quotaHintText}</span>
              {!isPro ? <a className="ghost-button" href={routes.upgrade}>{isVi ? "Nâng cấp Pro" : "Upgrade Pro"}</a> : null}
            </div>
            </fieldset>
          </section>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">{isVi ? "Kết quả kịch bản" : "Script output"}</h2>
          </div>

          <NextOutputCard
            loading={loading}
            result={activeOutputVariant}
            message={message}
            session={session}
            onImprove={() => actions.generateVideoScript({ improved: true })}
            onCopy={handleCopy}
            onDownload={handleDownload}
            editable
            savingEdited={savingEdited}
            selectedVariant={selectedVariantIndex}
            variants={outputVariants}
            onPickVariant={(index) => {
              const next = outputVariants[index];
              if (!next) return;
              if (next?.historyId && String(next.historyId) !== String(activeHistoryId || "")) {
                const historyItem = history.find((item) => String(item?.id) === String(next.historyId));
                if (historyItem) {
                  actions.openHistoryItem?.(historyItem);
                  return;
                }
              }
              const nextVideoResult = toVideoResultFromOutputVariant(next);
              if (!nextVideoResult) return;
              const nextVariants = outputVariants
                .map((variantItem) => toVideoResultFromOutputVariant(variantItem))
                .filter(Boolean);
              actions.openHistoryItem?.({
                id: next?.historyId || activeHistoryId,
                form: {
                  ...form,
                  variantGroupId: next?.variantGroupId || result?.variantGroupId || ""
                },
                result: {
                  ...nextVideoResult,
                  variants: nextVariants.length ? nextVariants : [nextVideoResult],
                  selectedVariant: index
                }
              });
            }}
            onSaveEditedResult={async (nextProductLike) => {
              const nextVideoResult = toProductLikeForSave({
                ...nextProductLike,
                openingStyle: Number.isFinite(Number(activeOutputVariant?.openingStyle))
                  ? Number(activeOutputVariant.openingStyle)
                  : Number(form?.openingStyle || 0),
                variantStyleLabel: activeOutputVariant?.variantStyleLabel || activeOutputVariant?.styleLabel || "",
                variantGroupId: activeOutputVariant?.variantGroupId || result?.variantGroupId || "",
                variantIndex: selectedVariantIndex,
                selectedVariant: selectedVariantIndex,
                variants: Array.isArray(result?.variants) && result.variants.length ? result.variants : undefined
              });
              await actions.saveEditedResult(nextVideoResult);
            }}
            profileMeta={{
              profileLabel
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
          {session?.plan === "free" ? (
            <div className="history-empty upgrade-inline-cta">
              {isVi ? "Bạn đang dùng gói Free. Nâng cấp Pro để mở không giới hạn lịch sử và yêu thích." : "You are on Free plan. Upgrade to Pro for unlimited history and favorites."}
              <a className="ghost-button" href={routes.upgrade}>{isVi ? "Nâng cấp Pro" : "Upgrade Pro"}</a>
            </div>
          ) : null}
        </section>
      </section>
      {renderProUpsellPopup()}
      <NextSupportChatShell
        language={language}
        page="scriptVideoReview"
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
