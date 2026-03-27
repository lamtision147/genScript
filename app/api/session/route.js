import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync, sanitizeUser } from "@/lib/server/auth-service";

export async function GET() {
  return NextResponse.json({ user: sanitizeUser(await getCurrentUserFromCookiesAsync()) });
}
