import { NextResponse } from "next/server";
import { createSessionAsync, sanitizeUser, verifySignupOtpAsync } from "@/lib/server/auth-service";
import { createSessionJsonResponse } from "@/lib/server/session-response";

export async function POST(request) {
  try {
    const payload = await request.json();
    const email = String(payload.email || "").trim().toLowerCase();
    const code = String(payload.code || "").trim();
    const user = await verifySignupOtpAsync({ email, code });
    const sessionId = await createSessionAsync(user.id);
    return createSessionJsonResponse({ user: sanitizeUser(user) }, sessionId);
  } catch (error) {
    console.error("[auth][verify-otp]", error?.message || error);
    return NextResponse.json({ error: error.message || "OTP verification failed" }, { status: 400 });
  }
}
