import { routes } from "@/lib/routes";

const SESSION_KEY = "seller-studio-telemetry-session";

function getSessionId() {
  if (typeof window === "undefined") return "";

  try {
    const existing = String(window.sessionStorage.getItem(SESSION_KEY) || "").trim();
    if (existing) return existing;

    const created = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    window.sessionStorage.setItem(SESSION_KEY, created);
    return created;
  } catch {
    return "";
  }
}

export async function trackEvent(type, payload = {}, sessionId = "") {
  try {
    const resolvedSessionId = String(sessionId || "").trim() || getSessionId();
    await fetch(routes.api.telemetry, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, payload, sessionId: resolvedSessionId })
    });
  } catch {
    // noop
  }
}
