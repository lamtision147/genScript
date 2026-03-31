import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { generateVideoReviewScript } from "@/lib/server/video-script-service";
import { createHistoryItemAsync } from "@/lib/server/history-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/generate-video-script");
  try {
    const body = await request.json().catch(() => ({}));
    const user = await getCurrentUserFromCookiesAsync();
    const script = await generateVideoReviewScript(body);
    const entry = await createHistoryItemAsync({
      userId: user?.id || null,
      title: script?.title || body?.productName || "Video Script",
      variantLabel: body?.lang === "vi" ? "Kịch bản review video" : "Video review script",
      formData: {
        ...body,
        contentType: "video_script"
      },
      resultData: script,
      images: Array.isArray(body?.images) ? body.images : []
    });

    logInfo(ctx, "generate.video-script.success", {
      userId: user?.id || null,
      channel: body?.channel ?? null,
      source: script?.source || "unknown",
      hasHook: Boolean(script?.hook),
      sceneCount: Array.isArray(script?.scenes) ? script.scenes.length : 0,
      historyId: entry?.id || null,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({ script, historyId: entry?.id || null }), ctx);
  } catch (error) {
    logError(ctx, "generate.video-script.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(
      NextResponse.json({ error: error.message || "Không thể tạo kịch bản video lúc này." }, { status: 400 }),
      ctx
    );
  }
}
