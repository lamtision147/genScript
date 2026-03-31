import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { deleteHistoryByUserAsync } from "@/lib/server/history-service";

export async function POST(request) {
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const payload = await request.json();
    const historyId = String(payload.historyId || "").trim();
    if (!historyId) return NextResponse.json({ error: "historyId is required" }, { status: 400 });
    await deleteHistoryByUserAsync(user.id, historyId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[history][delete]", error?.message || error);
    return NextResponse.json({ error: error.message || "Unable to delete history" }, { status: 400 });
  }
}
