import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { buildSessionUserAsync } from "@/lib/server/session-service";
import { ensureGuestQuotaCookie, ensureGuestQuotaUsageFromSummaryCookie, getGenerationQuotaSummaryByRequestAsync } from "@/lib/server/generation-quota-service";
import { GUEST_QUOTA_COOKIE_NAME, GUEST_QUOTA_USAGE_COOKIE_NAME } from "@/lib/auth-constants";

function withCookieOptions(baseOptions = {}) {
  const domain = String(process.env.COOKIE_DOMAIN || "").trim().toLowerCase();
  if (!domain) return baseOptions;
  return {
    ...baseOptions,
    domain
  };
}

export async function GET(request) {
  const user = await getCurrentUserFromCookiesAsync();
  if (!user) {
    const guestQuota = await getGenerationQuotaSummaryByRequestAsync(request, { userId: "" });
    const response = NextResponse.json({
      user: null,
      guestQuota
    });
    ensureGuestQuotaCookie(response, request);
    ensureGuestQuotaUsageFromSummaryCookie(response, request, guestQuota);
    return response;
  }

  const response = NextResponse.json({ user: await buildSessionUserAsync(user) });
  response.cookies.set(GUEST_QUOTA_COOKIE_NAME, "", withCookieOptions({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  }));
  response.cookies.set(GUEST_QUOTA_USAGE_COOKIE_NAME, "", withCookieOptions({
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0
  }));
  return response;
}
