const { test, expect } = require("@playwright/test");
const { ensureLanguage } = require("./helpers");

test.describe("Output save flow", () => {
  test("edits output and saves to history", async ({ page }) => {
    await page.route("**/api/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user_save_001",
            name: "Saver",
            email: "saver@example.com"
          }
        })
      });
    });

    const historyItems = [
      {
        id: "hist_001",
        createdAt: "2026-03-30T09:00:00.000Z",
        title: "Nội dung test",
        form: {
          contentType: "product_copy",
          productName: "Nội dung test",
          category: "fashion",
          subcategory: 0,
          channel: 2,
          tone: 1,
          brandStyle: 1,
          mood: 2,
          targetCustomer: "Nữ 20-35",
          shortDescription: "Mô tả ngắn",
          highlights: ["Mềm", "Thoáng"],
          attributes: [{ type: 0, value: "Cotton" }],
          images: []
        },
        result: {
          paragraphs: ["Đoạn 1 cũ", "Đoạn 2 cũ", "Đoạn 3 cũ"],
          hashtags: ["#cu"],
          source: "fallback",
          quality: { score: 75, grade: "B" }
        },
        isFavorite: false
      }
    ];

    await page.route("**/api/history?type=product_copy*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: historyItems })
      });
    });

    await page.route("**/api/favorites?type=product_copy*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ items: [] })
      });
    });

    await page.route("**/api/history/save-output", async (route) => {
      const body = route.request().postDataJSON() || {};
      expect(body.historyId).toBe("hist_001");
      expect(body.contentType).toBe("product_copy");

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          item: {
            ...historyItems[0],
            result: {
              ...historyItems[0].result,
              paragraphs: ["Đoạn đã chỉnh 1", "Đoạn đã chỉnh 2"],
              hashtags: ["#moi", "#save"]
            }
          }
        })
      });
    });

    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.getByRole("button", { name: "Xem lại" }).first().click();

    await expect(page.getByRole("button", { name: "Chỉnh sửa" })).toBeVisible();
    await page.getByRole("button", { name: "Chỉnh sửa" }).click();

    const contentEditor = page.locator(".output-edit-field textarea").first();
    await contentEditor.fill("Đoạn đã chỉnh 1\n\nĐoạn đã chỉnh 2");

    const hashtagEditor = page.locator(".output-edit-field input").first();
    await hashtagEditor.fill("#moi #save");

    await page.getByRole("button", { name: "Lưu" }).click();

    await expect(page.getByText("Đoạn đã chỉnh 1")).toBeVisible();
    await expect(page.getByText("#moi")).toBeVisible();
    await expect(page.locator(".history-item.active")).toHaveCount(1);
  });
});
