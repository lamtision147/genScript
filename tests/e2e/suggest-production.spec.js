const { test, expect } = require("@playwright/test");

const ENABLE_PROD_CHECK = process.env.E2E_PROD_CHECK === "1";

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2m8wAAAABJRU5ErkJggg==";

function makePngPayload(name = "prod-check.png") {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")
  };
}

test.describe("Suggest Production", () => {
  test.skip(!ENABLE_PROD_CHECK, "Enable with E2E_PROD_CHECK=1");

  test("production suggest endpoint should return non-empty notes", async ({ request }) => {
    const response = await request.post("https://gen-script-tau.vercel.app/api/suggest-from-images", {
      data: {
        lang: "vi",
        productName: "Production suggest check",
        images: [
          {
            id: "img_check",
            name: "prod-check.png",
            src: `data:image/png;base64,${ONE_PIXEL_PNG_BASE64}`
          }
        ]
      }
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(Array.isArray(body?.suggestion?.notes)).toBeTruthy();
    expect(body.suggestion.notes.length).toBeGreaterThan(0);
  });

  test("upload flow should show suggest confidence or explicit provider note", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload()]);

    const suggestButton = page.getByRole("button", { name: /gợi ý tự động|auto suggest/i });
    await suggestButton.click();

    await expect(
      page.locator(".upload-confidence-note, .upload-field .field-helper.error-text").first()
    ).toBeVisible();
  });
});
