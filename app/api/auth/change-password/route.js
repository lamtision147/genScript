import { NextResponse } from "next/server";
import { changePasswordAsync, getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";

export async function POST(request) {
  const user = await getCurrentUserFromCookiesAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const payload = await request.json();
    await changePasswordAsync({
      userId: user.id,
      currentPassword: String(payload.currentPassword || "").trim(),
      newPassword: String(payload.newPassword || "").trim()
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Change password failed" }, { status: 400 });
  }
}
