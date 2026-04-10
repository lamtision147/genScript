const { test, expect } = require("@playwright/test");
const { ensureLanguage } = require("./helpers");

const ONE_PIXEL_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2m8wAAAABJRU5ErkJggg==";
const PRO_SESSION = {
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
};

async function mockVideoProSession(page) {
  await page.route("**/api/session**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(PRO_SESSION)
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
}

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

    await page.getByLabel("Từ khóa lọc template").fill("mụn");
    await page.getByLabel("Template ngành hàng").selectOption({ index: 0 });
    await page.getByLabel("Tên sản phẩm").fill("Máy xay mini cầm tay");
    await page.getByRole("button", { name: "Áp dụng template ngành" }).click();
    await page.getByLabel("Vấn đề chính của khách hàng").fill("Xay đồ ăn dặm mất thời gian, rửa máy cồng kềnh");
    await page.getByLabel("Điểm nổi bật sản phẩm (mỗi dòng 1 ý)").fill("Nhỏ gọn\nXay nhanh\nDễ vệ sinh");
    await page.getByLabel("Kết quả/Bằng chứng thực tế").fill("Test 7 ngày, mỗi lần xay chỉ mất khoảng 30 giây");
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
    await mockVideoProSession(page);

    await page.goto("/scriptVideoReview");
    await ensureLanguage(page, "vi");
    await expect(page.getByText("Pro: đang tạo 1 bản kịch bản video.")).toBeVisible();

    await page.route("**/api/generate-video-script", async (route) => {
      const body = route.request().postDataJSON();
      const stylePresets = Array.isArray(body?.variantStylePresets) ? body.variantStylePresets : ["balanced"];

      const styleLabelByPreset = {
        balanced: "Cân bằng (gọn, an toàn)",
        expert: "Chuyên gia thuyết phục",
        sales: "Chốt sale mạnh",
        lifestyle: "Lifestyle gần gũi",
        storytelling: "Kể chuyện chân thật",
        socialproof: "Chứng thực xã hội",
        comparison: "So sánh trước/sau",
        benefitstack: "Chuỗi lợi ích",
        problemfirst: "Nỗi đau trước",
        premium: "Premium sang trọng",
        urgencysoft: "Khẩn nhẹ",
        educational: "Giáo dục dễ hiểu",
        community: "Cộng đồng tin cậy",
        minimalist: "Tối giản rõ ý"
      };

      const stylePresetToOpening = {
        balanced: 0,
        expert: 4,
        sales: 2,
        lifestyle: 3,
        storytelling: 3,
        socialproof: 4,
        comparison: 1,
        benefitstack: 2,
        problemfirst: 0,
        premium: 4,
        urgencysoft: 2,
        educational: 1,
        community: 4,
        minimalist: 0
      };

      const variants = stylePresets.map((stylePreset, index) => ({
        title: `Kịch bản ${index + 1}`,
        hook: `Hook ${index + 1}`,
        scenes: [{ label: `Cảnh ${index + 1}`, voice: `Voice ${index + 1}`, visual: `Visual ${index + 1}` }],
        cta: `CTA ${index + 1}`,
        hashtags: [`#v${index + 1}`],
        shotList: [`Shot ${index + 1}`],
        source: "ai",
        quality: { score: 88 - index, grade: "A" },
        openingStyle: Number(stylePresetToOpening[stylePreset] || 0),
        stylePreset,
        variantStylePreset: stylePreset,
        variantStyleLabel: styleLabelByPreset[stylePreset] || styleLabelByPreset.balanced,
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
    await expect(page.getByLabel("Phong cách nội dung bản 1")).toBeVisible();
    await expect(page.getByLabel("Phong cách nội dung bản 2")).toBeVisible();
    await page.getByRole("button", { name: /Tất cả|All/ }).click();
    await page.getByLabel("Phong cách nội dung bản 1").selectOption("sales");
    await page.getByLabel("Phong cách nội dung bản 2").selectOption("balanced");

    await page.getByLabel("Tên sản phẩm").fill("Mic mini review");
    await page.getByLabel("Vấn đề chính của khách hàng").fill("Ghi âm dở khi quay ngoài trời");
    await page.getByLabel("Điểm nổi bật sản phẩm (mỗi dòng 1 ý)").fill("Lọc ồn tốt\nNhỏ gọn\nKết nối nhanh");
    await page.getByLabel("Kết quả/Bằng chứng thực tế").fill("Test 5 clip ngoài đường vẫn rõ tiếng");

    await page.getByRole("button", { name: "Tạo kịch bản video" }).click();

    await expect(page.getByRole("button", { name: "Chốt sale mạnh" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cân bằng (gọn, an toàn)" })).toBeVisible();

    await page.getByRole("button", { name: "Cân bằng (gọn, an toàn)" }).click();
    await expect(page.getByText("Hook 2")).toBeVisible();
    await expect(page.getByText("Phong cách đã áp dụng: Tiêu chuẩn · Cân bằng (gọn, an toàn)")).toBeVisible();
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
    const styleSelect = page.getByLabel("Phong cách nội dung");
    await expect(styleSelect).toHaveValue("balanced");
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
    await expect(page.getByLabel("Khách hàng mục tiêu chính")).toHaveValue("Nam 18-35");
    await expect(page.getByLabel("Điểm nổi bật sản phẩm (mỗi dòng 1 ý)")).toHaveValue(/Mềm\nThoáng\nDễ mặc/);
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
    await mockVideoProSession(page);
    await page.goto("/scriptVideoReview");
    await ensureLanguage(page, "vi");

    await page.getByLabel("Tên sản phẩm").fill("Áo thun nam basic");
    await page.getByLabel("Vấn đề chính của khách hàng").fill("Muốn áo mặc mát, form gọn");
    await page.getByLabel("Điểm nổi bật sản phẩm (mỗi dòng 1 ý)").fill("Mềm\nThoáng\nDễ phối");
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

    await expect(page.getByLabel("Template ngành hàng")).toHaveValue("fashion-women-office");
    await expect(page.getByLabel("Vấn đề chính của khách hàng")).toHaveValue("Đồ công sở tôn dáng, mặc thoải mái cả ngày, lên hình chỉn chu.");
    await expect(page.getByLabel("Điểm nổi bật sản phẩm (mỗi dòng 1 ý)")).toHaveValue(/Tôn dáng.*\nVải ít nhăn\nDễ phối blazer/);
    await expect(
      page.locator(".field-helper, .history-empty.error-state").filter({
        hasText: /chua du du lieu anh|Chưa nhận dạng được tên sản phẩm từ ảnh|Ảnh chưa đủ tín hiệu mạnh/i
      }).first()
    ).toBeVisible();
  });

  test("free plan locks style list to 3 and shows pro popup on locked style", async ({ page }) => {
    await page.route("**/api/session**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user_video_free_001",
            name: "Video Free",
            email: "video-free@test.local",
            plan: "free",
            generateQuota: {
              isPro: false,
              videoScript: { remaining: 5, limit: 5 }
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

    await page.goto("/scriptVideoReview");
    await ensureLanguage(page, "vi");

    const styleSelect = page.getByLabel("Phong cách nội dung");
    await expect(styleSelect).toHaveValue("balanced");

    const options = await styleSelect.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => ({ value: node.getAttribute("value"), text: node.textContent || "" }))
    );
    expect(options).toHaveLength(3);

    await page.getByRole("button", { name: /Tất cả|All/ }).click();
    const allOptions = await styleSelect.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => ({ value: node.getAttribute("value"), text: node.textContent || "" }))
    );
    expect(allOptions).toHaveLength(14);
    expect(allOptions[2].text).toContain("(Pro)");
    expect(allOptions[4].text).toContain("(Pro)");

    await styleSelect.selectOption("storytelling");
    await expect(page.locator("#video-pro-upsell-title")).toBeVisible();
    await expect(styleSelect).toHaveValue("balanced");

    await page.getByLabel("Số bản nội dung").selectOption("2");
    await expect(page.locator("#video-pro-upsell-title")).toBeVisible();
    await expect(page.getByLabel("Số bản nội dung")).toHaveValue("1");
  });

  test("video API coerces free opening styles to allowed set", async ({ page }) => {
    await page.route("**/api/session**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user_video_free_api_001",
            name: "Video Free Api",
            email: "video-free-api@test.local",
            plan: "free",
            generateQuota: {
              isPro: false,
              videoScript: { remaining: 5, limit: 5 }
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
      expect(body.variantCount).toBe(1);
      expect(body.variantStylePresets).toEqual(["balanced"]);
      expect(body.variantOpeningStyles).toEqual([0]);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          historyId: null,
          selectedVariant: 0,
          variants: [{
            title: "Script free",
            hook: "Hook free",
            scenes: [{ label: "Scene 1", voice: "Voice 1", visual: "Visual 1" }],
            cta: "CTA free",
            hashtags: ["#free"],
            shotList: ["Shot free"],
            source: "fallback",
            openingStyle: 0,
            variantStyleLabel: "Nỗi đau trực diện"
          }],
          script: {
            title: "Script free",
            hook: "Hook free",
            scenes: [{ label: "Scene 1", voice: "Voice 1", visual: "Visual 1" }],
            cta: "CTA free",
            hashtags: ["#free"],
            shotList: ["Shot free"],
            source: "fallback",
            openingStyle: 0,
            variantStyleLabel: "Nỗi đau trực diện"
          }
        })
      });
    });

    await page.goto("/scriptVideoReview");
    await ensureLanguage(page, "vi");

    const styleSelect = page.getByLabel("Phong cách nội dung");
    await page.getByRole("button", { name: /Tất cả|All/ }).click();
    await styleSelect.selectOption("storytelling");
    await expect(page.locator("#video-pro-upsell-title")).toBeVisible();
    await page.getByRole("button", { name: /Tiếp tục với 1 bản/i }).click();

    await page.getByLabel("Tên sản phẩm").fill("Free api test");
    await page.getByLabel("Vấn đề chính của khách hàng").fill("Van de test");
    await page.getByLabel("Điểm nổi bật sản phẩm (mỗi dòng 1 ý)").fill("Y 1\nY 2\nY 3");
    await page.getByRole("button", { name: "Tạo kịch bản video" }).click();

    await expect(page.getByText("Script free")).toBeVisible();
  });
});
