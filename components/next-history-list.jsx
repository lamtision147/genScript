"use client";

import { getHistoryMeta, getHistoryTitle } from "@/lib/history-display";
import { getCopy } from "@/lib/i18n";

export default function NextHistoryList({
  items,
  activeHistoryId,
  favoriteIds,
  onOpen,
  onToggleFavorite,
  onDelete,
  emptyText,
  showSource = true,
  language = "vi"
}) {
  const copy = getCopy(language);

  if (!items.length) {
    return <div className="history-empty">{emptyText}</div>;
  }

  return (
    <div className="history-list">
      {items.map((item) => (
        <div key={item.id} className={`history-item ${activeHistoryId === item.id ? "active" : ""}`}>
          <span className="history-item-main">
            <span className="history-title profile-vi-text">{getHistoryTitle(item)}</span>
            <span className="history-meta profile-vi-text">{getHistoryMeta(item, { showSource, locale: copy.messages.historyDateLocale })}</span>
          </span>
          <span className="history-actions-inline">
            <button type="button" className={`favorite-button ${favoriteIds?.has?.(item.id) || item?.isFavorite ? "active" : ""}`} onClick={() => onToggleFavorite(item.id)}>&#9733;</button>
            {onDelete ? <button type="button" className="ghost-button history-mini-button" onClick={() => onDelete(item.id)}>{copy.history.delete}</button> : null}
            <button type="button" className="ghost-button history-mini-button" onClick={() => onOpen(item)}>{copy.history.open}</button>
          </span>
        </div>
      ))}
    </div>
  );
}
