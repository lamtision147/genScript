"use client";

import { getHistoryMeta, getHistoryTitle } from "@/lib/history-display";

export default function NextHistoryList({
  items,
  activeHistoryId,
  favoriteIds,
  onOpen,
  onToggleFavorite,
  onDelete,
  emptyText,
  showSource = true
}) {
  if (!items.length) {
    return <div className="history-empty">{emptyText}</div>;
  }

  return (
    <div className="history-list">
      {items.map((item) => (
        <div key={item.id} className={`history-item ${activeHistoryId === item.id ? "active" : ""}`}>
          <span className="history-item-main">
            <span className="history-title">{getHistoryTitle(item)}</span>
            <span className="history-meta">{getHistoryMeta(item, { showSource })}</span>
          </span>
          <span className="history-actions-inline">
            <button type="button" className={`favorite-button ${favoriteIds?.has?.(item.id) ? "active" : ""}`} onClick={() => onToggleFavorite(item.id)}>&#9733;</button>
            {onDelete ? <button type="button" className="ghost-button history-mini-button" onClick={() => onDelete(item.id)}>Xóa</button> : null}
            <button type="button" className="ghost-button history-mini-button" onClick={() => onOpen(item)}>Xem lại</button>
          </span>
        </div>
      ))}
    </div>
  );
}
