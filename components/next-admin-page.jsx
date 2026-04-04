"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import NextPageFrame from "@/components/next-page-frame";
import NextShellHeader from "@/components/next-shell-header";
import NextAdminUsersTable from "@/components/next-admin-users-table";
import NextAdminBillingPanel from "@/components/next-admin-billing-panel";
import { useAdminWorkspace } from "@/hooks/use-admin-workspace";
import { useUiLanguage } from "@/hooks/use-ui-language";

function isAdminUser(user) {
  return Boolean(user?.isAdmin);
}

export default function NextAdminPage() {
  const router = useRouter();
  const { language, setLanguage } = useUiLanguage("vi");
  const isVi = language === "vi";
  const {
    session,
    users,
    allUsers,
    query,
    page,
    pageSize,
    pagination,
    usageSummary,
    usageDays,
    launchMetrics,
    launchMetricsDays,
    supportConversations,
    supportStatus,
    supportQuery,
    supportPage,
    supportMeta,
    activeSupportConversationId,
    activeSupportConversation,
    activeSupportMessages,
    supportThreadLoading,
    supportSending,
    supportAdminDraft,
    supportRealtimeOn,
    billingSubscriptions,
    billingQuery,
    billingPage,
    billingMeta,
    billingChanging,
    loading,
    ready,
    message,
    messageCode,
    actions
  } = useAdminWorkspace(language);

  const isAdmin = isAdminUser(session);

  useEffect(() => {
    if (ready && !session) {
      router.replace("/login");
    }
  }, [ready, session, router]);

  if (!ready) {
    return (
      <NextPageFrame>
        <section className="panel full-span">
          <div className="history-empty">{isVi ? "Đang tải không gian quản trị..." : "Loading admin workspace..."}</div>
        </section>
      </NextPageFrame>
    );
  }

  if (!session) {
    return null;
  }

  if (!loading && session && !isAdmin) {
    return (
      <NextPageFrame>
        <section className="panel full-span">
          <NextShellHeader
            eyebrow="SellerScript"
            title={isVi ? "Quản trị" : "Admin"}
            subtitle=""
            user={session}
            language={language}
            onLanguageChange={setLanguage}
          />
          <div className="history-empty error-state">{isVi ? "Bạn không có quyền truy cập khu vực này." : "Forbidden. This area is available for admin accounts only."}</div>
        </section>
      </NextPageFrame>
    );
  }

  return (
    <NextPageFrame>
      <section className="panel full-span">
        <NextShellHeader
          eyebrow="SellerScript"
          title={isVi ? "Bảng điều khiển quản trị" : "Admin Dashboard"}
          subtitle={isVi ? "Quản lý người dùng, đặt lại mật khẩu và dọn dữ liệu tài khoản." : "Manage users, password resets, and account cleanup."}
          user={session}
          language={language}
          onLanguageChange={setLanguage}
        />
        <NextAdminUsersTable
          users={users}
          allUsers={allUsers}
          loading={loading}
          message={message}
          messageCode={messageCode}
          query={query}
          page={page}
          pageSize={pageSize}
          pagination={pagination}
          usageSummary={usageSummary}
          usageDays={usageDays}
          launchMetrics={launchMetrics}
          launchMetricsDays={launchMetricsDays}
          supportConversations={supportConversations}
          supportStatus={supportStatus}
          supportQuery={supportQuery}
          supportPage={supportPage}
          supportMeta={supportMeta}
          activeSupportConversationId={activeSupportConversationId}
          activeSupportConversation={activeSupportConversation}
          activeSupportMessages={activeSupportMessages}
          supportThreadLoading={supportThreadLoading}
          supportSending={supportSending}
          supportAdminDraft={supportAdminDraft}
          realtimeOn={supportRealtimeOn}
          onResetPassword={actions.resetPassword}
          onDeleteUser={actions.deleteUser}
          onQueryChange={actions.setQuery}
          onPageChange={actions.setPage}
          onPageSizeChange={actions.setPageSize}
          onUsageDaysChange={actions.setUsageDays}
          onLaunchMetricsDaysChange={actions.setLaunchMetricsDays}
          onSupportStatusChange={actions.setSupportStatus}
          onSupportQueryChange={actions.setSupportQuery}
          onSupportPageChange={actions.setSupportPage}
          onSupportUpdate={actions.updateSupportRequest}
          onSupportSelectConversation={actions.setActiveSupportConversationId}
          onSupportAdminDraftChange={actions.setSupportAdminDraft}
          onSupportSendReply={actions.sendSupportReply}
          language={language}
        />

        <NextAdminBillingPanel
          loading={loading}
          subscriptions={billingSubscriptions}
          query={billingQuery}
          page={billingPage}
          meta={billingMeta}
          changing={billingChanging}
          language={language}
          onQueryChange={actions.setBillingQuery}
          onPageChange={actions.setBillingPage}
          onExport={actions.exportBillingCsv}
          onUpgrade={(userId) => actions.updateUserPlan(userId, "pro")}
          onDowngrade={(userId) => actions.updateUserPlan(userId, "free")}
          onVerifyManualPayment={actions.verifyManualPayment}
        />
      </section>
    </NextPageFrame>
  );
}


