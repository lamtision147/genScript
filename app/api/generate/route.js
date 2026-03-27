import { NextResponse } from "next/server";
import { getCurrentUserFromCookiesAsync } from "@/lib/server/auth-service";
import { createHistoryItemAsync } from "@/lib/server/history-service";
import { generateProductCopy } from "@/lib/server/ai-service";
import { normalizeGeneratePayload, RequestValidationError } from "@/lib/server/generate-payload";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => {
      throw new RequestValidationError("Dữ liệu gửi lên không hợp lệ.");
    });
    const payload = normalizeGeneratePayload(body);
    const user = await getCurrentUserFromCookiesAsync();
    const result = await generateProductCopy(payload);
    const { previousResult, ...historyFormData } = payload;
    const entry = await createHistoryItemAsync({
      userId: user?.id || null,
      title: payload.productName || "Untitled Product",
      variantLabel: payload.improved ? "Ban cai tien" : "Ban mo ta",
      formData: historyFormData,
      resultData: result,
      images: payload.images || []
    });
    return NextResponse.json({ ...result, historyId: entry.id, title: entry.title, variantLabel: entry.variantLabel });
  } catch (error) {
    if (error instanceof RequestValidationError) {
      return NextResponse.json({ error: error.message }, { status: error.status || 400 });
    }
    return NextResponse.json({ error: "Không thể tạo nội dung lúc này. Vui lòng thử lại." }, { status: 500 });
  }
}
