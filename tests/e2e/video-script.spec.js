const { test, expect } = require("@playwright/test");
const { ensureLanguage } = require("./helpers");

const ONE_PIXEL_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2m8wAAAABJRU5ErkJggg==";

function makePngPayload(name = "video-test.png") {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")
  };
}

test.describe("Video Script Page", () => {
  test("does not show all-categories option in group selector", async ({ page }) => {
    await page.goto("/scriptVideoReview");
    await ensureLanguage(page, "vi");

    const groupSelect = page.getByLabel("Nhóm ngành");
    const values = await groupSelect.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("value"))
    );
    expect(values).not.toContain("all");
  });

  test("can generate a video review script with hook", async ({ page }) => {
    await page.goto("/scriptVideoReview");
    await ensureLanguage(page, "vi");

    await page.route("**/api/generate-video-script", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          historyId: null,
          script: {
            title: "Video review test",
            hook: "Hook giữ người xem",
            scenes: [
              { label: "Cảnh 1", voice: "Voice scene 1", visual: "Visual scene 1" },
              { label: "Cảnh 2", voice: "Voice scene 2", visual: "Visual scene 2" }
            ],
            cta: "CTA test",
            hashtags: ["#test", "#video"],
            shotList: ["Shot 1", "Shot 2"],
            source: "fallback",
            quality: {
              score: 84,
              grade: "A"
            }
          }
        })
      });
    });

    await page.getByLabel("Tìm template theo từ khóa").fill("mụn");
    await page.getByLabel("Template ngành hàng").selectOption({ index: 0 });
    await page.getByLabel("Tên sản phẩm").fill("Máy xay mini cầm tay");
    await page.getByRole("button", { name: "Áp dụng template ngành" }).click();
    await page.getByLabel("Nỗi đau chính của người xem").fill("Xay đồ ăn dặm mất thời gian, rửa máy cồng kềnh");
    await page.getByLabel("Điểm nổi bật (mỗi dòng 1 ý)").fill("Nhỏ gọn\nXay nhanh\nDễ vệ sinh");
    await page.getByLabel("Bằng chứng chính").fill("Test 7 ngày, mỗi lần xay chỉ mất khoảng 30 giây");
    await page.getByLabel("Mốc thời lượng").selectOption("45");
    await page.getByLabel("Chế độ kịch bản").selectOption("teleprompter");

    await page.getByRole("button", { name: "Tạo kịch bản video" }).click();

    await expect(page.getByText("Video review test")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Hook giữ người xem")).toBeVisible({ timeout: 30000 });
    await expect(page.getByText("Cảnh 1")).toBeVisible();
    await expect(page.getByText("CTA test")).toBeVisible();
    await expect(page.getByText("Preview template")).toBeVisible();

    await expect(page.getByRole("button", { name: "Áp dụng template ngành" })).toBeVisible();

    const historyCard = page.getByRole("heading", { name: "Lịch sử nội dung" });
    await expect(historyCard).toBeVisible();
    await expect(page.getByText("Cần đăng nhập để đồng bộ")).toBeVisible();
  });

  test("style selector is single-source and output follows selected style label", async ({ page }) => {
    await page.goto("/scriptVideoReview");
    await ensureLanguage(page, "vi");

    await page.route("**/api/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user_video_pro_001",
            name: "Video Pro",
            email: "video-pro@test.local",
            plan: "pro",
            generateQuota: {
              isPro: true,
              videoScript: { remaining: null, limit: null }
            }
          }
        })
      });
    });

    await page.route("**/api/history?type=video_script**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] })
      });
    });

    await page.route("**/api/favorites?type=video_script**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] })
      });
    });

    await page.route("**/api/generate-video-script", async (route) => {
      const body = route.request().postDataJSON();
      const styles = Array.isArray(body?.variantOpeningStyles) ? body.variantOpeningStyles : [0];

      const styleLabelByIndex = [
        "Nỗi đau trực diện",
        "So sánh trước/sau",
        "Tuyên bố ngược số đông"
      ];

      const variants = styles.map((style, index) => ({
        title: `Kịch bản ${index + 1}`,
        hook: `Hook ${index + 1}`,
        scenes: [{ label: `Cảnh ${index + 1}`, voice: `Voice ${index + 1}`, visual: `Visual ${index + 1}` }],
        cta: `CTA ${index + 1}`,
        hashtags: [`#v${index + 1}`],
        shotList: [`Shot ${index + 1}`],
        source: "ai",
        quality: { score: 88 - index, grade: "A" },
        openingStyle: Number(style) || 0,
        variantStyleLabel: styleLabelByIndex[Number(style) || 0],
        historyId: `video_hist_style_${index + 1}`,
        variantGroupId: "video_group_style_test"
      }));

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          historyId: variants[0]?.historyId || null,
          historyIds: variants.map((item) => item.historyId),
          variantGroupId: "video_group_style_test",
          selectedVariant: 0,
          variants,
          script: {
            ...variants[0],
            variants,
            selectedVariant: 0
          }
        })
      });
    });

    await expect(page.getByLabel("Phong cách nội dung")).toHaveCount(1);
    await expect(page.getByLabel("Số bản nội dung")).toHaveValue("1");

    await page.getByLabel("Số bản nội dung").selectOption("2");
    await expect(page.getByLabel("Phong cách nội dung")).toHaveCount(0);
    await expect(page.getByLabel("Phong cách nội dung bản 1")).toBeVisible();
    await expect(page.getByLabel("Phong cách nội dung bản 2")).toBeVisible();

    await page.getByLabel("Phong cách nội dung bản 1").selectOption("2");
    await page.getByLabel("Phong cách nội dung bản 2").selectOption("0");

    await page.getByLabel("Tên sản phẩm").fill("Mic mini review");
    await page.getByLabel("Nỗi đau chính của người xem").fill("Ghi âm dở khi quay ngoài trời");
    await page.getByLabel("Điểm nổi bật (mỗi dòng 1 ý)").fill("Lọc ồn tốt\nNhỏ gọn\nKết nối nhanh");
    await page.getByLabel("Bằng chứng chính").fill("Test 5 clip ngoài đường vẫn rõ tiếng");

    await page.getByRole("button", { name: "Tạo kịch bản video" }).click();

    await expect(page.getByRole("button", { name: "Tuyên bố ngược số đông" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Nỗi đau trực diện" })).toBeVisible();

    await page.getByRole("button", { name: "Nỗi đau trực diện" }).click();
    await expect(page.getByText("Hook 2")).toBeVisible();
    await expect(page.getByText("Phong cách đã áp dụng: Tiêu chuẩn · Nỗi đau trực diện")).toBeVisible();
  });

  test("supports category group filter for expanded industries", async ({ page }) => {
    await page.goto("/scriptVideoReview");
    await ensureLanguage(page, "vi");

    const groupSelect = page.getByLabel("Nhóm ngành");
    await expect(groupSelect).toBeVisible();
    await groupSelect.selectOption("motherBabyHealth");

    const categorySelect = page.getByLabel("Danh mục", { exact: true });
    const optionValues = await categorySelect.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("value"))
    );
    expect(optionValues).toContain("motherBaby");
    expect(optionValues).toContain("healthCare");

    await categorySelect.selectOption("motherBaby");

    const channelSelect = page.getByLabel("Kênh");
    await expect(channelSelect).toHaveValue("1");

    await channelSelect.selectOption("2");
    const openingSelect = page.getByLabel("Kiểu mở đầu");
    await expect(openingSelect).toHaveValue("1");
  });

  test("category remains in sync with selected group", async ({ page }) => {
    await page.goto("/scriptVideoReview");
    await ensureLanguage(page, "vi");

    const groupSelect = page.getByLabel("Nhóm ngành");
    await groupSelect.selectOption("fashionBeauty");

    const categorySelect = page.getByLabel("Danh mục", { exact: true });
    await categorySelect.selectOption("fragrance");
    await expect(categorySelect).toHaveValue("fragrance");

    await groupSelect.selectOption("homeLiving");
    await categorySelect.selectOption("toolsHardware");
    await expect(categorySelect).toHaveValue("toolsHardware");

    await groupSelect.selectOption("fashionBeauty");
    await expect(categorySelect).toHaveValue("fashion");
  });

  test("supports image suggest autofill similar to page 1", async ({ page }) => {
    await page.goto("/scriptVideoReview");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "fashion",
            tone: 0,
            channel: 0,
            mood: 2,
            brandStyle: 1,
            generatedProductName: "Quần short nam mặc nhà",
            targetCustomer: "Nam 18-35",
            shortDescription: "Đồ mặc nhà thoải mái",
            highlights: ["Mềm", "Thoáng", "Dễ mặc"],
            attributes: [{ type: 0, value: "Vải thun co giãn" }],
            confidence: 0.79,
            notes: ["Đã nhận diện ngành thời trang"]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']").first();
    await dropInput.setInputFiles([makePngPayload("video-shorts.png")]);

    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue("Quần short nam mặc nhà");
    await expect(page.getByLabel("Nhóm ngành")).toHaveValue("fashionBeauty");
    await expect(page.getByLabel("Danh mục")).toHaveValue("fashion");
    await expect(page.getByLabel("Khách hàng mục tiêu")).toHaveValue("Nam 18-35");
    await expect(page.getByLabel("Điểm nổi bật (mỗi dòng 1 ý)")).toHaveValue(/Mềm\nThoáng\nDễ mặc/);
    await expect(page.getByLabel("Template ngành hàng")).toHaveValue("fashion-men-basic");
    await expect(page.getByText("Đề xuất tự động: Thời trang nam basic")).toBeVisible();
  });

  test("opens video history item from query historyId", async ({ page }) => {
    await page.goto("/scriptVideoReview");
    await ensureLanguage(page, "vi");

    await page.route("**/api/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { id: "user_video_001", name: "Video Tester", email: "video@test.local" } })
      });
    });

    const mockedHistoryItem = {
      id: "video_hist_001",
      createdAt: "2026-03-30T09:00:00.000Z",
      title: "Video test from history",
      variantLabel: null,
      form: {
        contentType: "video_script",
        productName: "Sản phẩm video test",
        category: "fashion",
        channel: 0,
        targetCustomer: "Nam 20-35",
        painPoint: "Không biết chọn mẫu phù hợp",
        highlights: "Mềm\nThoáng\nDễ phối",
        proofPoint: "Test trong 7 ngày",
        durationSec: 45,
        priceSegment: "mid",
        mood: "Năng động cuốn hút",
        openingStyle: 0,
        scriptMode: "standard",
        industryPreset: "fashion-men-basic",
        images: []
      },
      result: {
        title: "Video test from history",
        hook: "Hook test",
        scenes: [{ label: "Scene 1", voice: "Voice 1", visual: "Visual 1" }],
        cta: "CTA test",
        hashtags: ["#test"],
        shotList: ["Shot 1"],
        source: "fallback"
      },
      isFavorite: false
    };

    await page.route("**/api/history/video_hist_001", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ item: mockedHistoryItem })
      });
    });

    await page.route("**/api/history?type=video_script*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [mockedHistoryItem] })
      });
    });

    await page.route("**/api/favorites?type=video_script*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] })
      });
    });

    await page.goto("/scriptVideoReview?historyId=video_hist_001");

    await expect(page.getByLabel(/Tên sản phẩm|Product name/)).toHaveValue("Sản phẩm video test");
    await expect(page.getByText("Video test from history", { exact: true })).toBeVisible();
    await expect(page.locator(".history-item.active")).toHaveCount(1);
  });

  test("uses product template catalog and keeps brief untouched on weak signal", async ({ page }) => {
    await page.goto("/scriptVideoReview");
    await ensureLanguage(page, "vi");

    await page.getByLabel("Tên sản phẩm").fill("Áo thun nam basic");
    await page.getByLabel("Nỗi đau chính của người xem").fill("Muốn áo mặc mát, form gọn");
    await page.getByLabel("Điểm nổi bật (mỗi dòng 1 ý)").fill("Mềm\nThoáng\nDễ phối");
    await page.getByLabel("Template ngành hàng").selectOption("fashion-men-basic");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "other",
            tone: 1,
            channel: 1,
            mood: 1,
            generatedProductName: "Áo thun nam basic",
            targetCustomer: "Nam 18-30",
            shortDescription: "Áo mặc hằng ngày",
            highlights: [],
            attributes: [],
            confidence: 0.52,
            notes: ["chua du du lieu anh"]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']").first();
    await dropInput.setInputFiles([makePngPayload("weak-signal-video.png")]);

    await expect(page.getByLabel("Template ngành hàng")).toHaveValue("fashion-men-basic");
    await expect(page.getByLabel("Nỗi đau chính của người xem")).toHaveValue("Muốn áo mặc mát, form gọn");
    await expect(page.getByLabel("Điểm nổi bật (mỗi dòng 1 ý)")).toHaveValue(/Mềm\nThoáng\nDễ phối/);
    await expect(page.getByText("Ảnh chưa đủ tín hiệu mạnh")).toBeVisible();
  });
});
