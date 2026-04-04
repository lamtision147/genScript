import { NextResponse } from "next/server";
import { sendRenewalReminderBatchAsync } from "@/lib/server/billing-reminder-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function verifyCronRequest(request) {
  const configuredSecret = String(process.env.CRON_SECRET || "").trim();
  if (!configuredSecret) return true;

  const authHeader = String(request.headers.get("authorization") || "");
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (token && token === configuredSecret) return true;

  const cronHeader = String(request.headers.get("x-vercel-cron-signature") || "").trim();
  if (cronHeader && cronHeader === configuredSecret) return true;

  throw new Error("Unauthorized cron trigger");
}

export async function GET(request) {
  const ctx = createRequestContext(request, "/api/cron/billing-renewal-reminder");
  try {
    verifyCronRequest(request);
    const result = await sendRenewalReminderBatchAsync();

    logInfo(ctx, "cron.billing_renewal_reminder.done", {
      scanned: result.scanned,
      sent: result.sent,
      skipped: result.skipped,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json(result), ctx);
  } catch (error) {
    const status = /unauthorized/i.test(String(error?.message || "")) ? 401 : 400;
    logError(ctx, "cron.billing_renewal_reminder.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to run renewal reminder cron" }, { status }), ctx);
  }
}
