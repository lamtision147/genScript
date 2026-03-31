"use client";

import NextHistoryList from "@/components/next-history-list";
import NextEmptyState from "@/components/next-empty-state";
import { getCopy } from "@/lib/i18n";

export default function NextHistoryCard({
  session,
  history,
  activeHistoryId,
  favoriteIds,
  onOpen,
  onToggleFavorite,
  onDelete,
  language = "vi"
}) {
  const copy = getCopy(language);

  return (
    <section className="history-card">
      <div className="history-head">
        <h3 className="subsection-title">{copy.history.title}</h3>
        <span className="inline-note">{session ? copy.history.versions(history.length) : copy.history.loginSyncNeeded}</span>
      </div>
      {session ? <div className="history-summary-bar">{history.length ? copy.history.tipHasHistory : copy.history.tipEmpty}</div> : null}
      {!session ? <NextEmptyState>{copy.history.loginPrompt}</NextEmptyState> : null}
      {session ? <NextHistoryList items={history} activeHistoryId={activeHistoryId} favoriteIds={favoriteIds} onOpen={onOpen} onToggleFavorite={onToggleFavorite} onDelete={onDelete} language={language} emptyText={copy.history.empty} /> : null}
    </section>
  );
}
