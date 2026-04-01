import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { updateHistoryItemOutputByUserAsync } from "@/lib/server/history-service";
import { createRequestContext, elapsedMs, logError, logInfo, withRequestId } from "@/lib/server/observability";

function sanitizeProductResult(result = {}) {
  return {
    ...result,
    paragraphs: Array.isArray(result?.paragraphs)
      ? result.paragraphs.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 8)
      : [],
    hashtags: Array.isArray(result?.hashtags)
      ? result.hashtags.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20)
      : []
  };
}

function sanitizeVideoResult(result = {}) {
  const scenes = Array.isArray(result?.scenes)
    ? result.scenes
      .map((scene, index) => ({
        label: String(scene?.label || `Scene ${index + 1}`).trim(),
        voice: String(scene?.voice || "").trim(),
        visual: String(scene?.visual || "").trim()
      }))
      .filter((scene) => scene.voice || scene.visual)
      .slice(0, 12)
    : [];

  return {
    ...result,
    title: String(result?.title || "").trim(),
    hook: String(result?.hook || "").trim(),
    scenes,
    cta: String(result?.cta || "").trim(),
    hashtags: Array.isArray(result?.hashtags)
      ? result.hashtags.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20)
      : [],
    shotList: Array.isArray(result?.shotList)
      ? result.shotList.map((item) => String(item || "").trim()).filter(Boolean).slice(0, 20)
      : []
  };
}

export async function POST(request) {
  const ctx = createRequestContext(request, "/api/history/save-output");
  try {
    const user = await getCurrentUserFromCookiesAsync();
    if (!user) {
      return withRequestId(NextResponse.json({ error: "Unauthorized" }, { status: 401 }), ctx);
    }

    const payload = await request.json().catch(() => ({}));
    const historyId = String(payload?.historyId || "").trim();
    const contentType = String(payload?.contentType || "product_copy").trim().toLowerCase();
    const result = payload?.result && typeof payload.result === "object" ? payload.result : null;

    if (!historyId) {
      return withRequestId(NextResponse.json({ error: "historyId is required" }, { status: 400 }), ctx);
    }
    if (!result) {
      return withRequestId(NextResponse.json({ error: "result is required" }, { status: 400 }), ctx);
    }

    const sanitizedResult = contentType === "video_script"
      ? sanitizeVideoResult(result)
      : sanitizeProductResult(result);
    const fallbackTitle = contentType === "video_script" ? "Video script" : "Product content";
    const nextTitle = String(payload?.title || sanitizedResult?.title || fallbackTitle).trim();

    const item = await updateHistoryItemOutputByUserAsync(user.id, historyId, {
      title: nextTitle,
      resultData: sanitizedResult
    });

    logInfo(ctx, "history.save_output.success", {
      userId: user.id,
      historyId,
      contentType,
      ms: elapsedMs(ctx)
    });

    return withRequestId(NextResponse.json({ item }), ctx);
  } catch (error) {
    logError(ctx, "history.save_output.failed", error, { ms: elapsedMs(ctx) });
    return withRequestId(NextResponse.json({ error: error?.message || "Unable to save output" }, { status: 400 }), ctx);
  }
}
