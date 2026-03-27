"use client";

import NextShellHeader from "@/components/next-shell-header";
import NextHistoryCard from "@/components/next-history-card";
import NextOutputCard from "@/components/next-output-card";
import NextProductFormPanel from "@/components/next-product-form-panel";
import NextPageFrame from "@/components/next-page-frame";
import { brandStyleOptions, categoryHints, categoryOptions, channelOptions, moodOptions, samplePresets, subcategoryMap, toneOptions } from "@/lib/product-config";
import { useProductWorkspace } from "@/hooks/use-product-workspace";

export default function NextScriptProductInfoPage({ initialHistoryId = "" }) {
  const {
    session,
    history,
    loading,
    result,
    message,
    activeHistoryId,
    form,
    favoriteIds,
    currentSubcategories,
    actions
  } = useProductWorkspace({ initialHistoryId, samplePresets, subcategoryMap });

  return (
    <NextPageFrame>
        <NextShellHeader
          eyebrow="Seller Studio / Next.js"
          title="Tạo nội dung giới thiệu sản phẩm"
          subtitle="Sinh content đăng TikTok Shop và Shopee từ ảnh sản phẩm, tên sản phẩm và brief liên quan theo đúng phong cách bạn chọn."
          user={session}
          insightTitle={session ? `Xin chào, ${session.name}` : "Chưa đăng nhập"}
          insightText={session ? "Lịch sử, phiên bản cải tiến và nội dung yêu thích đang đồng bộ theo tài khoản của bạn." : "Đăng nhập để đồng bộ lịch sử, cải tiến nội dung và danh sách yêu thích."}
        />
        <section className="layout">
          <NextProductFormPanel
            form={form}
            categoryOptions={categoryOptions}
            channelOptions={channelOptions}
            currentSubcategories={currentSubcategories}
            toneOptions={toneOptions}
            brandStyleOptions={brandStyleOptions}
            moodOptions={moodOptions}
            categoryHints={categoryHints}
            onApplySample={actions.applySample}
            onClearDraft={actions.clearDraft}
            onCategoryChange={actions.handleCategoryChange}
            onFieldChange={actions.handleFieldChange}
            onImageSelect={actions.handleImageSelect}
            onRemoveImage={actions.removeImage}
            onGenerate={() => actions.handleGenerate(false)}
            loading={loading}
          />

          <section className="panel">
            <NextOutputCard
              loading={loading}
              result={result}
              message={message}
              session={session}
              onImprove={() => actions.handleGenerate(true)}
              onCopy={actions.copyResult}
              onDownload={actions.downloadDoc}
            />
            <NextHistoryCard
              session={session}
              history={history}
              activeHistoryId={activeHistoryId}
              favoriteIds={favoriteIds}
              onOpen={actions.openHistoryItem}
              onToggleFavorite={actions.toggleFavorite}
              onDelete={actions.deleteHistory}
            />
          </section>
        </section>
    </NextPageFrame>
  );
}
