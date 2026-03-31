"use client";

import NextOutputActions from "@/components/next-output-actions";
import NextEmptyState from "@/components/next-empty-state";
import NextStatusBadge from "@/components/next-status-badge";
import { getCopy } from "@/lib/i18n";

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
  language = "vi"
}) {
  const copy = getCopy(language);
  return (
    <section className="content-card">
      <div className="content-card-top">
        <h2 className="right-title content-title">{copy.output.title}</h2>
        {result ? <NextStatusBadge tone={result.source === "ai" ? "ai" : "fallback"}>{result.source === "ai" ? copy.output.sourceAi : copy.output.sourceFallback}</NextStatusBadge> : null}
        {result?.quality?.score ? <NextStatusBadge tone={result.quality.score >= 84 ? "ai" : "fallback"}>{copy.output.qualityLabel}: {result.quality.grade} ({result.quality.score})</NextStatusBadge> : null}
        {variants.length > 1 ? (
          <div className="variant-toggle-row">
            {variants.map((variant, index) => (
              <button
                key={`variant-${index}`}
                type="button"
                className={`ghost-button variant-toggle ${selectedVariant === index ? "active" : ""}`}
                onClick={() => onPickVariant?.(index)}
              >
                {copy.output.variant} {index === 0 ? "A" : "B"} · {variant?.quality?.score ?? "-"}
              </button>
            ))}
          </div>
        ) : null}
        <NextOutputActions result={result} onImprove={onImprove} onCopy={onCopy} onDownload={onDownload} language={language} />
      </div>
      <div className={`content-body ${loading ? "is-generating" : "is-ready"}`}>
        {!loading && result ? <div className="result-readability-hint">{copy.output.readabilityHint}</div> : null}
        {!loading && result?.promptVersion ? <div className="result-readability-hint">Prompt: {result.promptVersion}</div> : null}
        {!loading && result?.quality?.reasons?.length ? <div className="result-readability-hint">{copy.output.optimizeHintPrefix} {result.quality.reasons.join(" · ")}</div> : null}
        {loading ? <div className="ai-loading-card"><div className="ai-loading-orbit"><span /><span /><span /></div><div className="ai-loading-text">{copy.output.loading}</div></div> : null}
        {!loading && message ? <NextEmptyState error>{message}</NextEmptyState> : null}
        {!loading && !result && !message ? <NextEmptyState>{copy.output.empty}</NextEmptyState> : null}
        {!loading && result ? result.paragraphs?.map((paragraph, index) => <div key={index} className={`textarea-block output-paragraph output-paragraph-${index + 1}`}>{paragraph}</div>) : null}
        {!loading && result?.hashtags?.length ? <div className="hashtag-wrap"><div className="hashtag-list">{result.hashtags.map((tag) => <span key={tag} className="hashtag-chip">{tag}</span>)}</div></div> : null}
        {!session ? <NextEmptyState>{copy.output.loginPrompt}</NextEmptyState> : null}
      </div>
    </section>
  );
}
