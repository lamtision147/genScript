import { NextResponse } from "next/server";
import { consumeOauthState, createSessionAsync, upsertGoogleUser } from "@/lib/server/auth-service";

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const error = await response.text();
    throw new Error(error || "Request failed");
  }
  return response.json();
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!code || !state || !consumeOauthState(state)) {
      return NextResponse.json({ error: "Invalid Google callback" }, { status: 400 });
    }

    const baseUrl = process.env.PUBLIC_BASE_URL || url.origin;
    const redirectUri = `${baseUrl}/api/auth/google/callback`;
    const tokenResult = await postJson("https://oauth2.googleapis.com/token", {
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: "authorization_code"
    });

    const profileResponse = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenResult.access_token}` }
    });
    const profile = await profileResponse.json();
    const user = await upsertGoogleUser({ email: String(profile.email || "").toLowerCase(), name: profile.name || "Google User" });
    const sessionId = await createSessionAsync(user.id);
    const response = NextResponse.redirect(new URL("/scriptProductInfo", baseUrl));
    response.cookies.set("session_id", sessionId, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 7 });
    return response;
  } catch (error) {
    return NextResponse.json({ error: error.message || "Google login failed" }, { status: 400 });
  }
}
