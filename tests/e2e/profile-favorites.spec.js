const { test, expect } = require("@playwright/test");
const { ensureLoggedOut, loginWithPassword } = require("./helpers");

const ONE_PIXEL_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2m8wAAAABJRU5ErkJggg==";

function makePngPayload(name = "profile-test.png") {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")
  };
}

test.describe("Profile favorites tabs", () => {
  test("shows per-type tabs and opens favorite item by content type", async ({ page }) => {
    await ensureLoggedOut(page);
    await loginWithPassword(page, { language: "vi" });

    const mockedFavorites = {
      product_copy: [
        {
          id: "fav_product_001",
          createdAt: "2026-03-30T09:00:00.000Z",
          title: "Nồi chiên không dầu mini",
          form: { contentType: "product_copy", productName: "Nồi chiên không dầu mini" },
          result: { source: "fallback" },
          isFavorite: true
        }
      ],
      video_script: [
        {
          id: "fav_video_001",
          createdAt: "2026-03-30T10:00:00.000Z",
          title: "Kịch bản tai nghe chống ồn",
          form: { contentType: "video_script", productName: "Tai nghe chống ồn" },
          result: { source: "fallback", title: "Kịch bản tai nghe chống ồn" },
          isFavorite: true
        }
      ]
    };

    await page.route("**/api/favorites?type=product_copy", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: mockedFavorites.product_copy })
      });
    });

    await page.route("**/api/favorites?type=video_script", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: mockedFavorites.video_script })
      });
    });

    await page.goto("/profile");

    const productTab = page.getByRole("tab", { name: /Nội dung sản phẩm/i });
    const videoTab = page.getByRole("tab", { name: /Kịch bản video/i });
    await expect(productTab).toBeVisible();
    await expect(videoTab).toBeVisible();
    await expect(productTab).toContainText(/\(\d+\)/);
    await expect(videoTab).toContainText(/\(\d+\)/);

    const openButton = page.getByRole("button", { name: /Xem lại/i }).first();
    await openButton.click();
    await page.waitForURL("**/scriptProductInfo?historyId=fav_product_001");

    await page.goto("/profile");
    await videoTab.click();
    await expect(videoTab).toHaveAttribute("aria-selected", "true");
    await page.getByRole("button", { name: /Xem lại/i }).first().click();
    await page.waitForURL("**/scriptVideoReview?historyId=fav_video_001");
  });

  test("mobile layout stacks favorite tabs", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await ensureLoggedOut(page);
    await loginWithPassword(page, { language: "vi" });

    await page.goto("/profile");
    const tabs = page.locator(".profile-favorite-tabs");
    await expect(tabs).toBeVisible();
    await expect(page.locator(".profile-favorite-tab").first()).toBeVisible();
  });

  test("video suggest warns for category conflict on manual run", async ({ page }) => {
    await page.goto("/scriptVideoReview");
    await page.selectOption("#header-language", "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "computerOffice",
            tone: 1,
            channel: 1,
            mood: 1,
            generatedProductName: "Tai nghe chống ồn",
            targetCustomer: "Dân văn phòng",
            shortDescription: "Thiết bị làm việc",
            highlights: ["Chống ồn", "Pin bền"],
            attributes: [{ type: 0, value: "Bluetooth" }],
            confidence: 0.84,
            notes: ["Ảnh giống thiết bị văn phòng"]
          }
        })
      });
    });

    await page.getByLabel("Tên sản phẩm").fill("Tai nghe chống ồn");
    const dropInput = page.locator(".upload-dropzone input[type='file']").first();
    await dropInput.setInputFiles([makePngPayload("conflict-video.png")]);

    await page.getByRole("button", { name: /gợi ý tự động|đang phân tích/i }).click();
    await expect(page.getByText("Ảnh và tên sản phẩm đang lệch nhóm ngành")).toBeVisible();
    await expect(page.getByLabel("Danh mục")).toHaveValue("electronics");
  });
});
