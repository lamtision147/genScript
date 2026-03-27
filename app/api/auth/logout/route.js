import { NextResponse } from "next/server";
import { destroySessionAsync } from "@/lib/server/auth-service";
import { createLogoutResponse } from "@/lib/server/session-response";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

export async function POST(request) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionId) {
    await destroySessionAsync(sessionId);
  }
  return createLogoutResponse();
}
