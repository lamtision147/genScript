import { NextResponse } from "next/server";
import { GUEST_QUOTA_COOKIE_NAME, GUEST_QUOTA_USAGE_COOKIE_NAME, SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth-constants";

function isSecureCookieEnabled() {
  return process.env.NODE_ENV === "production";
}

function getCookieDomain() {
  const configured = String(process.env.COOKIE_DOMAIN || "").trim().toLowerCase();
  return configured || undefined;
}

function withCookieOptions(baseOptions = {}) {
  const domain = getCookieDomain();
  if (!domain) return baseOptions;
  return {
    ...baseOptions,
    domain
  };
}

export function withSessionCookie(response, sessionId) {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, withCookieOptions({
    httpOnly: true,
    secure: isSecureCookieEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE
  }));
  return response;
}

export function createSessionJsonResponse(payload, sessionId) {
  const response = withSessionCookie(NextResponse.json(payload), sessionId);
  response.cookies.set(GUEST_QUOTA_COOKIE_NAME, "", withCookieOptions({
    httpOnly: true,
    secure: isSecureCookieEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  }));
  response.cookies.set(GUEST_QUOTA_USAGE_COOKIE_NAME, "", withCookieOptions({
    httpOnly: true,
    secure: isSecureCookieEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  }));
  return response;
}

export function createLogoutResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", withCookieOptions({
    httpOnly: true,
    secure: isSecureCookieEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  }));
  return response;
}
