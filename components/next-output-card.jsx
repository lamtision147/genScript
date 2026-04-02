"use client";

import NextOutputActions from "@/components/next-output-actions";
import NextEmptyState from "@/components/next-empty-state";
import NextStatusBadge from "@/components/next-status-badge";
import { getCopy } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";

function toEditableText(result = null) {
  if (!result) return { paragraphsText: "", hashtagsText: "" };
  return {
    paragraphsText: Array.isArray(result.paragraphs) ? result.paragraphs.join("\n\n") : "",
    hashtagsText: Array.isArray(result.hashtags) ? result.hashtags.join(" ") : ""
  };
}

function parseHashtagsText(value = "") {
  const raw = String(value || "");
  const normalized = raw
    .split(/[\n,;\s]+/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag}`))
    .map((tag) => tag.replace(/[^#\p{L}\p{N}_]/gu, ""))
    .filter((tag) => tag.length > 1);
  return Array.from(new Set(normalized)).slice(0, 20);
}

function parseParagraphsText(value = "") {
  return String(value || "")
    .split(/\n{2,}/g)
    .map((part) => part.trim())
    .filter(Boolean);
}

export default function NextOutputCard({
  loading,
  result,
  message,
  session,
  onImprove,
  onCopy,
  onDownload,
  selectedVariant = 0,
  variants = [],
  onPickVariant,
  language = "vi",
  editable = false,
  onSaveEditedResult,
  savingEdited = false,
  profileMeta = null
}) {
  const copy = getCopy(language);
  const [isEditing, setIsEditing] = useState(false);
  const [lockedBodyHeight, setLockedBodyHeight] = useState(null);
  const [paragraphsText, setParagraphsText] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const contentBodyRef = useRef(null);

  const editableSeed = useMemo(() => toEditableText(result), [result]);

  useEffect(() => {
    setParagraphsText(editableSeed.paragraphsText);
    setHashtagsText(editableSeed.hashtagsText);
    setIsEditing(false);
    setLockedBodyHeight(null);
  }, [editableSeed.paragraphsText, editableSeed.hashtagsText, result?.historyId, result?.title]);

  const canEdit = Boolean(editable && result && !loading);

  async function handleSaveEditedResult() {
    if (!result || !onSaveEditedResult) return;
    const nextParagraphs = parseParagraphsText(paragraphsText);
    const nextHashtags = parseHashtagsText(hashtagsText);
    try {
      await onSaveEditedResult({
        ...result,
        paragraphs: nextParagraphs,
        hashtags: nextHashtags
      });
      setIsEditing(false);
      setLockedBodyHeight(null);
    } catch {
      // keep editing state when save fails
    }
  }

  function handleStartEdit() {
    const measuredHeight = Math.ceil(contentBodyRef.current?.getBoundingClientRect?.().height || 0);
    if (measuredHeight > 0) {
      setLockedBodyHeight(measuredHeight);
    }
    setIsEditing(true);
  }

  function handleCancelEdit() {
    setParagraphsText(editableSeed.paragraphsText);
    setHashtagsText(editableSeed.hashtagsText);
    setIsEditing(false);
    setLockedBodyHeight(null);
  }

  const editBodyStyle = isEditing && lockedBodyHeight
    ? { minHeight: `${lockedBodyHeight}px`, height: `${lockedBodyHeight}px`, overflowY: "auto" }
    : undefined;

  return (
    <section className="content-card">
      <div className="content-card-top">
        <h2 className="right-title content-title">{copy.output.title}</h2>
        {result ? <NextStatusBadge tone={result.source === "ai" ? "ai" : "fallback"}>{result.source === "ai" ? copy.output.sourceAi : copy.output.sourceFallback}</NextStatusBadge> : null}
        {result?.quality?.score ? <NextStatusBadge tone={result.quality.score >= 84 ? "ai" : "fallback"}>{copy.output.qualityLabel}: {result.quality.grade} ({result.quality.score})</NextStatusBadge> : null}
        {profileMeta?.profileLabel ? <NextStatusBadge tone="neutral">{`${copy.output?.profileLabel || "Applied style"}: ${profileMeta.profileLabel}`}</NextStatusBadge> : null}
        {profileMeta?.moodLabel ? <NextStatusBadge tone="neutral">{`${copy.output?.moodLabel || "Mood"}: ${profileMeta.moodLabel}`}</NextStatusBadge> : null}
        {variants.length > 1 ? (
          <div className="variant-toggle-row">
            {variants.map((variant, index) => {
              const styleLabel = String(variant?.variantStyleLabel || "").trim() || `${copy.output.variant} ${index + 1}`;
              return (
                <button
                  key={`variant-${index}`}
                  type="button"
                  className={`ghost-button variant-toggle ${selectedVariant === index ? "active" : ""}`}
                  onClick={() => onPickVariant?.(index)}
                >
                  {styleLabel}
                </button>
              );
            })}
          </div>
        ) : null}
        <NextOutputActions
          result={result}
          onImprove={onImprove}
          onCopy={onCopy}
          onDownload={onDownload}
          language={language}
          canEdit={canEdit}
          isEditing={isEditing}
          saving={savingEdited}
          onStartEdit={handleStartEdit}
          onSave={handleSaveEditedResult}
          onCancel={handleCancelEdit}
        />
      </div>
      <div ref={contentBodyRef} style={editBodyStyle} className={`content-body ${loading ? "is-generating" : "is-ready"}`}>
        {!loading && result ? <div className="result-readability-hint">{copy.output.readabilityHint}</div> : null}
        {!loading && result?.promptVersion ? <div className="result-readability-hint">Prompt: {result.promptVersion}</div> : null}
        {!loading && result?.quality?.reasons?.length ? <div className="result-readability-hint">{copy.output.optimizeHintPrefix} {result.quality.reasons.join(" · ")}</div> : null}
        {!loading && result?.source === "fallback" && copy.output?.sourceFallbackHint ? <div className="result-readability-hint">{copy.output.sourceFallbackHint}</div> : null}
        {loading ? <div className="ai-loading-card"><div className="ai-loading-orbit"><span /><span /><span /></div><div className="ai-loading-text">{copy.output.loading}</div></div> : null}
        {!loading && message ? <NextEmptyState error>{message}</NextEmptyState> : null}
        {!loading && !result && !message ? <NextEmptyState>{copy.output.empty}</NextEmptyState> : null}
        {!loading && result && isEditing ? (
          <>
            <div className="field output-edit-field">
              <label>{copy.output?.contentLabel || "Content"}</label>
              <textarea
                value={paragraphsText}
                onChange={(event) => setParagraphsText(event.target.value)}
                placeholder={copy.output?.contentPlaceholder || "Separate paragraphs with a blank line"}
              />
            </div>
            <div className="field output-edit-field">
              <label>{copy.output?.hashtagsLabel || "Hashtags"}</label>
              <input
                type="text"
                value={hashtagsText}
                onChange={(event) => setHashtagsText(event.target.value)}
                placeholder={copy.output?.hashtagsPlaceholder || "Example: #fashion #review"}
              />
            </div>
          </>
        ) : null}
        {!loading && result && !isEditing ? result.paragraphs?.map((paragraph, index) => <div key={index} className={`textarea-block output-paragraph output-paragraph-${index + 1}`}>{paragraph}</div>) : null}
        {!loading && result?.hashtags?.length && !isEditing ? <div className="hashtag-wrap"><div className="hashtag-list">{result.hashtags.map((tag) => <span key={tag} className="hashtag-chip">{tag}</span>)}</div></div> : null}
        {!session ? <NextEmptyState>{copy.output.loginPrompt}</NextEmptyState> : null}
      </div>
    </section>
  );
}
