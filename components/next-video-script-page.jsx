"use client";

import { useMemo, useState } from "react";
import NextPageFrame from "@/components/next-page-frame";
import NextShellHeader from "@/components/next-shell-header";
import NextSelectField from "@/components/next-select-field";
import NextTextField from "@/components/next-text-field";
import NextTextareaField from "@/components/next-textarea-field";
import NextImageUploadField from "@/components/next-image-upload-field";
import NextHistoryCard from "@/components/next-history-card";
import NextOutputCard from "@/components/next-output-card";
import NextSupportChatShell from "@/components/next-support-chat-shell";
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
    moodPresetOptions,
    scriptModeOptions,
    categoryOptions,
    industryPresetOptions,
    industryPresetCatalog,
    selectedIndustryPreset,
    categoryGroupFilter,
    actions
  } = useVideoScriptWorkspace(language, { initialHistoryId });

  const [templateKeyword, setTemplateKeyword] = useState("");
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

  async function handleCopy() {
    await copyResultText(outputData);
  }

  function handleDownload() {
    const fallbackTitle = isVi ? "Kịch bản review video" : "Video review script";
    downloadResultDoc(outputData, result?.title || form.productName || fallbackTitle);
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

            <div className="form-grid">
              <NextSelectField
                label={isVi ? "Kiểu mở đầu" : "Opening style"}
                value={form.openingStyle}
                options={openingStyleOptions.map((label, idx) => ({ value: idx, label }))}
                onChange={(value) => actions.setField("openingStyle", Number(value))}
              />
              <NextSelectField
                label={isVi ? "Mood nội dung" : "Content mood"}
                value={form.mood}
                options={moodPresetOptions.map((label) => ({ value: label, label }))}
                onChange={(value) => actions.setField("mood", value)}
              />
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
            </fieldset>
          </section>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2 className="section-title">{isVi ? "Kết quả kịch bản" : "Script output"}</h2>
          </div>

          <NextOutputCard
            loading={loading}
            result={outputData}
            message={message}
            session={session}
            onImprove={null}
            onCopy={handleCopy}
            onDownload={handleDownload}
            editable
            savingEdited={savingEdited}
            onSaveEditedResult={async (nextProductLike) => {
              const nextVideoResult = toProductLikeForSave(nextProductLike);
              await actions.saveEditedResult(nextVideoResult);
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
