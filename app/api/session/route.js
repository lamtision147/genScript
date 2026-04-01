import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { buildSessionUserAsync } from "@/lib/server/session-service";

export async function GET(request) {
  const user = await getCurrentUserFromCookiesAsync();
  return NextResponse.json({ user: await buildSessionUserAsync(user) });
}
