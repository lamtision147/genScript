async function ensureLanguage(page, lang) {
  const select = page.locator("#header-language");
  await select.waitFor({ state: "visible" });
  await select.selectOption(lang);
}

async function loginWithPassword(page, { email = "admin", password = "admin", language = "vi" } = {}) {
  await page.goto("/login");
  await ensureLanguage(page, language);

  const emailInput = page.locator("input[type='text']").first();
  const passwordInput = page.locator("input[type='password']").first();
  await emailInput.fill(email);
  await passwordInput.fill(password);
  await page.locator("form.login-card button[type='submit']").click();
  await page.waitForURL(/\/script(ProductInfo|VideoReview)/, { timeout: 15_000 });
}

async function ensureLoggedOut(page) {
  await page.goto("/");
  const logoutButton = page.getByRole("button", { name: /^đăng xuất$|^logout$/i });
  if (await logoutButton.isVisible().catch(() => false)) {
    await logoutButton.click();
    await page.waitForURL("**/scriptProductInfo");
  }
}

module.exports = {
  ensureLanguage,
  ensureLoggedOut,
  loginWithPassword
};
