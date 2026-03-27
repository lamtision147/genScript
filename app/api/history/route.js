import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { listHistoryByUserAsync } from "@/lib/server/history-service";

export async function GET() {
  const user = await getCurrentUserFromCookiesAsync();
  if (!user) return NextResponse.json({ items: [] });
  return NextResponse.json({ items: await listHistoryByUserAsync(user.id) });
}
