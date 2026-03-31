"use client";

import NextHistoryList from "@/components/next-history-list";

export default function NextFavoritesSection({ favorites, onOpen, onToggleFavorite, emptyText, language = "vi" }) {
  return (
    <NextHistoryList
      items={favorites}
      activeHistoryId={null}
      favoriteIds={new Set(favorites.map((item) => item.id))}
      onOpen={onOpen}
      onToggleFavorite={onToggleFavorite}
      emptyText={emptyText}
      showSource={false}
      language={language}
    />
  );
}
