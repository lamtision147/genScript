import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { toggleFavoriteAsync } from "@/lib/server/history-service";

export async function POST(request) {
  const user = await getCurrentUserFromCookiesAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = await request.json();
  const favorites = await toggleFavoriteAsync(user.id, payload.historyId);
  return NextResponse.json({ favorites });
}
