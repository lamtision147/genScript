"use client";

import NextHistoryList from "@/components/next-history-list";

export default function NextFavoritesSection({ favorites, onOpen, onToggleFavorite, emptyText, language = "vi" }) {
  const list = Array.isArray(favorites) ? favorites : [];

  return (
    <NextHistoryList
      items={list}
      activeHistoryId={null}
      favoriteIds={new Set(list.map((item) => item.id))}
      onOpen={onOpen}
      onToggleFavorite={onToggleFavorite}
      emptyText={emptyText}
      showSource={false}
      language={language}
    />
  );
}
