const { test, expect } = require("@playwright/test");
const { ensureLanguage } = require("./helpers");

const ONE_PIXEL_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2m8wAAAABJRU5ErkJggg==";

function makePngPayload(name = "test.png") {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")
  };
}

function makeAvifPayload(name = "test.avif") {
  return {
    name,
    mimeType: "image/avif",
    buffer: Buffer.from(ONE_PIXEL_PNG_BASE64, "base64")
  };
}

function makeLargePngPayload(name = "large.png", bytes = 8 * 1024 * 1024 + 1024) {
  return {
    name,
    mimeType: "image/png",
    buffer: Buffer.alloc(bytes, 0)
  };
}

test.describe("Upload and Suggest", () => {
  test("supports upload + auto suggest + add image tile", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await expect(dropInput).toBeVisible();
    await dropInput.setInputFiles([makePngPayload("anh-1.png")]);

    const thumbs = page.locator(".thumb-grid-compact .upload-thumb.filled");
    await expect(thumbs).toHaveCount(1);

    const addTileInput = page.locator(".upload-thumb-add input[type='file']");
    await expect(addTileInput).toBeVisible();
    await addTileInput.setInputFiles([makePngPayload("anh-2.png")]);
    await expect(thumbs).toHaveCount(2);

    const suggestButton = page.getByRole("button", { name: /gợi ý tự động|đang phân tích/i });
    await expect(suggestButton).toBeVisible();
    await suggestButton.click();

    await expect(page.locator(".upload-suggest-row .upload-confidence-note")).toContainText("Độ tin cậy");
    await expect(page.locator(".upload-suggest-row .upload-confidence-note")).toBeVisible();
    await expect(page.locator(".upload-field .field-helper").last()).toBeVisible();
  });

  test("clears previously entered form data after page refresh", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.getByLabel("Tên sản phẩm").fill("Sản phẩm tạm để test refresh");
    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue("Sản phẩm tạm để test refresh");

    await page.reload();

    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue("");
  });

  test("accepts avif upload by converting to supported image format", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    let observedMime = "";
    await page.route("**/api/suggest-from-images", async (route) => {
      const body = route.request().postDataJSON() || {};
      const firstSrc = String(body?.images?.[0]?.src || "");
      const match = firstSrc.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
      observedMime = String(match?.[1] || "").toLowerCase();

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
            highlights: ["Mềm", "Thoáng"],
            attributes: [{ type: 0, value: "Dễ mặc" }],
            confidence: 0.68,
            notes: ["Đã chuẩn hóa ảnh upload sang định dạng hỗ trợ"]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makeAvifPayload("quan-short-nam-mac-nha-2-37-ngau-nhien.avif")]);

    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue("Quần short nam mặc nhà");
    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("fashion");
    expect(observedMime).toBe("image/jpeg");
  });

  test("rejects image file larger than 8MB with clear message", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makeLargePngPayload("too-large.png")]);

    await expect(page.getByText(/vượt quá giới hạn 8MB/i)).toBeVisible();
    await expect(page.locator(".thumb-grid-compact .upload-thumb.filled")).toHaveCount(0);
  });

  test("auto suggest updates group and category when suggestion category is valid", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "computerOffice",
            tone: 1,
            channel: 1,
            mood: 3,
            brandStyle: 2,
            generatedProductName: "Bàn phím cơ không dây",
            targetCustomer: "Dân văn phòng",
            shortDescription: "Thiết bị làm việc",
            highlights: ["Ổn định", "Dễ setup"],
            attributes: [{ type: 0, value: "Kết nối linh hoạt" }],
            confidence: 0.88,
            notes: ["Phân loại theo ảnh thành công"]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("anh-sync.png")]);

    await expect(page.getByLabel("Nhóm ngành")).toHaveValue("electronicsTech");
    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("computerOffice");
    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue("Bàn phím cơ không dây");
  });

  test("shows provider-level note when suggest endpoint returns auth failure note", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "other",
            tone: 0,
            channel: 2,
            mood: 0,
            brandStyle: 0,
            generatedProductName: "Không nhận dạng tên sản phẩm được",
            targetCustomer: "",
            shortDescription: "",
            highlights: [],
            attributes: [],
            confidence: 0.2,
            notes: ["AI key không hợp lệ hoặc đã hết hạn."]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("anh-error.png")]);

    await expect(page.locator(".upload-field .field-helper.error-text")).toContainText("AI key không hợp lệ hoặc đã hết hạn");
  });

  test("category correction should favor product name when image hint conflicts", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "computerOffice",
            tone: 1,
            channel: 1,
            mood: 3,
            brandStyle: 2,
            targetCustomer: "Dân văn phòng",
            shortDescription: "Thiết bị làm việc",
            highlights: ["Ổn định", "Dễ setup"],
            attributes: [{ type: 0, value: "Kết nối linh hoạt" }],
            confidence: 0.66,
            notes: ["Ảnh trông giống màn hình máy tính"]
          }
        })
      });
    });

    await page.getByLabel("Tên sản phẩm").fill("Tai nghe không dây chống ồn");
    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("anh-conflict.png")]);

    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("electronics");
    await expect(page.getByLabel("Nhóm ngành")).toHaveValue("electronicsTech");
    await expect(page.getByText("Ảnh và tên sản phẩm đang mâu thuẫn")).toHaveCount(0);
  });

  test("shows clear no-data note for tiny image payload", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("tiny.png")]);

    await page.getByRole("button", { name: /gợi ý tự động|đang phân tích/i }).click();

    await expect(page.locator(".upload-field .field-helper").first()).toContainText("chưa đủ dữ liệu");
  });

  test("falls back to product-name inference when vision ingestion fails", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "electronics",
            tone: 1,
            channel: 1,
            mood: 3,
            brandStyle: 2,
            generatedProductName: "Tai nghe không dây chống ồn ANC",
            targetCustomer: "Người dùng cần âm thanh rõ và chống ồn",
            shortDescription: "Tai nghe không dây phù hợp làm việc và di chuyển",
            highlights: ["Chống ồn", "Pin bền", "Đeo êm"],
            attributes: [{ type: 0, value: "Bluetooth" }],
            confidence: 0.74,
            notes: ["Phân tích từ tên sản phẩm khi ảnh chưa rõ"]
          }
        })
      });
    });

    await page.getByLabel("Tên sản phẩm").fill("Tai nghe không dây chống ồn");
    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("tiny-fail.png")]);

    await page.getByRole("button", { name: /gợi ý tự động|đang phân tích/i }).click();

    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("electronics");
    await expect(page.getByLabel("Nhóm ngành")).toHaveValue("electronicsTech");
  });

  test("maps sleepwear product name to fashion when image data is weak", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.getByLabel("Tên sản phẩm").fill("Bộ quần ngủ lụa nữ");
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
            generatedProductName: "Bộ quần ngủ lụa nữ",
            targetCustomer: "Nữ 18-35",
            shortDescription: "Đồ ngủ mềm mại, dễ chịu",
            highlights: [],
            attributes: [],
            confidence: 0.55,
            notes: ["Ảnh tải lên chưa đủ dữ liệu để phân tích. Vui lòng dùng ảnh thật sản phẩm, rõ chủ thể."]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("sleepwear-tiny.png")]);

    await page.getByRole("button", { name: /gợi ý tự động|đang phân tích/i }).click();

    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("fashion");
    await expect(page.getByLabel("Nhóm ngành")).toHaveValue("fashionBeauty");
    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue("Bộ quần ngủ lụa nữ");
  });

  test("uses generated product name first then resolves category filter", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "other",
            tone: 0,
            channel: 0,
            mood: 2,
            brandStyle: 1,
            generatedProductName: "Bộ quần ngủ cotton nữ",
            targetCustomer: "Nữ 20-35",
            shortDescription: "Đồ ngủ mặc nhà",
            highlights: ["Mềm", "Thoáng"],
            attributes: [],
            confidence: 0.56,
            notes: ["Ảnh yếu nên suy luận thêm theo tên"]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("sleepwear-generated-name.png")]);

    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue("Bộ quần ngủ cotton nữ");
    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("fashion");
    await expect(page.getByLabel("Nhóm ngành")).toHaveValue("fashionBeauty");
  });

  test("requires name detection from image when product name and category are both unknown", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "other",
            tone: 1,
            channel: 1,
            mood: 3,
            brandStyle: 2,
            generatedProductName: "",
            targetCustomer: "Dân văn phòng",
            shortDescription: "",
            highlights: [],
            attributes: [],
            confidence: 0.42,
            notes: ["Chưa đủ tín hiệu nhận diện tên"]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("need-name.png")]);

    await expect(page.getByText("Chưa nhận dạng được tên sản phẩm từ ảnh")).toBeVisible();
    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue("");
  });

  test("fills fallback product name from suggested category when name is unknown", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "computerOffice",
            tone: 1,
            channel: 1,
            mood: 3,
            brandStyle: 2,
            generatedProductName: "Không nhận dạng tên sản phẩm được",
            targetCustomer: "Dân văn phòng",
            shortDescription: "Thiết bị làm việc",
            highlights: ["Kết nối ổn định"],
            attributes: [{ type: 0, value: "Dễ setup" }],
            confidence: 0.58,
            notes: ["Ảnh chưa đủ rõ để chốt tên sản phẩm cụ thể"]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("fallback-category-name.png")]);

    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue("Thiết bị máy tính văn phòng");
    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("computerOffice");
    await expect(page.getByLabel("Nhóm ngành")).toHaveValue("electronicsTech");
    await expect(page.getByText("AI chưa nhận dạng chính xác tên sản phẩm, đã điền tên gợi ý theo ngành hàng.")).toBeVisible();
  });

  test("normalizes localized suggested category and still updates group filter", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "Máy tính văn phòng",
            tone: 1,
            channel: 1,
            mood: 3,
            brandStyle: 2,
            generatedProductName: "Bàn phím cơ không dây",
            targetCustomer: "Dân văn phòng",
            shortDescription: "Thiết bị làm việc",
            highlights: ["Ổn định", "Dễ setup"],
            attributes: [{ type: 0, value: "Kết nối linh hoạt" }],
            confidence: 0.82,
            notes: ["Phân loại theo ảnh thành công"]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("localized-category-computer.png")]);

    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue("Bàn phím cơ không dây");
    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("computerOffice");
    await expect(page.getByLabel("Nhóm ngành")).toHaveValue("electronicsTech");
  });

  test("chooses monitor industry template for ultrawide monitor suggestion", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "computerOffice",
            tone: 1,
            channel: 1,
            mood: 3,
            brandStyle: 2,
            generatedProductName: "Màn hình LG UltraWide",
            targetCustomer: "Dân văn phòng",
            shortDescription: "Màn hình làm việc đa nhiệm",
            highlights: ["Khung mỏng", "Hiển thị rộng"],
            attributes: [{ type: 0, value: "Ultrawide" }],
            confidence: 0.86,
            notes: ["Phù hợp setup màn hình làm việc"]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("ultrawide-lg.png")]);

    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("computerOffice");
    await expect(page.getByLabel("Template ngành hàng")).toHaveValue("1");
  });

  test("normalizes localized category and name from model output", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "Khác",
            tone: 0,
            channel: 2,
            mood: 1,
            brandStyle: 0,
            generatedProductName: "Không nhận dạng tên sản phẩm được.",
            targetCustomer: "",
            shortDescription: "",
            highlights: [],
            attributes: [],
            confidence: 0.32,
            notes: ["Ảnh yếu"]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("localized-name.png")]);

    await expect(page.getByText("Tên nhận dạng từ ảnh: Không nhận dạng tên sản phẩm được")).toBeVisible();
  });

  test("infers monitor category from image filename when product name is empty", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          suggestion: {
            category: "computerOffice",
            tone: 1,
            channel: 1,
            mood: 3,
            brandStyle: 2,
            generatedProductName: "Màn hình máy tính",
            targetCustomer: "Dân văn phòng",
            shortDescription: "Màn hình máy tính phục vụ làm việc",
            highlights: [],
            attributes: [],
            confidence: 0.52,
            notes: ["Đã suy luận từ metadata ảnh (tên file) do chưa có tên sản phẩm."]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']");
    await dropInput.setInputFiles([makePngPayload("ultrawide-monitor.png")]);

    await page.getByRole("button", { name: /gợi ý tự động|đang phân tích/i }).click();

    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("computerOffice");
    await expect(page.getByLabel("Nhóm ngành")).toHaveValue("electronicsTech");
    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue("Màn hình máy tính");
  });

  test("switching from monitor image to shorts image updates group/category/template coherently", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.route("**/api/suggest-from-images", async (route) => {
      const body = route.request().postDataJSON() || {};
      const firstImageName = String(body?.images?.[0]?.name || "").toLowerCase();

      if (firstImageName.includes("monitor")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            suggestion: {
              category: "computerOffice",
              tone: 1,
              channel: 1,
              mood: 3,
              brandStyle: 2,
              generatedProductName: "Màn hình LG UltraWide",
              targetCustomer: "Dân văn phòng",
              shortDescription: "Màn hình làm việc đa nhiệm",
              highlights: ["Khung mỏng", "Hiển thị rộng"],
              attributes: [{ type: 0, value: "Ultrawide" }],
              confidence: 0.86,
              notes: ["Phù hợp setup màn hình làm việc"]
            }
          })
        });
        return;
      }

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
            highlights: ["Mềm", "Thoáng"],
            attributes: [{ type: 0, value: "Dễ mặc" }],
            confidence: 0.78,
            notes: ["Nhận diện đúng ngành thời trang"]
          }
        })
      });
    });

    const dropInput = page.locator(".upload-dropzone input[type='file']");

    await dropInput.setInputFiles([makePngPayload("monitor-first.png")]);
    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("computerOffice");
    await expect(page.getByLabel("Template ngành hàng")).toHaveValue("1");

    await page.locator(".upload-thumb-remove").first().click();

    await dropInput.setInputFiles([makePngPayload("quan-short-second.png")]);

    await expect(page.getByLabel("Tên sản phẩm")).toHaveValue("Quần short nam mặc nhà");
    await expect(page.getByLabel("Nhóm ngành")).toHaveValue("fashionBeauty");
    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("fashion");
    await expect(page.getByLabel("Template ngành hàng")).toHaveValue("0");
  });
});
