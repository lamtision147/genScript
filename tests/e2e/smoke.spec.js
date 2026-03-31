const { test, expect } = require("@playwright/test");
const { ensureLanguage } = require("./helpers");

test.describe("Seller Studio smoke", () => {
  test("home page loads with visible header and language switch", async ({ page }) => {
    await page.goto("/");

    await expect(page).toHaveURL(/\/scriptVideoReview/);

    await expect(page.getByText("Seller Studio").first()).toBeVisible();

    const languageSelect = page.locator("#header-language");
    await expect(languageSelect).toBeVisible();
  });

  test("vietnamese nav label appears as Trang tạo nội dung", async ({ page }) => {
    await page.goto("/");
    await ensureLanguage(page, "vi");

    await expect(page.getByRole("link", { name: "Trang tạo nội dung" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Kịch bản video" })).toBeVisible();
  });

  test("bulk panel can switch language template", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    const bulkPanel = page.locator(".bulk-panel");
    await expect(bulkPanel).toBeVisible();

    const csvArea = bulkPanel.locator("textarea.bulk-textarea");
    await expect(csvArea).toContainText("tenSanPham");

    await page.selectOption("#header-language", "en");
    await expect(page.getByRole("link", { name: "Studio" })).toBeVisible();
    await expect(csvArea).toContainText("productName");
  });
});
