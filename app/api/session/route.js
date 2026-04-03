import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { buildSessionUserAsync } from "@/lib/server/session-service";
import { getGenerationQuotaSummaryByRequestAsync } from "@/lib/server/generation-quota-service";

export async function GET(request) {
  const user = await getCurrentUserFromCookiesAsync();
  if (!user) {
    const guestQuota = await getGenerationQuotaSummaryByRequestAsync(request, { userId: "" });
    return NextResponse.json({
      user: null,
      guestQuota
    });
  }

  return NextResponse.json({ user: await buildSessionUserAsync(user) });
}
