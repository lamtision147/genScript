import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { listHistoryByUserAsync } from "@/lib/server/history-service";

export async function GET(_request, { params }) {
  try {
    const resolvedParams = await params;
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const items = await listHistoryByUserAsync(user.id, {});
    const item = items.find((entry) => entry.id === resolvedParams.id);
    if (!item) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ item });
  } catch (error) {
    console.error("[history][detail]", error?.message || error);
    return NextResponse.json({ error: "Unable to fetch history item" }, { status: 400 });
  }
}
