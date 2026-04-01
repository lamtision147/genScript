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

test.describe("Admin support panel", () => {
  test("opens support tab and sends admin reply", async ({ page, context }) => {
    const sessionPayload = {
      user: {
        id: "admin_user_001",
        name: "Admin",
        email: "admin",
        isAdmin: true
      }
    };

    const supportListPayload = {
      items: [
        {
          id: "conv_001",
          status: "open",
          user: { id: "user_001", name: "Khach A", email: "khach-a@example.com" },
          unreadForAdmin: true,
          preview: { message: "Mình cần hỗ trợ đơn hàng" }
        }
      ],
      meta: {
        page: 1,
        pageSize: 20,
        total: 1,
        totalPages: 1
      }
    };

    const supportThreadPayload = {
      conversation: {
        id: "conv_001",
        status: "open",
        user: { id: "user_001", name: "Khach A", email: "khach-a@example.com" }
      },
      messages: [
        {
          id: "msg_user_1",
          role: "user",
          message: "Mình cần hỗ trợ đơn hàng",
          createdAt: "2026-03-30T10:00:00.000Z"
        }
      ]
    };

    let replyPosted = false;

    await context.addCookies([
      {
        name: "session_id",
        value: buildDevSessionToken("admin_user_001"),
        url: "http://127.0.0.1:4174",
        httpOnly: true,
        sameSite: "Lax"
      }
    ]);

    await page.route("**/api/session", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(sessionPayload)
      });
    });

    await page.route("**/api/admin/users**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          items: [],
          meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 }
        })
      });
    });

    await page.route("**/api/admin/ai-usage**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totals: {
            requestCount: 0,
            successCount: 0,
            fallbackCount: 0,
            suggestCount: 0,
            suggestSuccessCount: 0,
            suggestFallbackCount: 0,
            successRate: 0,
            suggestSuccessRate: 0
          },
          latestDay: null,
          daily: []
        })
      });
    });

    await page.route("**/api/admin/launch-metrics**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          days: 14,
          totals: {},
          firstRun: {},
          funnel: {},
          topErrors: [],
          daily: []
        })
      });
    });

    await page.route("**/api/admin/support/chat**", async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (method === "GET" && url.includes("conversationId=conv_001")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(supportThreadPayload)
        });
        return;
      }

      if (method === "GET") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(supportListPayload)
        });
        return;
      }

      if (method === "POST") {
        const body = route.request().postDataJSON() || {};
        if (body.conversationId === "conv_001" && String(body.message || "").includes("Đã nhận")) {
          replyPosted = true;
        }

        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            conversation: supportThreadPayload.conversation,
            messages: [
              ...supportThreadPayload.messages,
              {
                id: "msg_admin_1",
                role: "admin",
                message: String(body.message || ""),
                createdAt: "2026-03-30T10:05:00.000Z"
              }
            ]
          })
        });
        return;
      }

      await route.continue();
    });

    await page.goto("/admin");
    await page.selectOption("#header-language", "vi");

    await page.getByRole("tab", { name: /Hỗ trợ trực tiếp|Direct support/i }).click();
    await expect(page.getByRole("heading", { name: "Trò chuyện hỗ trợ" })).toBeVisible();

    await expect(page.getByRole("button", { name: "Khach A" })).toBeVisible();
    await page.getByRole("button", { name: "Khach A" }).click();

    await page.locator(".admin-chat-reply textarea").fill("Đã nhận yêu cầu, team sẽ hỗ trợ ngay.");
    await page.getByRole("button", { name: "Gửi trả lời" }).click();

    expect(replyPosted).toBeTruthy();
    await expect(page.locator(".admin-chat-bubble.admin p").last()).toContainText("Đã nhận yêu cầu");
  });
});
