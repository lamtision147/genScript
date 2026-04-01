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
  const list = Array.isArray(history) ? history : [];
  const historyLimit = session?.planLimits?.historyLimit;
  const isPro = String(session?.plan || "free") === "pro";
  const shouldShowUpgradeHint = Boolean(session) && !isPro && Number.isFinite(Number(historyLimit)) && list.length >= Number(historyLimit);

  return (
    <section className="history-card">
      <div className="history-head">
        <h3 className="subsection-title">{copy.history.title}</h3>
        <span className="inline-note">{session ? copy.history.versions(list.length) : copy.history.loginSyncNeeded}</span>
      </div>
      {session ? <div className="history-summary-bar">{list.length ? copy.history.tipHasHistory : copy.history.tipEmpty}</div> : null}
      {shouldShowUpgradeHint ? (
        <div className="history-empty">
          {language === "vi"
            ? `Gói Free chỉ hiển thị tối đa ${historyLimit} lịch sử gần nhất. Nâng cấp Pro để xem không giới hạn.`
            : `Free plan shows up to ${historyLimit} recent history items. Upgrade to Pro for unlimited history.`}
        </div>
      ) : null}
      {!session ? <NextEmptyState>{copy.history.loginPrompt}</NextEmptyState> : null}
      {session ? <NextHistoryList items={list} activeHistoryId={activeHistoryId} favoriteIds={favoriteIds} onOpen={onOpen} onToggleFavorite={onToggleFavorite} onDelete={onDelete} language={language} emptyText={copy.history.empty} /> : null}
    </section>
  );
}
