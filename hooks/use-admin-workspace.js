"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client/api";
import { routes } from "@/lib/routes";

const ADMIN_ERROR_MESSAGES = {
  vi: {
    load: "Không thể tải dữ liệu quản trị.",
    reset: "Không thể đặt lại mật khẩu.",
    delete: "Không thể xóa người dùng."
  },
  en: {
    load: "Unable to load admin data.",
    reset: "Unable to reset password.",
    delete: "Unable to delete user."
  }
};

function getAdminErrorMessage(language, key) {
  const lang = language === "vi" ? "vi" : "en";
  return ADMIN_ERROR_MESSAGES[lang][key] || ADMIN_ERROR_MESSAGES.en[key] || "Unexpected error";
}

const INITIAL_META = {
  page: 1,
  pageSize: 20,
  total: 0,
  totalPages: 1
};

const INITIAL_USAGE_SUMMARY = {
  totals: {
    requestCount: 0,
    successCount: 0,
    fallbackCount: 0,
    suggestCount: 0,
    suggestSuccessCount: 0,
    suggestFallbackCount: 0,
    successRate: 0,
    suggestSuccessRate: 0
  },
  latestDay: null,
  daily: []
};

const INITIAL_LAUNCH_METRICS = {
  days: 14,
  totals: {
    telemetryEvents: 0,
    generateSubmit: 0,
    generateSuccess: 0,
    generateSuccessRate: 0,
    suggestSuccess: 0,
    suggestFailed: 0
  },
  firstRun: {
    sessionCount: 0,
    firstOutputCompletedCount: 0,
    firstOutputCompletionRate: 0,
    averageFirstOutputMs: 0,
    p95FirstOutputMs: 0,
    suggestEngagedSessions: 0,
    suggestEngagementRate: 0,
    onboardingCompletionRate30m: 0
  },
  funnel: {
    openedWorkspace: 0,
    onboardingSeen: 0,
    onboardingSkipped: 0,
    onboardingStartedGuide: 0,
    generated: 0,
    generatedSuccess: 0,
    feedbackSubmitted: 0
  },
  topErrors: [],
  daily: []
};

export function useAdminWorkspace(language = "vi") {
  const [session, setSession] = useState(null);
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [pagination, setPagination] = useState(INITIAL_META);
  const [usageSummary, setUsageSummary] = useState(INITIAL_USAGE_SUMMARY);
  const [usageDays, setUsageDays] = useState(30);
  const [launchMetrics, setLaunchMetrics] = useState(INITIAL_LAUNCH_METRICS);
  const [launchMetricsDays, setLaunchMetricsDays] = useState(14);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const [message, setMessage] = useState("");
  const [messageCode, setMessageCode] = useState("");

  const loadAdminData = useCallback(async (opts = {}) => {
    const nextQuery = typeof opts.query === "string" ? opts.query : query;
    const nextPage = Number.isFinite(Number(opts.page)) ? Number(opts.page) : page;
    const nextPageSize = Number.isFinite(Number(opts.pageSize)) ? Number(opts.pageSize) : pageSize;
    const includeAllUsers = Boolean(opts.includeAllUsers);

    setLoading(true);
    setMessage("");
    setMessageCode("");
    try {
      const [sessionData, usersData, fullUsersData, usageData, launchMetricsData] = await Promise.all([
        apiGet(routes.api.session, { user: null }),
        apiGet(
          `${routes.api.adminUsers}?q=${encodeURIComponent(nextQuery)}&page=${nextPage}&pageSize=${nextPageSize}`,
          { items: [], meta: { ...INITIAL_META, page: nextPage, pageSize: nextPageSize } }
        ),
        includeAllUsers
          ? apiGet(`${routes.api.adminUsers}?page=1&pageSize=500`, { items: [], meta: { ...INITIAL_META, page: 1, pageSize: 500 } })
          : Promise.resolve(null),
        apiGet(`${routes.api.adminAiUsage}?days=${usageDays}`, INITIAL_USAGE_SUMMARY),
        apiGet(`${routes.api.adminLaunchMetrics}?days=${launchMetricsDays}`, INITIAL_LAUNCH_METRICS)
      ]);

      setSession(sessionData.user || null);
      setUsers(Array.isArray(usersData.items) ? usersData.items : []);
      setPagination(usersData.meta || { ...INITIAL_META, page: nextPage, pageSize: nextPageSize, total: usersData.items?.length || 0 });

      if (includeAllUsers && fullUsersData) {
        setAllUsers(Array.isArray(fullUsersData.items) ? fullUsersData.items : []);
      }
      setUsageSummary(usageData || INITIAL_USAGE_SUMMARY);
      setLaunchMetrics(launchMetricsData || INITIAL_LAUNCH_METRICS);
    } catch (error) {
      setMessage(error.message || getAdminErrorMessage(language, "load"));
      setMessageCode("load_failed");
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [page, pageSize, query, usageDays, launchMetricsDays, language]);

  useEffect(() => {
    loadAdminData({ includeAllUsers: true });
  }, [loadAdminData, refreshToken]);

  async function resetPassword(userId, newPassword) {
    try {
      await apiPost(routes.api.adminUsersResetPassword, { userId, newPassword });
      setMessageCode("reset_success");
      setMessage("");
      setRefreshToken((prev) => prev + 1);
    } catch (error) {
      setMessage(error.message || getAdminErrorMessage(language, "reset"));
      setMessageCode("reset_failed");
    }
  }

  async function deleteUser(userId) {
    try {
      await apiPost(routes.api.adminUsersDelete, { userId });
      setMessageCode("delete_success");
      setMessage("");
      setRefreshToken((prev) => prev + 1);
    } catch (error) {
      setMessage(error.message || getAdminErrorMessage(language, "delete"));
      setMessageCode("delete_failed");
    }
  }

  function updateQuery(nextQuery) {
    setReady(false);
    setQuery(nextQuery);
    setPage(1);
  }

  function updatePageSize(nextPageSize) {
    setReady(false);
    setPageSize(nextPageSize);
    setPage(1);
  }

  function updateUsageDays(nextDays) {
    setReady(false);
    setUsageDays(Math.max(1, Math.min(120, Number(nextDays) || 30)));
  }

  function updateLaunchMetricsDays(nextDays) {
    setReady(false);
    setLaunchMetricsDays(Math.max(1, Math.min(60, Number(nextDays) || 14)));
  }

  return {
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
    actions: {
      loadAdminData,
      resetPassword,
      deleteUser,
      setQuery: updateQuery,
      setPage,
      setPageSize: updatePageSize,
      setUsageDays: updateUsageDays,
      setLaunchMetricsDays: updateLaunchMetricsDays,
      setMessage,
      setMessageCode
    }
  };
}
