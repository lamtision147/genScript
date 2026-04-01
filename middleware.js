import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

function base64UrlToBase64(value) {
  const normalized = String(value || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = normalized.length % 4;
  if (!pad) return normalized;
  return `${normalized}${"=".repeat(4 - pad)}`;
}

function decodeSessionPayload(body) {
  try {
    const text = atob(base64UrlToBase64(body));
    const payload = JSON.parse(text);
    if (!payload?.userId || !payload?.exp || Number(payload.exp) < Date.now()) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function toBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function isSessionTokenValid(token) {
  const [body, signature] = String(token || "").split(".");
  if (!body || !signature) return false;
  if (!decodeSessionPayload(body)) return false;

  const secret = String(process.env.SESSION_SECRET || "");
  if (!secret.trim()) {
    return process.env.NODE_ENV !== "production";
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const expected = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expectedSignature = toBase64Url(expected);
    return expectedSignature === signature;
  } catch {
    return false;
  }
}

export async function middleware(request) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const { pathname } = request.nextUrl;
  const isProtectedPath = pathname.startsWith("/profile") || pathname.startsWith("/admin") || pathname.startsWith("/upgrade");

  if (!isProtectedPath) {
    return NextResponse.next();
  }

  if (!sessionId || !(await isSessionTokenValid(sessionId))) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/profile/:path*", "/admin/:path*", "/upgrade/:path*"]
};
