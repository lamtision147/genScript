const SESSION_CACHE_KEY = "seller-studio-session-cache-v1";
const SESSION_CACHE_MAX_AGE_MS = 15 * 60 * 1000;

function canUseBrowserStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function readSessionCache() {
  if (!canUseBrowserStorage()) return null;

  try {
    const raw = window.localStorage.getItem(SESSION_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    const user = parsed?.user || null;
    const updatedAt = Number(parsed?.updatedAt || 0);

    if (!user || !updatedAt) {
      window.localStorage.removeItem(SESSION_CACHE_KEY);
      return null;
    }

    if (Date.now() - updatedAt > SESSION_CACHE_MAX_AGE_MS) {
      window.localStorage.removeItem(SESSION_CACHE_KEY);
      return null;
    }

    return user;
  } catch {
    return null;
  }
}

export function writeSessionCache(user) {
  if (!canUseBrowserStorage()) return;
  if (!user || typeof user !== "object") {
    clearSessionCache();
    return;
  }

  try {
    window.localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify({
      user,
      updatedAt: Date.now()
    }));
  } catch {
    // noop
  }
}

export function clearSessionCache() {
  if (!canUseBrowserStorage()) return;
  try {
    window.localStorage.removeItem(SESSION_CACHE_KEY);
  } catch {
    // noop
  }
}
