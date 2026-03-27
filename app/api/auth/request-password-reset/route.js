import { NextResponse } from "next/server";
import { requestPasswordResetOtpAsync, sendOtpEmail } from "@/lib/server/auth-service";

export async function POST(request) {
  try {
    const payload = await request.json();
    const email = String(payload.email || "").trim().toLowerCase();
    const code = await requestPasswordResetOtpAsync(email);
    const emailSent = await sendOtpEmail(email, code).catch(() => false);
    return NextResponse.json({ ok: true, emailSent, ...(!emailSent ? { debugCode: code } : {}) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Password reset request failed" }, { status: 400 });
  }
}
