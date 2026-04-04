"use client";

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/client/api";
import { routes } from "@/lib/routes";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

const ADMIN_ERROR_MESSAGES = {
  vi: {
    load: "Không thể tải dữ liệu quản trị.",
    reset: "Không thể đặt lại mật khẩu.",
    delete: "Không thể xóa người dùng.",
    support: "Không thể thao tác trò chuyện hỗ trợ."
  },
  en: {
    load: "Unable to load admin data.",
    reset: "Unable to reset password.",
    delete: "Unable to delete user.",
    support: "Unable to process support chat action."
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
  const [supportConversations, setSupportConversations] = useState([]);
  const [supportStatus, setSupportStatus] = useState("");
  const [supportQuery, setSupportQuery] = useState("");
  const [supportPage, setSupportPage] = useState(1);
  const [supportMeta, setSupportMeta] = useState(INITIAL_META);
  const [activeSupportConversationId, setActiveSupportConversationId] = useState("");
  const [activeSupportConversation, setActiveSupportConversation] = useState(null);
  const [activeSupportMessages, setActiveSupportMessages] = useState([]);
  const [supportThreadLoading, setSupportThreadLoading] = useState(false);
  const [supportSending, setSupportSending] = useState(false);
  const [supportAdminDraft, setSupportAdminDraft] = useState("");
  const [supportRealtimeOn, setSupportRealtimeOn] = useState(false);
  const [billingSubscriptions, setBillingSubscriptions] = useState([]);
  const [billingQuery, setBillingQuery] = useState("");
  const [billingPage, setBillingPage] = useState(1);
  const [billingMeta, setBillingMeta] = useState(INITIAL_META);
  const [billingChanging, setBillingChanging] = useState({ userId: "", action: "" });
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("");
  const [messageCode, setMessageCode] = useState("");

  const refreshSupportConversations = useCallback(async ({ silent = false } = {}) => {
    try {
      const data = await apiGet(
        `${routes.api.adminSupportChat}?status=${encodeURIComponent(supportStatus)}&q=${encodeURIComponent(supportQuery)}&page=${supportPage}&pageSize=20&t=${Date.now()}`,
        { items: [], meta: INITIAL_META }
      );

      const nextItems = Array.isArray(data?.items) ? data.items : [];
      setSupportConversations(nextItems);
      setSupportMeta(data?.meta || INITIAL_META);

      const hasCurrent = activeSupportConversationId && nextItems.some((item) => item.id === activeSupportConversationId);
      if (!hasCurrent) {
        setActiveSupportConversationId(nextItems[0]?.id || "");
      }
    } catch (error) {
      if (!silent) {
        setMessage(error.message || getAdminErrorMessage(language, "support"));
        setMessageCode("support_list_failed");
      }
    }
  }, [supportStatus, supportQuery, supportPage, activeSupportConversationId, language]);

  const loadAdminData = useCallback(async (opts = {}) => {
    const nextQuery = typeof opts.query === "string" ? opts.query : query;
    const nextPage = Number.isFinite(Number(opts.page)) ? Number(opts.page) : page;
    const nextPageSize = Number.isFinite(Number(opts.pageSize)) ? Number(opts.pageSize) : pageSize;
    const includeAllUsers = Boolean(opts.includeAllUsers);

    setLoading(true);
    setMessage("");
    setMessageCode("");
    try {
      const [sessionData, usersData, fullUsersData, usageData, launchMetricsData, supportData, billingData] = await Promise.all([
        apiGet(routes.api.session, { user: null }),
        apiGet(
          `${routes.api.adminUsers}?q=${encodeURIComponent(nextQuery)}&page=${nextPage}&pageSize=${nextPageSize}`,
          { items: [], meta: { ...INITIAL_META, page: nextPage, pageSize: nextPageSize } }
        ),
        includeAllUsers
          ? apiGet(`${routes.api.adminUsers}?page=1&pageSize=500`, { items: [], meta: { ...INITIAL_META, page: 1, pageSize: 500 } })
          : Promise.resolve(null),
        apiGet(`${routes.api.adminAiUsage}?days=${usageDays}`, INITIAL_USAGE_SUMMARY),
        apiGet(`${routes.api.adminLaunchMetrics}?days=${launchMetricsDays}`, INITIAL_LAUNCH_METRICS),
        apiGet(
          `${routes.api.adminSupportChat}?status=${encodeURIComponent(supportStatus)}&q=${encodeURIComponent(supportQuery)}&page=${supportPage}&pageSize=20&t=${Date.now()}`,
          { items: [], meta: INITIAL_META }
        ),
        apiGet(
          `${routes.api.adminBillingSubscriptions}?q=${encodeURIComponent(billingQuery)}&page=${billingPage}&pageSize=20`,
          { items: [], meta: INITIAL_META }
        )
      ]);

      setSession(sessionData.user || null);
      setUsers(Array.isArray(usersData.items) ? usersData.items : []);
      setPagination(usersData.meta || { ...INITIAL_META, page: nextPage, pageSize: nextPageSize, total: usersData.items?.length || 0 });

      if (includeAllUsers && fullUsersData) {
        setAllUsers(Array.isArray(fullUsersData.items) ? fullUsersData.items : []);
      }
      setUsageSummary(usageData || INITIAL_USAGE_SUMMARY);
      setLaunchMetrics(launchMetricsData || INITIAL_LAUNCH_METRICS);
      const nextItems = Array.isArray(supportData?.items) ? supportData.items : [];
      setSupportConversations(nextItems);
      setSupportMeta(supportData?.meta || INITIAL_META);

      setBillingSubscriptions(Array.isArray(billingData?.items) ? billingData.items : []);
      setBillingMeta(billingData?.meta || INITIAL_META);

      const nextActiveId = activeSupportConversationId && nextItems.some((item) => item.id === activeSupportConversationId)
        ? activeSupportConversationId
        : (nextItems[0]?.id || "");
      setActiveSupportConversationId(nextActiveId);
      if (!nextActiveId) {
        setActiveSupportConversation(null);
        setActiveSupportMessages([]);
      }
    } catch (error) {
      setMessage(error.message || getAdminErrorMessage(language, "load"));
      setMessageCode("load_failed");
    } finally {
      setLoading(false);
      setReady(true);
    }
  }, [page, pageSize, query, usageDays, launchMetricsDays, supportStatus, supportQuery, supportPage, billingQuery, billingPage, language, activeSupportConversationId]);

  const loadSupportThread = useCallback(async (conversationId, { silent = false } = {}) => {
    if (!conversationId) return;
    if (!silent) {
      setSupportThreadLoading(true);
    }
    try {
      const data = await apiGet(`${routes.api.adminSupportChat}?conversationId=${encodeURIComponent(conversationId)}&t=${Date.now()}`, {
        conversation: null,
        messages: []
      });
      setActiveSupportConversation(data?.conversation || null);
      setActiveSupportMessages(Array.isArray(data?.messages) ? data.messages : []);
    } catch (error) {
      setMessage(error.message || getAdminErrorMessage(language, "support"));
      setMessageCode("support_thread_failed");
    } finally {
      if (!silent) {
        setSupportThreadLoading(false);
      }
    }
  }, [language]);

  useEffect(() => {
    if (!activeSupportConversationId) return;
    loadSupportThread(activeSupportConversationId);
  }, [activeSupportConversationId, loadSupportThread]);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase || !activeSupportConversationId) {
      setSupportRealtimeOn(false);
      return;
    }

    const channel = supabase
      .channel(`admin-support-chat-${activeSupportConversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "support_chat_messages",
          filter: `conversation_id=eq.${activeSupportConversationId}`
        },
        () => {
          loadSupportThread(activeSupportConversationId, { silent: true });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "support_chat_conversations",
          filter: `id=eq.${activeSupportConversationId}`
        },
        () => {
          loadSupportThread(activeSupportConversationId, { silent: true });
        }
      );

    channel.subscribe((status) => {
      setSupportRealtimeOn(status === "SUBSCRIBED");
    });

    return () => {
      setSupportRealtimeOn(false);
      supabase.removeChannel(channel).catch(() => {});
    };
  }, [activeSupportConversationId, loadSupportThread]);

  useEffect(() => {
    if (!supportConversations.length) {
      setActiveSupportConversationId("");
      setActiveSupportConversation(null);
      setActiveSupportMessages([]);
      return;
    }
  }, [supportConversations, activeSupportConversationId]);

  useEffect(() => {
    if (!activeSupportConversationId || supportRealtimeOn) return;

    const timer = setInterval(() => {
      loadSupportThread(activeSupportConversationId, { silent: true });
    }, 12000);

    return () => clearInterval(timer);
  }, [activeSupportConversationId, supportRealtimeOn, loadSupportThread]);

  async function updateSupportRequest(requestId, payload) {
    try {
      await apiPost(routes.api.adminSupportChat, { conversationId: requestId, ...payload });
      setMessage("");
      setMessageCode("support_update_success");
      refreshSupportConversations({ silent: true });
      if (requestId) {
        loadSupportThread(requestId, { silent: true });
      }
    } catch (error) {
      setMessage(error.message || getAdminErrorMessage(language, "support"));
      setMessageCode("support_update_failed");
    }
  }

  async function sendSupportReply(conversationId, message, status = "") {
    const safeMessage = String(message || "").trim();
    if (!conversationId) return;
    if (!safeMessage && !status) return;

    setSupportSending(true);
    try {
      const data = await apiPost(routes.api.adminSupportChat, {
        conversationId,
        message: safeMessage,
        status
      });
      setActiveSupportConversation(data?.conversation || null);
      setActiveSupportMessages(Array.isArray(data?.messages) ? data.messages : []);
      setSupportAdminDraft("");
      setMessage("");
      setMessageCode("support_reply_success");
      refreshSupportConversations({ silent: true });
    } catch (error) {
      setMessage(error.message || getAdminErrorMessage(language, "support"));
      setMessageCode("support_reply_failed");
    } finally {
      setSupportSending(false);
    }
  }

  function updateSupportStatus(nextStatus) {
    setReady(false);
    setSupportStatus(String(nextStatus || ""));
    setSupportPage(1);
  }

  function updateSupportQuery(nextQuery) {
    setReady(false);
    setSupportQuery(nextQuery);
    setSupportPage(1);
  }

  useEffect(() => {
    if (!ready) return;
    refreshSupportConversations({ silent: true });
  }, [supportStatus, supportQuery, supportPage, ready, refreshSupportConversations]);

  useEffect(() => {
    loadAdminData({ includeAllUsers: true });
  }, [loadAdminData]);

  async function resetPassword(userId, newPassword) {
    try {
      await apiPost(routes.api.adminUsersResetPassword, { userId, newPassword });
      setMessageCode("reset_success");
      setMessage("");
      loadAdminData({ includeAllUsers: false });
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
      loadAdminData({ includeAllUsers: false });
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

  async function updateUserPlan(userId, plan) {
    const normalizedPlan = String(plan || "").trim().toLowerCase();
    if (!userId || !["free", "pro"].includes(normalizedPlan)) return;

    setBillingChanging({ userId, action: normalizedPlan });
    try {
      await apiPost(routes.api.adminBillingSubscriptions, {
        userId,
        plan: normalizedPlan
      });
      setMessage("");
      setMessageCode("billing_update_success");

      const data = await apiGet(
        `${routes.api.adminBillingSubscriptions}?q=${encodeURIComponent(billingQuery)}&page=${billingPage}&pageSize=20`,
        { items: [], meta: INITIAL_META }
      );
      setBillingSubscriptions(Array.isArray(data?.items) ? data.items : []);
      setBillingMeta(data?.meta || INITIAL_META);
    } catch (error) {
      setMessage(error.message || getAdminErrorMessage(language, "load"));
      setMessageCode("billing_update_failed");
    } finally {
      setBillingChanging({ userId: "", action: "" });
    }
  }

  async function verifyManualPayment({ userId, method = "bank_transfer", transferRef = "", amount = 129000 }) {
    const safeUserId = String(userId || "").trim();
    const safeTransferRef = String(transferRef || "").trim().toUpperCase();
    if (!safeUserId || !safeTransferRef) return;

    setBillingChanging({ userId: safeUserId, action: "manual_verify" });
    try {
      await apiPost(routes.api.adminBillingManualVerify, {
        userId: safeUserId,
        method,
        transferRef: safeTransferRef,
        amount
      });

      setMessage("");
      setMessageCode("billing_manual_verify_success");

      const data = await apiGet(
        `${routes.api.adminBillingSubscriptions}?q=${encodeURIComponent(billingQuery)}&page=${billingPage}&pageSize=20`,
        { items: [], meta: INITIAL_META }
      );
      setBillingSubscriptions(Array.isArray(data?.items) ? data.items : []);
      setBillingMeta(data?.meta || INITIAL_META);
    } catch (error) {
      setMessage(error.message || getAdminErrorMessage(language, "load"));
      setMessageCode("billing_manual_verify_failed");
    } finally {
      setBillingChanging({ userId: "", action: "" });
    }
  }

  function exportBillingCsv() {
    if (typeof window === "undefined") return;
    window.open(routes.api.adminBillingExport, "_blank", "noopener,noreferrer");
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
    actions: {
      loadAdminData,
      resetPassword,
      deleteUser,
      setQuery: updateQuery,
      setPage,
      setPageSize: updatePageSize,
      setUsageDays: updateUsageDays,
      setLaunchMetricsDays: updateLaunchMetricsDays,
      setBillingQuery,
      setBillingPage,
      updateUserPlan,
      verifyManualPayment,
      exportBillingCsv,
      updateSupportRequest,
      sendSupportReply,
      setSupportStatus: updateSupportStatus,
      setSupportQuery: updateSupportQuery,
      setSupportPage,
      setActiveSupportConversationId,
      setSupportAdminDraft,
      refreshSupportConversations,
      setMessage,
      setMessageCode
    }
  };
}
