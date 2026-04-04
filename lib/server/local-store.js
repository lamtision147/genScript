import fs from "fs";
import path from "path";

const ROOT = process.cwd();

export const paths = {
  users: path.join(ROOT, "users-store.json"),
  history: path.join(ROOT, "history-store.json"),
  aiUsage: path.join(ROOT, "ai-usage-store.json"),
  generateQuota: path.join(ROOT, "generate-quota-store.json"),
  telemetry: path.join(ROOT, "telemetry-store.json"),
  feedback: path.join(ROOT, "feedback-store.json"),
  authOtp: path.join(ROOT, "auth-otp-store.json"),
  billingSubscriptions: path.join(ROOT, "billing-subscriptions-store.json"),
  billingWebhookEvents: path.join(ROOT, "billing-webhook-events-store.json"),
  billingReminderEmails: path.join(ROOT, "billing-reminder-emails-store.json"),
  supportChatConversations: path.join(ROOT, "support-chat-conversations-store.json"),
  supportChatMessages: path.join(ROOT, "support-chat-messages-store.json")
};

export function readJsonArray(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const raw = fs.readFileSync(filePath, "utf8");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeJsonArray(filePath, items) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}
