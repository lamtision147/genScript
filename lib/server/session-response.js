import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE } from "@/lib/auth-constants";

function isSecureCookieEnabled() {
  return process.env.NODE_ENV === "production";
}

export function withSessionCookie(response, sessionId) {
  response.cookies.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: isSecureCookieEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE
  });
  return response;
}

export function createSessionJsonResponse(payload, sessionId) {
  return withSessionCookie(NextResponse.json(payload), sessionId);
}

export function createLogoutResponse() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: isSecureCookieEnabled(),
    sameSite: "lax",
    path: "/",
    maxAge: 0
  });
  return response;
}
