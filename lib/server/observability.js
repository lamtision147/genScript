import crypto from "crypto";

function getHeader(request, name) {
  try {
    return request?.headers?.get?.(name) || "";
  } catch {
    return "";
  }
}

export function createRequestContext(request, endpoint, extra = {}) {
  const requestId = getHeader(request, "x-request-id") || `req_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  return {
    requestId,
    endpoint,
    startedAt: Date.now(),
    method: request?.method || "GET",
    userAgent: getHeader(request, "user-agent") || "unknown",
    ip: getHeader(request, "x-forwarded-for") || getHeader(request, "x-real-ip") || "unknown",
    ...extra
  };
}

export function logInfo(context, event, data = {}) {
  console.log(JSON.stringify({
    level: "info",
    ts: new Date().toISOString(),
    event,
    requestId: context?.requestId || "n/a",
    endpoint: context?.endpoint || "unknown",
    ...data
  }));
}

export function logError(context, event, error, data = {}) {
  console.error(JSON.stringify({
    level: "error",
    ts: new Date().toISOString(),
    event,
    requestId: context?.requestId || "n/a",
    endpoint: context?.endpoint || "unknown",
    error: error?.message || String(error),
    ...data
  }));
}

export function withRequestId(response, context) {
  try {
    response.headers.set("x-request-id", context?.requestId || "n/a");
  } catch {
    // noop
  }
  return response;
}

export function elapsedMs(context) {
  return Math.max(0, Date.now() - Number(context?.startedAt || Date.now()));
}
