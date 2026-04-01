import { NextResponse } from "next/server";
import { createSessionAsync, loginWithPasswordAsync } from "@/lib/server/auth-service";
import { buildSessionUserAsync } from "@/lib/server/session-service";
import { createSessionJsonResponse } from "@/lib/server/session-response";

export async function POST(request) {
  try {
    const payload = await request.json();
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "").trim();
    const user = await loginWithPasswordAsync({ email, password });
    const sessionId = await createSessionAsync(user.id);
    return createSessionJsonResponse({ user: await buildSessionUserAsync(user) }, sessionId);
  } catch (error) {
    console.error("[auth][login-password]", error?.message || error);
    return NextResponse.json({ error: error.message || "Password login failed" }, { status: 401 });
  }
}
