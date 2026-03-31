"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import NextPageFrame from "@/components/next-page-frame";
import NextShellHeader from "@/components/next-shell-header";
import NextAdminUsersTable from "@/components/next-admin-users-table";
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
            eyebrow="Seller Studio"
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
          eyebrow="Seller Studio"
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
          onResetPassword={actions.resetPassword}
          onDeleteUser={actions.deleteUser}
          onQueryChange={actions.setQuery}
          onPageChange={actions.setPage}
          onPageSizeChange={actions.setPageSize}
          onUsageDaysChange={actions.setUsageDays}
          onLaunchMetricsDaysChange={actions.setLaunchMetricsDays}
          language={language}
        />
      </section>
    </NextPageFrame>
  );
}
