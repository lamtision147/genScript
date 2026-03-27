import { NextResponse } from "next/server";
import { requestSignupOtpAsync, sendOtpEmail } from "@/lib/server/auth-service";

export async function POST(request) {
  try {
    const payload = await request.json();
    const email = String(payload.email || "").trim().toLowerCase();
    const password = String(payload.password || "").trim();
    const name = String(payload.name || "").trim();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }
    const code = await requestSignupOtpAsync({ email, name, password });
    const emailSent = await sendOtpEmail(email, code).catch(() => false);
    return NextResponse.json({ ok: true, emailSent, ...(!emailSent ? { debugCode: code } : {}) });
  } catch (error) {
    return NextResponse.json({ error: error.message || "OTP request failed" }, { status: 400 });
  }
}
