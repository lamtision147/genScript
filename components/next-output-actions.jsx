"use client";

import { useState } from "react";
import { getCopy } from "@/lib/i18n";

export default function NextOutputActions({ result, onImprove, onCopy, onDownload, language = "vi" }) {
  const copy = getCopy(language);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

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
      {result ? <button type="button" className="primary-button improve-button" onClick={onImprove}>{copy.output.improve}</button> : <span />}
      <div className="content-action-right">
        {result ? (
          <button
            type="button"
            className={`ghost-button icon-text-button ${copied ? "is-success" : ""}`}
            onClick={handleCopy}
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
          >
            <span className="button-icon" aria-hidden="true">⇩</span>
            <span>{downloaded ? (language === "vi" ? "Đã tải" : "Downloaded") : copy.output.download}</span>
          </button>
        ) : null}
      </div>
    </div>
  );
}
