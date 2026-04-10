"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
import { getSampleFieldPlaceholder } from "@/lib/product-config";
import { getLocalizedProductConfig } from "@/lib/i18n-product-config";
import { routes } from "@/lib/routes";

const DURATION_PRESETS = [15, 30, 45, 60, 90];
const FREE_ALLOWED_VIDEO_STYLE_PRESETS = new Set(["balanced", "expert", "lifestyle"]);

function buildGroupedStyleOptions(baseOptions = [], isProPlan = false, isVi = true) {
  const list = Array.isArray(baseOptions) ? baseOptions : [];
  const freeOptions = list.filter((option) => FREE_ALLOWED_VIDEO_STYLE_PRESETS.has(option.value));
  const proOptions = list
    .filter((option) => !FREE_ALLOWED_VIDEO_STYLE_PRESETS.has(option.value));

  if (isProPlan) {
    return [
      {
        label: isVi ? "Phong cách thường" : "Free styles",
        options: freeOptions
      },
      {
        label: isVi ? "Phong cách Pro" : "Pro styles",
        options: proOptions
      }
    ];
  }

  return [
    {
      label: isVi ? "Phong cách thường" : "Free styles",
      options: freeOptions
    },
    {
      label: isVi ? "Phong cách Pro (nâng cấp)" : "Pro styles (upgrade)",
      options: proOptions
    }
  ];
}

function buildResultAsProductLike(result) {
  if (!result) return null;
  const isVi = String(result?.lang || "").toLowerCase() === "vi";
  const shotListLabel = isVi ? "Checklist quay:" : "Shot checklist:";
  const sceneBlocks = (result.scenes || []).map((scene) => {
    const label = scene.label || "Scene";
    const voice = scene.voice || "";
    const visual = scene.visual || "";
    return `${label}\n🎙 Voice: ${voice}\n🎬 Visual: ${visual}`.trim();
  });
  return {
    source: result.source || "fallback",
    quality: result.quality || null,
    promptVersion: result.promptVersion || "",
    paragraphs: [
      `${result.title || "Video script"}\n${result.hook || ""}`.trim(),
      sceneBlocks.join("\n\n"),
      `${result.cta || ""}${result.shotList?.length ? `\n\n${shotListLabel}\n- ${result.shotList.join("\n- ")}` : ""}`.trim()
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

function buildTemplateKeywordSeed({ productName = "", templateLabel = "", fallback = "" } = {}) {
  const normalizeToken = (value = "") => String(value || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[đĐ]/g, "d")
    .toLowerCase()
    .trim();

  const stopwords = new Set([
    "va", "voi", "cho", "cua", "san", "pham", "template", "nganh", "hang", "video",
    "thoi", "trang", "fashion", "category", "group", "danh", "muc",
    "for", "with", "and", "the", "from", "by", "product"
  ]);

  const tokenize = (value = "") => String(value || "")
    .replace(/[|,;:/\\]+/g, " ")
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => item.length >= 2)
    .filter((item) => !stopwords.has(normalizeToken(item)));

  const pickUnique = (tokens = [], max = 4) => {
    const picked = [];
    const seen = new Set();
    for (const token of tokens) {
      const key = normalizeToken(token);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      picked.push(token);
      if (picked.length >= max) break;
    }
    return picked;
  };

  const productTokens = pickUnique(tokenize(productName), 4);
  if (productTokens.length >= 2) {
    return productTokens.join(" ");
  }

  const templateTokens = pickUnique(tokenize(templateLabel), 3);
  const fallbackTokens = pickUnique(tokenize(fallback), 1);
  const merged = pickUnique([...productTokens, ...templateTokens, ...fallbackTokens], 4);
  return merged.join(" ");
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
    variantStylePresetOptions,
    scriptModeOptions,
    categoryOptions,
    industryPresetOptions,
    industryPresetCatalog,
    selectedIndustryPreset,
    advancedFieldGroup,
    categoryGroupFilter,
    generateQuota,
    variantCount,
    variantStylePresets,
    isProPlan,
    actions
  } = useVideoScriptWorkspace(language, { initialHistoryId });

  const [templateKeyword, setTemplateKeyword] = useState("");
  const [showProVariantPopup, setShowProVariantPopup] = useState(false);
  const [requestedProVariantCount, setRequestedProVariantCount] = useState(2);
  const [portalReady, setPortalReady] = useState(false);
  const [switchingVariant, setSwitchingVariant] = useState(false);
  const [pendingVariantIndex, setPendingVariantIndex] = useState(-1);
  const variantSwitchTimeoutRef = useRef(null);
  const outputPanelRef = useRef(null);
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

  const categoryFieldPlaceholder = useMemo(() => {
    const category = String(form?.category || "other");
    const pick = (field, fallback = "") => getSampleFieldPlaceholder(category, field, fallback);

    return {
      productName: isVi
        ? `Ví dụ: ${pick("productName", "Sản phẩm nổi bật theo ngành")}`
        : `Example: ${pick("productName", "Top product by category")}`,
      targetCustomer: isVi
        ? `Ví dụ: ${pick("targetCustomer", "Khách mục tiêu chính theo ngành")}`
        : `Example: ${pick("targetCustomer", "Primary target customer by category")}`,
      proofPoint: isVi
        ? `Ví dụ: ${pick("shortDescription", "Kết quả thực tế theo bối cảnh dùng")}`
        : `Example: ${pick("shortDescription", "Practical result in real usage")}`,
      painPoint: isVi
        ? `Ví dụ: ${pick("shortDescription", "Nỗi đau cốt lõi khiến khách muốn mua")}`
        : `Example: ${pick("shortDescription", "Core pain point driving purchase")}`,
      highlights: pick("highlights", isVi ? "Điểm mạnh rõ\nDễ dùng\nĐáng tiền" : "Clear strengths\nEasy to use\nWorth the money"),
      usage: isVi
        ? `Ví dụ: ${pick("usage", "Dùng theo nhu cầu thực tế")}`
        : `Example: ${pick("usage", "Use in daily practical context")}`,
      skinConcern: isVi
        ? `Ví dụ: ${pick("skinConcern", "Vấn đề chính theo nhóm da")}`
        : `Example: ${pick("skinConcern", "Main concern by skin profile")}`,
      routineStep: isVi
        ? `Ví dụ: ${pick("routineStep", "Bước routine phù hợp")}`
        : `Example: ${pick("routineStep", "Suitable routine step")}`,
      dimensions: isVi
        ? `Ví dụ: ${pick("dimensions", "Kích thước/Dung tích theo sản phẩm")}`
        : `Example: ${pick("dimensions", "Dimensions/Capacity by product")}`,
      warranty: isVi
        ? `Ví dụ: ${pick("warranty", "Bảo hành theo ngành")}`
        : `Example: ${pick("warranty", "Warranty by category")}`,
      usageSpace: isVi
        ? `Ví dụ: ${pick("usageSpace", "Không gian dùng phù hợp")}`
        : `Example: ${pick("usageSpace", "Best-fit usage space")}`,
      specs: isVi
        ? `Ví dụ: ${pick("specs", "Thông số chính dễ hiểu")}`
        : `Example: ${pick("specs", "Clear key specs")}`,
      compatibility: isVi
        ? `Ví dụ: ${pick("compatibility", "Tương thích thiết bị/hệ")}`
        : `Example: ${pick("compatibility", "Device/system compatibility")}`,
      sizeGuide: isVi
        ? `Ví dụ: ${pick("sizeGuide", "Bảng size theo đối tượng")}`
        : `Example: ${pick("sizeGuide", "Size guide by fit group")}`,
      careGuide: isVi
        ? `Ví dụ: ${pick("careGuide", "Hướng dẫn bảo quản")}`
        : `Example: ${pick("careGuide", "Care instructions")}`,
      exchangePolicy: isVi
        ? `Ví dụ: ${pick("exchangePolicy", "Chính sách đổi trả phù hợp")}`
        : `Example: ${pick("exchangePolicy", "Exchange policy details")}`
    };
  }, [form?.category, isVi]);

  const categoryHintMap = useMemo(
    () => getLocalizedProductConfig(language).categoryHints || {},
    [language]
  );

  const outputData = buildResultAsProductLike(result);
  const videoQuota = generateQuota?.videoScript || null;
  const isPro = Boolean(generateQuota?.isPro || session?.plan === "pro" || isProPlan);
  const isGuestQuota = Boolean(generateQuota?.isGuest && !session);
  const quotaHintText = isPro
    ? (isVi ? "Pro: không giới hạn lượt tạo/cải tiến kịch bản trong ngày." : "Pro: unlimited video generate/improve requests per day.")
    : isGuestQuota
      ? (isVi
        ? `Khách: còn ${videoQuota?.remaining ?? 2}/2 lượt tạo kịch bản hôm nay. Đăng nhập để nhận 5 lượt/ngày.`
        : `Guest: ${videoQuota?.remaining ?? 2}/2 video generations left today. Log in to get 5/day.`)
    : (isVi
      ? `Free: còn ${videoQuota?.remaining ?? 5}/5 lượt tạo kịch bản hôm nay.`
      : `Free: ${videoQuota?.remaining ?? 5}/5 video generations left today.`);
  const normalizedVariantCount = Math.max(1, Math.min(5, Number(variantCount) || 1));
  const stylePresetOptionsForSelect = buildGroupedStyleOptions(variantStylePresetOptions, isProPlan, isVi);
  const resolvedVariantStylePresets = (() => {
    const fallbackPreset = "expert";
    const size = isProPlan ? normalizedVariantCount : 1;
    const allowed = new Set(variantStylePresetOptions.map((item) => item.value));
    const next = [];
    for (let index = 0; index < size; index += 1) {
      const preset = String(variantStylePresets?.[index] || "").trim().toLowerCase();
      if (allowed.has(preset)) {
        next.push(preset);
      } else {
        next.push(fallbackPreset);
      }
    }
    return next;
  })();
  const displayedVariantStylePresets = resolvedVariantStylePresets;

  const selectedVariantIndex = Number.isFinite(Number(result?.selectedVariant)) ? Number(result.selectedVariant) : 0;
  const outputVariants = Array.isArray(result?.variants) && result.variants.length
    ? result.variants.map((variant, index) => ({
      ...buildResultAsProductLike(variant),
      historyId: variant?.historyId || result?.historyId || null,
      variantStyleLabel: variant?.variantStyleLabel || variant?.styleLabel || `${isVi ? "Bản" : "Variant"} ${index + 1}`,
      openingStyle: Number.isFinite(Number(variant?.openingStyle)) ? Number(variant.openingStyle) : (index % 5),
      variantGroupId: variant?.variantGroupId || result?.variantGroupId || ""
    }))
    : (outputData ? [{
      ...outputData,
      historyId: result?.historyId || null,
      variantStyleLabel: result?.variantStyleLabel || `${isVi ? "Bản" : "Variant"} 1`,
      openingStyle: Number.isFinite(Number(form?.openingStyle)) ? Number(form.openingStyle) : 0,
      variantGroupId: result?.variantGroupId || ""
    }] : []);

  const activeOutputVariant = outputVariants[selectedVariantIndex] || outputVariants[0] || outputData || null;
  const profileOpeningIdx = Number(activeOutputVariant?.openingStyle ?? form?.openingStyle);
  const profileLabel = (() => {
    const mode = String(form?.scriptMode || "standard").toLowerCase() === "teleprompter"
      ? (isVi ? "Teleprompter" : "Teleprompter")
      : (isVi ? "Tiêu chuẩn" : "Standard");
    const opening = openingStyleOptions[Math.max(0, Math.min(openingStyleOptions.length - 1, profileOpeningIdx || 0))] || "";
    return opening ? `${mode} · ${opening}` : mode;
  })();

  function scrollToOutputPanel() {
    if (typeof window === "undefined") return;
    const node = outputPanelRef.current;
    if (!node) return;
    const top = Math.max(0, window.scrollY + node.getBoundingClientRect().top - 88);
    window.scrollTo({ top, behavior: "smooth" });
  }

  useEffect(() => {
    setPortalReady(true);
    return () => setPortalReady(false);
  }, []);

  useEffect(() => {
    return () => {
      if (variantSwitchTimeoutRef.current) {
        clearTimeout(variantSwitchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showProVariantPopup) return undefined;
    const handleEsc = (event) => {
      if (event.key === "Escape") closeProVariantPopup();
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [showProVariantPopup]);

  useEffect(() => {
    if (!suggestionPulseToken) return;

    const generatedName = String(suggestion?.generatedProductName || "").trim();
    const hasDetectedName = String(suggestion?.analysisState || "").toLowerCase() !== "no_data" && generatedName;
    const seed = buildTemplateKeywordSeed({
      productName: hasDetectedName ? generatedName : form.productName,
      templateLabel: selectedIndustryPreset?.label || "",
      fallback: form.category
    });
    if (!seed) return;
    setTemplateKeyword(seed);
  }, [
    suggestionPulseToken,
    suggestion?.analysisState,
    suggestion?.generatedProductName,
    form.productName,
    form.category,
    selectedIndustryPreset?.label
  ]);

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

  function handleStyleSelect(index, value) {
    const nextValue = String(value || "expert").trim().toLowerCase();
    if (!isProPlan && !FREE_ALLOWED_VIDEO_STYLE_PRESETS.has(nextValue)) {
      openProVariantPopup(index > 0 ? Math.max(2, normalizedVariantCount) : 2);
      return;
    }
    actions.setVariantStylePresetAt?.(index, nextValue);
  }

  function handlePickOutputVariant(index) {
    const targetIndex = Math.max(0, Math.floor(Number(index) || 0));
    if (targetIndex === selectedVariantIndex) return;

    if (variantSwitchTimeoutRef.current) {
      clearTimeout(variantSwitchTimeoutRef.current);
    }

    setPendingVariantIndex(targetIndex);
    setSwitchingVariant(true);

    const run = () => {
      actions.selectVariant?.(targetIndex);
      if (typeof window !== "undefined" && window.requestAnimationFrame) {
        window.requestAnimationFrame(() => {
          variantSwitchTimeoutRef.current = setTimeout(() => {
            setSwitchingVariant(false);
            setPendingVariantIndex(-1);
          }, 140);
        });
      } else {
        variantSwitchTimeoutRef.current = setTimeout(() => {
          setSwitchingVariant(false);
          setPendingVariantIndex(-1);
        }, 140);
      }
    };

    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(run);
    } else {
      setTimeout(run, 0);
    }
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
        title={isVi ? "Tạo kịch bản video bán hàng giữ người xem ngay 3 giây đầu" : "Create high-conversion video scripts that hook viewers in 3 seconds"}
        subtitle={isVi
          ? "Chỉ cần brief ngắn và ảnh sản phẩm, hệ thống sẽ tạo hook mở đầu, flow cảnh quay, CTA và hashtag sẵn để bạn quay nhanh và chốt đơn tốt hơn."
          : "With a short brief and product images, the system generates hooks, scene flow, CTA, and hashtags so you can produce faster and convert better."}
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

            {suggesting ? (
              <div className="analysis-progress-card" role="status" aria-live="polite">
                <div className="analysis-progress-visual" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="analysis-progress-copy">
                  <strong>{isVi ? "Đang phân tích ảnh cho kịch bản video..." : "Analyzing images for video script..."}</strong>
                  <span>{isVi ? "Hệ thống đang tự điền ngành hàng, brief và điểm nổi bật theo ảnh." : "The system is auto-filling category, brief, and highlights from image cues."}</span>
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
              placeholder={categoryFieldPlaceholder.productName}
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
                  <span className="tag">AUTO</span>
                  <span>{isVi ? `Đề xuất tự động: ${autoTemplateMeta.label || form.industryPreset}` : `Auto suggested: ${autoTemplateMeta.label || form.industryPreset}`}</span>
                </div>
              ) : null}

            </div>

            <NextTextField
              label={isVi ? "Từ khóa lọc template" : "Template keyword filter"}
              value={templateKeyword}
              onChange={setTemplateKeyword}
              placeholder={isVi ? "Ví dụ: đầm midi, tai nghe chống ồn, máy xay mini..." : "Example: midi dress, noise-cancelling earbuds, mini blender..."}
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
              label={isVi ? "Khách hàng mục tiêu chính" : "Primary target customer"}
              value={form.targetCustomer}
              onChange={(value) => actions.setField("targetCustomer", value)}
              placeholder={categoryHintMap?.[form.category]?.target || categoryFieldPlaceholder.targetCustomer}
            />

            <NextTextField
              label={isVi ? "Kết quả/Bằng chứng thực tế" : "Real result / proof point"}
              value={form.proofPoint}
              onChange={(value) => actions.setField("proofPoint", value)}
              placeholder={categoryFieldPlaceholder.proofPoint}
            />

            {advancedFieldGroup === "skincare" ? (
              <div className="form-grid">
                <NextTextField
                  label={isVi ? "Cách dùng gợi ý" : "Suggested usage"}
                  value={form.usage || ""}
                  onChange={(value) => actions.setField("usage", value)}
                  placeholder={categoryFieldPlaceholder.usage}
                />
                <NextTextField
                  label={isVi ? "Vấn đề da chính" : "Main skin concern"}
                  value={form.skinConcern || ""}
                  onChange={(value) => actions.setField("skinConcern", value)}
                  placeholder={categoryFieldPlaceholder.skinConcern}
                />
              </div>
            ) : null}

            {advancedFieldGroup === "skincare" ? (
              <NextTextField
                label={isVi ? "Bước routine" : "Routine step"}
                value={form.routineStep || ""}
                onChange={(value) => actions.setField("routineStep", value)}
                placeholder={categoryFieldPlaceholder.routineStep}
              />
            ) : null}

            {advancedFieldGroup === "home" ? (
              <div className="form-grid">
                <NextTextField
                  label={isVi ? "Kích thước / dung tích" : "Dimensions / capacity"}
                  value={form.dimensions || ""}
                  onChange={(value) => actions.setField("dimensions", value)}
                  placeholder={categoryFieldPlaceholder.dimensions}
                />
                <NextTextField
                  label={isVi ? "Bảo hành" : "Warranty"}
                  value={form.warranty || ""}
                  onChange={(value) => actions.setField("warranty", value)}
                  placeholder={categoryFieldPlaceholder.warranty}
                />
              </div>
            ) : null}

            {advancedFieldGroup === "home" ? (
              <NextTextField
                label={isVi ? "Không gian sử dụng" : "Usage space"}
                value={form.usageSpace || ""}
                onChange={(value) => actions.setField("usageSpace", value)}
                placeholder={categoryFieldPlaceholder.usageSpace}
              />
            ) : null}

            {advancedFieldGroup === "electronics" ? (
              <div className="form-grid">
                <NextTextField
                  label={isVi ? "Thông số chính" : "Key specs"}
                  value={form.specs || ""}
                  onChange={(value) => actions.setField("specs", value)}
                  placeholder={categoryFieldPlaceholder.specs}
                />
                <NextTextField
                  label={isVi ? "Tương thích" : "Compatibility"}
                  value={form.compatibility || ""}
                  onChange={(value) => actions.setField("compatibility", value)}
                  placeholder={categoryFieldPlaceholder.compatibility}
                />
              </div>
            ) : null}

            {advancedFieldGroup === "electronics" ? (
              <NextTextField
                label={isVi ? "Bảo hành" : "Warranty"}
                value={form.warranty || ""}
                onChange={(value) => actions.setField("warranty", value)}
                placeholder={categoryFieldPlaceholder.warranty}
              />
            ) : null}

            {advancedFieldGroup === "fashion" ? (
              <div className="form-grid">
                <NextTextField
                  label={isVi ? "Bảng size" : "Size guide"}
                  value={form.sizeGuide || ""}
                  onChange={(value) => actions.setField("sizeGuide", value)}
                  placeholder={categoryFieldPlaceholder.sizeGuide}
                />
                <NextTextField
                  label={isVi ? "Hướng dẫn bảo quản" : "Care guide"}
                  value={form.careGuide || ""}
                  onChange={(value) => actions.setField("careGuide", value)}
                  placeholder={categoryFieldPlaceholder.careGuide}
                />
              </div>
            ) : null}

            {advancedFieldGroup === "fashion" ? (
              <NextTextField
                label={isVi ? "Đổi trả / size" : "Exchange / sizing"}
                value={form.exchangePolicy || ""}
                onChange={(value) => actions.setField("exchangePolicy", value)}
                placeholder={categoryFieldPlaceholder.exchangePolicy}
              />
            ) : null}

            <NextTextareaField
              label={isVi ? "Vấn đề chính của khách hàng" : "Core customer problem"}
              value={form.painPoint}
              onChange={(value) => actions.setField("painPoint", value)}
              placeholder={categoryHintMap?.[form.category]?.short || categoryFieldPlaceholder.painPoint}
            />

            <NextTextareaField
              label={isVi ? "Điểm nổi bật sản phẩm (mỗi dòng 1 ý)" : "Product highlights (one per line)"}
              value={form.highlights}
              onChange={(value) => actions.setField("highlights", value)}
              placeholder={categoryHintMap?.[form.category]?.highlights || categoryFieldPlaceholder.highlights}
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
                    value={String(displayedVariantStylePresets[index] ?? "expert")}
                    options={stylePresetOptionsForSelect}
                    onChange={(value) => handleStyleSelect(index, value)}
                  />
                ))
                : (
                  <NextSelectField
                    label={isVi ? "Phong cách nội dung" : "Content style"}
                    value={String(displayedVariantStylePresets[0] || "expert")}
                    options={stylePresetOptionsForSelect}
                    onChange={(value) => handleStyleSelect(0, value)}
                  />
                )}

              {!isProPlan ? (
                <p className="field-helper">
                  {isVi
                    ? "Gói Free: dùng 1 bản và 3 phong cách mở đầu. Chọn bản/kiểu gắn (Pro) sẽ mở popup nâng cấp."
                    : "Free plan: 1 variant and 3 opening styles. Selecting a (Pro) option opens the upgrade popup."}
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
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  scrollToOutputPanel();
                  actions.generateVideoScript();
                }}
              >
                {loading ? (isVi ? "Đang tạo kịch bản..." : "Generating script...") : (isVi ? "Tạo kịch bản video" : "Generate video script")}
              </button>
            </div>

            <div className={`quota-note-card ${isPro ? "pro" : "free"}`}>
              <strong>{isVi ? "Quota hôm nay" : "Today quota"}</strong>
              <div className="quota-note-row">
                <span className="quota-note-text">{quotaHintText}</span>
                {!isPro
                  ? (isGuestQuota
                    ? <a className="ghost-button" href={routes.login}>{isVi ? "Đăng nhập" : "Log in"}</a>
                    : <a className="ghost-button" href={routes.upgrade}>{isVi ? "Nâng cấp Pro" : "Upgrade Pro"}</a>)
                  : null}
              </div>
            </div>
            </fieldset>
          </section>
        </section>

        <section className="panel" ref={outputPanelRef}>
          <div className="panel-head">
            <h2 className="section-title">{isVi ? "Kết quả kịch bản" : "Script output"}</h2>
          </div>

          <NextOutputCard
            loading={loading || switchingVariant}
            result={activeOutputVariant}
            message={message}
            session={session}
            onImprove={() => {
              scrollToOutputPanel();
              actions.generateVideoScript({ improved: true });
            }}
            onCopy={handleCopy}
            onDownload={handleDownload}
            editable
            savingEdited={savingEdited || switchingVariant}
            selectedVariant={selectedVariantIndex}
            variants={outputVariants}
            onPickVariant={(index) => {
              if (switchingVariant && pendingVariantIndex === Number(index)) return;
              handlePickOutputVariant(index);
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


