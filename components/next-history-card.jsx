"use client";

import NextHistoryList from "@/components/next-history-list";
import { uiCopy } from "@/lib/ui-copy";
import NextEmptyState from "@/components/next-empty-state";

export default function NextHistoryCard({
  session,
  history,
  activeHistoryId,
  favoriteIds,
  onOpen,
  onToggleFavorite,
  onDelete
}) {
  return (
    <section className="history-card">
      <div className="history-head">
        <h3 className="subsection-title">{uiCopy.product.historyTitle}</h3>
        <span className="inline-note">{session ? `${history.length} phiên bản` : "Cần đăng nhập để đồng bộ"}</span>
      </div>
      {session ? <div className="history-summary-bar">{history.length ? "Tip: chọn bản tốt nhất, bấm Cải tiến thêm để tạo bản chốt sale nhanh hơn." : "Chưa có bản nào. Hãy tạo bản đầu tiên để bắt đầu lưu lịch sử."}</div> : null}
      {!session ? <NextEmptyState>{uiCopy.product.historyLoginPrompt}</NextEmptyState> : null}
      {session ? <NextHistoryList items={history} activeHistoryId={activeHistoryId} favoriteIds={favoriteIds} onOpen={onOpen} onToggleFavorite={onToggleFavorite} onDelete={onDelete} /> : null}
    </section>
  );
}
