const { test, expect } = require("@playwright/test");
const { ensureLoggedOut, loginWithPassword } = require("./helpers");

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || "admin";

test.describe("Login and Admin", () => {
  test("can login and open AI usage tab in admin", async ({ page }) => {
    await ensureLoggedOut(page);
    await loginWithPassword(page, { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, language: "vi" });
    await expect(page.getByRole("link", { name: "Admin" })).toBeVisible();

    await page.getByRole("link", { name: "Admin" }).click();
    await page.waitForURL("**/admin", { timeout: 15_000 });

    await page.getByRole("tab", { name: "Thống kê AI" }).click();
    await expect(page.getByRole("heading", { name: "Thống kê AI" })).toBeVisible();
    await expect(page.getByText("Tổng lượt generate")).toBeVisible();
  });
});
