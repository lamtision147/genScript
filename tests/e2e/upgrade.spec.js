const { test, expect } = require("@playwright/test");

function toBase64Url(value) {
  return Buffer.from(value)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildDevSessionToken(userId) {
  const payload = JSON.stringify({
    userId,
    exp: Date.now() + 60 * 60 * 1000
  });
  return `${toBase64Url(payload)}.dev`;
}

test.describe("Upgrade Pro", () => {
  test("can upgrade from free to pro via payment UI", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "session_id",
        value: buildDevSessionToken("user_upgrade_001"),
        url: "http://127.0.0.1:4174",
        httpOnly: true,
        sameSite: "Lax"
      }
    ]);

    await page.route("**/api/session", async (route) => {
      const request = route.request();
      if (request.method() !== "GET") {
        await route.continue();
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user_upgrade_001",
            name: "Upgrade User",
            email: "upgrade@example.com",
            isAdmin: false,
            plan: "free",
            planStatus: "active",
            planLimits: {
              plan: "free",
              favoritesLimit: 5,
              historyLimit: 5,
              unlimitedFavorites: false,
              unlimitedHistory: false
            }
          }
        })
      });
    });

    await page.route("**/api/billing/plan", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          planInfo: {
            plan: "free",
            status: "active",
            upgradedAt: null,
            transactionRef: "",
            provider: "",
            amount: 0,
            currency: "VND",
            limits: {
              plan: "free",
              favoritesLimit: 5,
              historyLimit: 5,
              unlimitedFavorites: false,
              unlimitedHistory: false
            }
          }
        })
      });
    });

    await page.route("**/api/billing/upgrade", async (route) => {
      const body = route.request().postDataJSON() || {};
      expect(String(body.cardHolder || "").length).toBeGreaterThan(0);
      expect(String(body.cardNumber || "").length).toBeGreaterThan(12);

      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          planInfo: {
            plan: "pro",
            status: "active",
            upgradedAt: new Date().toISOString(),
            transactionRef: "mock_txn_001",
            provider: "mock",
            amount: 299000,
            currency: "VND",
            limits: {
              plan: "pro",
              favoritesLimit: null,
              historyLimit: null,
              unlimitedFavorites: true,
              unlimitedHistory: true
            }
          }
        })
      });
    });

    await page.goto("/upgrade");
    await page.selectOption("#header-language", "vi");

    await expect(page.getByRole("heading", { name: "Nâng cấp gói Pro" })).toBeVisible();

    await page.getByLabel("Tên chủ thẻ").fill("NGUYEN VAN A");
    await page.getByLabel("Số thẻ").fill("4242424242424242");
    await page.getByLabel("Ngày hết hạn").fill("12/30");
    await page.getByLabel("CVC").fill("123");

    await page.getByRole("button", { name: "Thanh toán và nâng cấp Pro" }).click();

    await expect(page.getByText("Thanh toán thành công. Tài khoản đã nâng cấp Pro.")).toBeVisible();
  });

  test("supports stripe checkout button when provider is stripe", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "session_id",
        value: buildDevSessionToken("user_upgrade_001"),
        url: "http://127.0.0.1:4174",
        httpOnly: true,
        sameSite: "Lax"
      }
    ]);

    await page.route("**/api/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user_upgrade_001",
            name: "Upgrade User",
            email: "upgrade@example.com",
            isAdmin: false,
            plan: "free",
            planStatus: "active",
            planLimits: {
              plan: "free",
              favoritesLimit: 5,
              historyLimit: 5,
              unlimitedFavorites: false,
              unlimitedHistory: false
            }
          }
        })
      });
    });

    await page.route("**/api/billing/plan", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          planInfo: {
            plan: "free",
            status: "active",
            upgradedAt: null,
            transactionRef: "",
            provider: "",
            amount: 0,
            currency: "VND",
            limits: {
              plan: "free",
              favoritesLimit: 5,
              historyLimit: 5,
              unlimitedFavorites: false,
              unlimitedHistory: false
            }
          },
          payment: {
            provider: "stripe",
            stripeReady: true
          }
        })
      });
    });

    let stripeCalled = false;
    await page.route("**/api/billing/create-checkout-session", async (route) => {
      stripeCalled = true;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          provider: "stripe",
          checkoutUrl: "http://127.0.0.1:4174/upgrade?checkout=cancel"
        })
      });
    });

    await page.goto("/upgrade");
    await page.selectOption("#header-language", "vi");
    await expect(page.getByRole("button", { name: "Thanh toán qua Stripe" })).toBeVisible();

    await page.getByRole("button", { name: "Thanh toán qua Stripe" }).click();
    expect(stripeCalled).toBeTruthy();
  });

  test("can cancel pro plan back to free", async ({ page, context }) => {
    await context.addCookies([
      {
        name: "session_id",
        value: buildDevSessionToken("user_upgrade_001"),
        url: "http://127.0.0.1:4174",
        httpOnly: true,
        sameSite: "Lax"
      }
    ]);

    await page.route("**/api/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: {
            id: "user_upgrade_001",
            name: "Upgrade User",
            email: "upgrade@example.com",
            isAdmin: false,
            plan: "pro",
            planStatus: "active",
            planLimits: {
              plan: "pro",
              favoritesLimit: null,
              historyLimit: null,
              unlimitedFavorites: true,
              unlimitedHistory: true
            }
          }
        })
      });
    });

    await page.route("**/api/billing/plan", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          planInfo: {
            plan: "pro",
            status: "active",
            upgradedAt: new Date().toISOString(),
            transactionRef: "mock_txn_001",
            provider: "mock",
            amount: 299000,
            currency: "VND",
            limits: {
              plan: "pro",
              favoritesLimit: null,
              historyLimit: null,
              unlimitedFavorites: true,
              unlimitedHistory: true
            }
          }
        })
      });
    });

    await page.route("**/api/billing/cancel", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          planInfo: {
            plan: "free",
            status: "active",
            upgradedAt: null,
            transactionRef: "cancel_txn_001",
            provider: "manual",
            amount: 0,
            currency: "VND",
            limits: {
              plan: "free",
              favoritesLimit: 5,
              historyLimit: 5,
              unlimitedFavorites: false,
              unlimitedHistory: false
            }
          }
        })
      });
    });

    await page.goto("/upgrade");
    await page.selectOption("#header-language", "vi");

    await page.getByRole("button", { name: "Hủy gói Pro" }).click();
    await expect(page.getByText("Đã hủy gói Pro, tài khoản quay về Free.")).toBeVisible();
  });
});
