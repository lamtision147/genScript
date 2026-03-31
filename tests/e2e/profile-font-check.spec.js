const fs = require("fs");
const path = require("path");
const { test, expect } = require("@playwright/test");
const { ensureLanguage, ensureLoggedOut, loginWithPassword } = require("./helpers");

test("capture profile title rendering", async ({ page }) => {
  await ensureLoggedOut(page);
  await loginWithPassword(page, { language: "vi" });

  await page.goto("/profile");
  await ensureLanguage(page, "vi");

  const h1Title = page.locator("header .page-title");
  const h2Title = page.locator("h2.profile-settings-title");
  await expect(h1Title).toBeVisible();
  await expect(h2Title).toBeVisible();

  const h1Style = await h1Title.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      text: el.textContent,
      fontFamily: computed.fontFamily,
      fontWeight: computed.fontWeight,
      fontSize: computed.fontSize,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
      textRendering: computed.textRendering
    };
  });

  const h2Style = await h2Title.evaluate((el) => {
    const computed = window.getComputedStyle(el);
    return {
      text: el.textContent,
      fontFamily: computed.fontFamily,
      fontWeight: computed.fontWeight,
      fontSize: computed.fontSize,
      lineHeight: computed.lineHeight,
      letterSpacing: computed.letterSpacing,
      textRendering: computed.textRendering
    };
  });

  console.log("PROFILE_HEADER_H1_STYLE", JSON.stringify(h1Style));
  console.log("PROFILE_CARD_H2_STYLE", JSON.stringify(h2Style));

  const titleShotPath = path.join(process.cwd(), "test-results", "profile-title-check.png");
  const pageShotPath = path.join(process.cwd(), "test-results", "profile-page-check.png");
  fs.mkdirSync(path.dirname(titleShotPath), { recursive: true });

  await h2Title.screenshot({ path: titleShotPath });
  await page.screenshot({ path: pageShotPath, fullPage: true });
});
