"use client";

import { uiCopy } from "@/lib/ui-copy";
import NextOutputActions from "@/components/next-output-actions";
import NextEmptyState from "@/components/next-empty-state";
import NextStatusBadge from "@/components/next-status-badge";

export default function NextOutputCard({
  loading,
  result,
  message,
  session,
  onImprove,
  onCopy,
  onDownload
}) {
  const { product } = uiCopy;
  return (
    <section className="content-card">
      <div className="content-card-top">
        <h2 className="right-title content-title">{product.outputTitle}</h2>
        {result ? <NextStatusBadge tone={result.source === "ai" ? "ai" : "fallback"}>{result.source === "ai" ? "Nguồn: AI" : "Nguồn: Fallback"}</NextStatusBadge> : null}
        <NextOutputActions result={result} onImprove={onImprove} onCopy={onCopy} onDownload={onDownload} />
      </div>
      <div className="content-body">
        {!loading && result ? <div className="result-readability-hint">Bố cục đã tối ưu theo chuẩn đọc nhanh trên TikTok Shop/Shopee: mở nhanh, lợi ích rõ, chốt gọn.</div> : null}
        {loading ? <div className="ai-loading-card"><div className="ai-loading-orbit"><span /><span /><span /></div><div className="ai-loading-text">{product.loading}</div></div> : null}
        {!loading && message ? <NextEmptyState error>{message}</NextEmptyState> : null}
        {!loading && !result && !message ? <NextEmptyState>{product.emptyOutput}</NextEmptyState> : null}
        {!loading && result ? result.paragraphs?.map((paragraph, index) => <div key={index} className={`textarea-block output-paragraph output-paragraph-${index + 1}`}>{paragraph}</div>) : null}
        {!loading && result?.hashtags?.length ? <div className="hashtag-wrap"><div className="hashtag-list">{result.hashtags.map((tag) => <span key={tag} className="hashtag-chip">{tag}</span>)}</div></div> : null}
        {!session ? <NextEmptyState>{product.loginPrompt}</NextEmptyState> : null}
      </div>
    </section>
  );
}
