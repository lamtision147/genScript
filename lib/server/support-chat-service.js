import { createClient } from "@supabase/supabase-js";
import { appEnv } from "@/lib/env";

const CONVERSATION_STATUS = new Set(["open", "in_progress", "resolved", "closed"]);

function compact(value = "", max = 2000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function normalizeStatus(status = "open") {
  const value = String(status || "open").trim().toLowerCase();
  return CONVERSATION_STATUS.has(value) ? value : "open";
}

function createSupportChatSupabaseClient() {
  if (!appEnv.supabaseUrl || !appEnv.supabaseServiceRoleKey) {
    throw new Error("Supabase config is missing.");
  }

  return createClient(appEnv.supabaseUrl, appEnv.supabaseServiceRoleKey, {
    auth: { persistSession: false }
  });
}

function mapConversationRow(row = {}) {
  const user = row.users || row.user || null;
  return {
    id: row.id,
    userId: row.user_id,
    status: normalizeStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastUserMessageAt: row.last_user_message_at || null,
    lastAdminMessageAt: row.last_admin_message_at || null,
    metadata: row.metadata || {},
    user: user ? {
      id: user.id,
      email: user.email,
      name: user.name
    } : null
  };
}

function mapMessageRow(row = {}) {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    role: row.sender_role || "user",
    senderId: row.sender_id || null,
    message: row.message || "",
    createdAt: row.created_at,
    metadata: row.metadata || {}
  };
}

function isMissingSupportTables(error) {
  const message = String(error?.message || "").toLowerCase();
  return message.includes("support_chat_conversations")
    || message.includes("support_chat_messages")
    || message.includes("schema cache");
}

function supportMigrationError() {
  return new Error("Support chat database chưa được migrate. Vui lòng chạy SQL trong SUPABASE_SCHEMA.sql để tạo support_chat_conversations và support_chat_messages.");
}

async function getConversationByUserId(supabase, userId) {
  const { data, error } = await supabase
    .from("support_chat_conversations")
    .select("*, users(id,email,name)")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingSupportTables(error)) throw supportMigrationError();
    throw new Error(error.message || "Unable to load support conversation");
  }

  return data || null;
}

async function createConversationForUser(supabase, user) {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("support_chat_conversations")
    .insert({
      user_id: user.id,
      status: "open",
      metadata: {
        userEmail: user.email || "",
        userName: user.name || ""
      },
      created_at: now,
      updated_at: now
    })
    .select("*, users(id,email,name)")
    .single();

  if (error) {
    if (isMissingSupportTables(error)) throw supportMigrationError();
    throw new Error(error.message || "Unable to create support conversation");
  }

  return data;
}

async function getOrCreateConversationByUser(supabase, user) {
  const existing = await getConversationByUserId(supabase, user.id);
  if (existing) return existing;
  return createConversationForUser(supabase, user);
}

async function listMessagesByConversation(supabase, conversationId, { limit = 80 } = {}) {
  const safeLimit = Math.max(1, Math.min(300, Number(limit) || 80));
  const { data, error } = await supabase
    .from("support_chat_messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(safeLimit);

  if (error) {
    if (isMissingSupportTables(error)) throw supportMigrationError();
    throw new Error(error.message || "Unable to load support messages");
  }

  return Array.isArray(data) ? data.map(mapMessageRow) : [];
}

function mergeConversationMetadata(existing = {}, patch = {}) {
  return {
    ...(existing && typeof existing === "object" ? existing : {}),
    ...(patch && typeof patch === "object" ? patch : {})
  };
}

async function appendMessage(supabase, {
  conversation,
  role,
  senderId,
  message,
  status,
  metadataPatch = {}
}) {
  const safeMessage = compact(message, 2000);
  const now = new Date().toISOString();
  const nextStatus = normalizeStatus(status || conversation.status || "open");

  if (!safeMessage) {
    throw new Error("Message is required");
  }

  const { error: insertError } = await supabase
    .from("support_chat_messages")
    .insert({
      conversation_id: conversation.id,
      sender_role: role,
      sender_id: senderId || null,
      message: safeMessage,
      metadata: {},
      created_at: now
    });

  if (insertError) {
    if (isMissingSupportTables(insertError)) throw supportMigrationError();
    throw new Error(insertError.message || "Unable to send support message");
  }

  const updatePayload = {
    updated_at: now,
    status: nextStatus,
    metadata: mergeConversationMetadata(conversation.metadata, metadataPatch)
  };

  if (role === "user") {
    updatePayload.last_user_message_at = now;
  }
  if (role === "admin") {
    updatePayload.last_admin_message_at = now;
  }

  const { data: updatedConversation, error: updateError } = await supabase
    .from("support_chat_conversations")
    .update(updatePayload)
    .eq("id", conversation.id)
    .select("*, users(id,email,name)")
    .single();

  if (updateError) {
    if (isMissingSupportTables(updateError)) throw supportMigrationError();
    throw new Error(updateError.message || "Unable to update support conversation");
  }

  const messages = await listMessagesByConversation(supabase, conversation.id, { limit: 120 });
  return {
    conversation: mapConversationRow(updatedConversation),
    messages
  };
}

export async function getUserSupportChatThreadAsync(user) {
  const supabase = createSupportChatSupabaseClient();
  const conversationRow = await getOrCreateConversationByUser(supabase, user);
  const messages = await listMessagesByConversation(supabase, conversationRow.id, { limit: 120 });
  return {
    conversation: mapConversationRow(conversationRow),
    messages
  };
}

export async function sendUserSupportMessageAsync(user, { message } = {}) {
  const supabase = createSupportChatSupabaseClient();
  const conversationRow = await getOrCreateConversationByUser(supabase, user);

  return appendMessage(supabase, {
    conversation: mapConversationRow(conversationRow),
    role: "user",
    senderId: user.id,
    message,
    status: "open"
  });
}

export async function listAdminSupportConversationsAsync({ status = "", query = "", page = 1, pageSize = 20 } = {}) {
  const supabase = createSupportChatSupabaseClient();
  const safeStatus = status ? normalizeStatus(status) : "";
  const safeQuery = compact(query, 120).toLowerCase();
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.max(1, Math.min(100, Number(pageSize) || 20));

  const { data, error } = await supabase
    .from("support_chat_conversations")
    .select("*, users(id,email,name)")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) {
    if (isMissingSupportTables(error)) throw supportMigrationError();
    throw new Error(error.message || "Unable to load admin support conversations");
  }

  const rows = Array.isArray(data) ? data.map(mapConversationRow) : [];
  const ids = rows.map((item) => item.id);

  let latestByConversation = new Map();
  if (ids.length) {
    const { data: messageRows, error: messageError } = await supabase
      .from("support_chat_messages")
      .select("conversation_id,sender_role,message,created_at")
      .in("conversation_id", ids)
      .order("created_at", { ascending: false });

    if (messageError) {
      if (isMissingSupportTables(messageError)) throw supportMigrationError();
      throw new Error(messageError.message || "Unable to load support message previews");
    }

    for (const row of (messageRows || [])) {
      if (!latestByConversation.has(row.conversation_id)) {
        latestByConversation.set(row.conversation_id, {
          message: row.message,
          role: row.sender_role,
          createdAt: row.created_at
        });
      }
    }
  }

  let filtered = rows.map((row) => ({
    ...row,
    preview: latestByConversation.get(row.id) || null,
    unreadForAdmin: row.lastUserMessageAt && (!row.lastAdminMessageAt || new Date(row.lastUserMessageAt).getTime() > new Date(row.lastAdminMessageAt).getTime())
  }));

  if (safeStatus) {
    filtered = filtered.filter((item) => item.status === safeStatus);
  }

  if (safeQuery) {
    filtered = filtered.filter((item) => {
      const email = String(item.user?.email || "").toLowerCase();
      const name = String(item.user?.name || "").toLowerCase();
      const preview = String(item.preview?.message || "").toLowerCase();
      return email.includes(safeQuery) || name.includes(safeQuery) || preview.includes(safeQuery);
    });
  }

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const currentPage = Math.min(safePage, totalPages);
  const start = (currentPage - 1) * safePageSize;

  return {
    items: filtered.slice(start, start + safePageSize),
    meta: {
      page: currentPage,
      pageSize: safePageSize,
      total,
      totalPages
    }
  };
}

export async function getAdminSupportConversationThreadAsync(conversationId) {
  const supabase = createSupportChatSupabaseClient();
  const id = compact(conversationId, 120);
  if (!id) throw new Error("conversationId is required");

  const { data, error } = await supabase
    .from("support_chat_conversations")
    .select("*, users(id,email,name)")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    if (isMissingSupportTables(error)) throw supportMigrationError();
    throw new Error(error.message || "Unable to load support conversation");
  }
  if (!data) {
    throw new Error("Support conversation not found");
  }

  const messages = await listMessagesByConversation(supabase, id, { limit: 200 });
  return {
    conversation: mapConversationRow(data),
    messages
  };
}

export async function sendAdminSupportMessageAsync(adminUser, conversationId, { message = "", status = "" } = {}) {
  const supabase = createSupportChatSupabaseClient();
  const thread = await getAdminSupportConversationThreadAsync(conversationId);

  if (!compact(message, 2000) && status) {
    const nextStatus = normalizeStatus(status);
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("support_chat_conversations")
      .update({
        status: nextStatus,
        updated_at: now
      })
      .eq("id", thread.conversation.id)
      .select("*, users(id,email,name)")
      .single();

    if (error) {
      if (isMissingSupportTables(error)) throw supportMigrationError();
      throw new Error(error.message || "Unable to update conversation status");
    }

    return {
      conversation: mapConversationRow(data),
      messages: thread.messages
    };
  }

  const defaultStatus = status || (thread.conversation.status === "open" ? "in_progress" : thread.conversation.status);
  return appendMessage(supabase, {
    conversation: thread.conversation,
    role: "admin",
    senderId: adminUser?.id || null,
    message,
    status: defaultStatus
  });
}
