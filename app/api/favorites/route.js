import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { listFavoritesByUserAsync } from "@/lib/server/history-service";

export async function GET() {
  const user = await getCurrentUserFromCookiesAsync();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ items: await listFavoritesByUserAsync(user.id) });
}
