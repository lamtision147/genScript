const { test, expect } = require("@playwright/test");
const { ensureLanguage } = require("./helpers");

test.describe("Category Defaults", () => {
  test("does not include an all-categories option", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    const groupSelect = page.getByLabel("Nhóm ngành");
    const values = await groupSelect.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("value"))
    );
    expect(values).not.toContain("all");
  });

  test("auto applies marketplace defaults on category and channel change", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    const categoryGroup = page.getByLabel("Nhóm ngành");
    await expect(categoryGroup).toBeVisible();
    await categoryGroup.selectOption("motherBabyHealth");

    const categorySelect = page.getByLabel("Danh mục sản phẩm");
    await categorySelect.selectOption("motherBaby");

    const channelSelect = page.getByLabel("Kênh bán");
    await expect(channelSelect).toHaveValue("1");

    const stylePresetSelect = page.getByLabel("Phong cách nội dung");
    await expect(stylePresetSelect).toHaveValue("expert");

    await page.locator("details.advanced-style-details summary").click();
    const toneSelect = page.getByLabel("Phong cách", { exact: true });
    const brandStyleSelect = page.getByLabel("Phong cách thương hiệu");
    const moodSelect = page.getByLabel("Mood nội dung");
    await expect(toneSelect).toHaveValue("1");
    await expect(brandStyleSelect).toHaveValue("2");
    await expect(moodSelect).toHaveValue("3");

    await channelSelect.selectOption("2");
    await expect(channelSelect).toHaveValue("2");
    await expect(toneSelect).toHaveValue("1");
    await expect(brandStyleSelect).toHaveValue("2");
    await expect(moodSelect).toHaveValue("1");
    await expect(stylePresetSelect).toHaveValue("custom");
  });

  test("group selection scopes category options", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.getByLabel("Nhóm ngành").selectOption("fashionBeauty");
    const categorySelect = page.getByLabel("Danh mục sản phẩm");
    const optionValuesFashion = await categorySelect.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("value"))
    );
    expect(optionValuesFashion).toContain("fragrance");
    expect(optionValuesFashion).not.toContain("toolsHardware");

    await page.getByLabel("Nhóm ngành").selectOption("homeLiving");
    const optionValuesHome = await categorySelect.locator("option").evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("value"))
    );
    expect(optionValuesHome).toContain("toolsHardware");
    expect(optionValuesHome).not.toContain("fragrance");
  });

  test("category filter keeps selected category when switching group", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    const groupSelect = page.getByLabel("Nhóm ngành");
    await groupSelect.selectOption("electronicsTech");

    const categorySelect = page.getByLabel("Danh mục sản phẩm");
    await categorySelect.selectOption("cameraDrone");
    await expect(categorySelect).toHaveValue("cameraDrone");

    await groupSelect.selectOption("fashionBeauty");
    await expect(categorySelect).toHaveValue("fashion");
  });

  test("group and category stay aligned after sample apply", async ({ page }) => {
    await page.goto("/scriptProductInfo");
    await ensureLanguage(page, "vi");

    await page.getByLabel("Nhóm ngành").selectOption("electronicsTech");
    await page.getByRole("button", { name: "Dữ liệu mẫu", exact: true }).click();

    await expect(page.getByLabel("Danh mục sản phẩm")).toHaveValue("electronics");
    await expect(page.getByLabel("Nhóm ngành")).toHaveValue("electronicsTech");
  });

});
