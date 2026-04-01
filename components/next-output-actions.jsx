"use client";

import { useState } from "react";
import { getCopy } from "@/lib/i18n";

export default function NextOutputActions({
  result,
  onImprove,
  onCopy,
  onDownload,
  language = "vi",
  canEdit = false,
  isEditing = false,
  saving = false,
  onStartEdit,
  onSave,
  onCancel
}) {
  const copy = getCopy(language);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const saveLabel = saving ? (copy.output?.saving || "Saving...") : (copy.output?.save || "Save");
  const editLabel = copy.output?.edit || "Edit";
  const cancelLabel = copy.output?.cancel || "Cancel";

  async function handleCopy() {
    await onCopy?.();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  }

  function handleDownload() {
    onDownload?.();
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 1200);
  }

  return (
    <div className="content-action-row">
      {result && isEditing ? (
        <button
          type="button"
          className="primary-button improve-button"
          onClick={onSave}
          disabled={saving}
        >
          {saveLabel}
        </button>
      ) : (result && onImprove ? <button type="button" className="primary-button improve-button" onClick={onImprove}>{copy.output.improve}</button> : <span />)}
      <div className="content-action-right">
        {result && canEdit ? (
          isEditing ? (
            <button
              type="button"
              className="ghost-button icon-text-button"
              onClick={onCancel}
              disabled={saving}
            >
              <span className="button-icon" aria-hidden="true">↺</span>
              <span>{cancelLabel}</span>
            </button>
          ) : (
            <button
              type="button"
              className="ghost-button icon-text-button"
              onClick={onStartEdit}
            >
              <span className="button-icon" aria-hidden="true">✎</span>
              <span>{editLabel}</span>
            </button>
          )
        ) : null}
        {result ? (
          <button
            type="button"
            className={`ghost-button icon-text-button ${copied ? "is-success" : ""}`}
            onClick={handleCopy}
            disabled={isEditing || saving}
          >
            <span className="button-icon" aria-hidden="true">⧉</span>
            <span>{copied ? (language === "vi" ? "Đã copy" : "Copied") : copy.output.copy}</span>
          </button>
        ) : null}
        {result ? (
          <button
            type="button"
            className={`ghost-button icon-text-button ${downloaded ? "is-success" : ""}`}
            onClick={handleDownload}
            disabled={isEditing || saving}
          >
            <span className="button-icon" aria-hidden="true">⇩</span>
            <span>{downloaded ? (language === "vi" ? "Đã tải" : "Downloaded") : copy.output.download}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
