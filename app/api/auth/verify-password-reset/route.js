import { NextResponse } from "next/server";
import { verifyPasswordResetOtpAsync } from "@/lib/server/auth-service";

export async function POST(request) {
  try {
    const payload = await request.json();
    await verifyPasswordResetOtpAsync({
      email: String(payload.email || "").trim().toLowerCase(),
      code: String(payload.code || "").trim(),
      newPassword: String(payload.newPassword || "").trim()
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Password reset failed" }, { status: 400 });
  }
}
