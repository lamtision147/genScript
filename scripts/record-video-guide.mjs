import { chromium } from "playwright";
import { promises as fs } from "node:fs";
import path from "node:path";

const OUTPUT_DIR = path.resolve("D:/genScript/public/guide");
const TMP_DIR = path.resolve("D:/genScript/.tmp/guide-recordings");
const OUTPUT_WEBM = path.join(OUTPUT_DIR, "video-script-quickstart-10s.webm");
const PAGE_URL = "https://sellerstudio.site/scriptVideoReview";

const MOCK_SESSION = {
  user: {
    id: "guide-pro-user",
    name: "Guide Pro",
    email: "guide-pro@test.local",
    plan: "pro",
    generateQuota: {
      isPro: true,
      videoScript: { remaining: null, limit: null }
    }
  }
};

const MOCK_GENERATE_RESPONSE = {
  historyId: null,
  selectedVariant: 0,
  variants: [
    {
      title: "Kịch bản 1",
      hook: "Hook bản 1",
      scenes: [
        { label: "Cảnh 1", voice: "Mở đầu ngắn gọn, đúng nỗi đau.", visual: "Cận cảnh vấn đề trước khi dùng sản phẩm." },
        { label: "Cảnh 2", voice: "Nêu điểm nổi bật chính và khác biệt dễ thấy.", visual: "Zoom chi tiết sản phẩm trong bối cảnh thật." },
        { label: "Cảnh 3", voice: "Tầm 199k, cỡ 2-3 ly trà sữa, khá dễ chốt.", visual: "Test nhanh và chèn text giá để chốt." }
      ],
      cta: "Comment 'checklist' để nhận flow quay chi tiết.",
      hashtags: ["#review", "#sellerstudio"],
      shotList: ["Hook nhanh", "Cận cảnh", "CTA"],
      openingStyle: 4,
      variantStyleLabel: "Chuyên gia thuyết phục"
    },
    {
      title: "Kịch bản 2",
      hook: "Hook bản 2",
      scenes: [
        { label: "Cảnh 1", voice: "Mở vấn đề theo góc so sánh trước/sau.", visual: "Split screen trước và sau khi dùng." },
        { label: "Cảnh 2", voice: "Điểm nổi bật 1 + lợi ích rõ trong dùng thật.", visual: "Quay thao tác thật theo nhịp nhanh." },
        { label: "Cảnh 3", voice: "Giá chưa đến 200k nên test thử cũng đỡ lăn tăn.", visual: "Chèn caption giá + phản ứng người dùng." }
      ],
      cta: "Comment 'so sánh' để nhận bản before/after.",
      hashtags: ["#review", "#script"],
      shotList: ["Before/after", "Demo", "CTA"],
      openingStyle: 1,
      variantStyleLabel: "So sánh trước/sau",
      styleLabel: "So sánh trước/sau",
      historyId: "mock_video_hist_2",
      variantGroupId: "mock_video_group_guide"
    }
  ],
  script: {
    title: "Kịch bản 1",
    hook: "Hook bản 1",
    scenes: [
      { label: "Cảnh 1", voice: "Mở đầu ngắn gọn, đúng nỗi đau.", visual: "Cận cảnh vấn đề trước khi dùng sản phẩm." },
      { label: "Cảnh 2", voice: "Nêu điểm nổi bật chính và khác biệt dễ thấy.", visual: "Zoom chi tiết sản phẩm trong bối cảnh thật." },
      { label: "Cảnh 3", voice: "Tầm 199k, cỡ 2-3 ly trà sữa, khá dễ chốt.", visual: "Test nhanh và chèn text giá để chốt." }
    ],
    cta: "Comment 'checklist' để nhận flow quay chi tiết.",
    hashtags: ["#review", "#sellerstudio"],
    shotList: ["Hook nhanh", "Cận cảnh", "CTA"],
    openingStyle: 4,
    variantStyleLabel: "Chuyên gia thuyết phục",
    styleLabel: "Chuyên gia thuyết phục",
    historyId: "mock_video_hist_1",
    variantGroupId: "mock_video_group_guide"
  }
};

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function smoothMouseMove(page, from, to, steps = 22, totalMs = 520) {
  const dx = (to.x - from.x) / steps;
  const dy = (to.y - from.y) / steps;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(from.x + dx * i, from.y + dy * i);
    await delay(Math.max(8, Math.floor(totalMs / steps)));
  }
}

async function clickWithFocusZoom(page, locator) {
  const box = await locator.boundingBox();
  if (!box) return;

  const from = { x: Math.max(20, box.x - 80), y: Math.max(20, box.y - 60) };
  const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 };

  await page.mouse.move(from.x, from.y);
  await smoothMouseMove(page, from, to, 26, 600);
  await delay(80);
  await page.mouse.down();
  await delay(70);
  await page.mouse.up();
}

async function recordGuideVideo() {
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  await fs.mkdir(TMP_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: TMP_DIR,
      size: { width: 1280, height: 720 }
    }
  });

  await context.addInitScript(() => {
    window.localStorage.setItem("seller-studio-video-guide-v1", "1");
  });

  const page = await context.newPage();
  const video = page.video();

  await page.route("**/api/session**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(MOCK_SESSION)
    });
  });

  await page.route("**/api/history?type=video_script**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
  });

  await page.route("**/api/favorites?type=video_script**", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ items: [] }) });
  });

  await page.route("**/api/generate-video-script**", async (route) => {
    await delay(500);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ...MOCK_GENERATE_RESPONSE,
        variants: MOCK_GENERATE_RESPONSE.variants.map((item, index) => ({
          ...item,
          historyId: item.historyId || `mock_video_hist_${index + 1}`,
          variantGroupId: item.variantGroupId || "mock_video_group_guide"
        }))
      })
    });
  });

  await page.goto(PAGE_URL, { waitUntil: "networkidle", timeout: 60000 });
  await delay(700);

  await page.addStyleTag({
    content: `
      html { zoom: 1.15; }
      body { scroll-behavior: auto !important; }
    `
  });
  await delay(350);

  const langSelect = page.locator("#header-language");
  if (await langSelect.count()) {
    await langSelect.selectOption("vi");
    await delay(500);
  }

  const uploadLabel = page.getByText(/Kéo ảnh vào đây hoặc bấm để chọn/i).first();
  if (await uploadLabel.count()) {
    await clickWithFocusZoom(page, uploadLabel);
  }

  const dropInput = page.locator("input[type='file']").first();
  await dropInput.setInputFiles({
    name: "tai-nghe-hyperx-cloud.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO2m8wAAAABJRU5ErkJggg==", "base64")
  });
  await delay(1200);

  const productNameField = page.getByLabel("Tên sản phẩm");
  await productNameField.click();
  await delay(240);

  await page.getByLabel("Vấn đề chính của khách hàng").fill("Tai nghe hay nóng tai, mic rè khi call game");
  await delay(180);
  await page.getByLabel("Điểm nổi bật sản phẩm (mỗi dòng 1 ý)").fill("Đệm tai êm\nMic rõ\nKhung chắc");
  await delay(180);

  const styleSelect = page.getByLabel("Phong cách nội dung").first();
  if (await styleSelect.count()) {
    await clickWithFocusZoom(page, styleSelect);
    await styleSelect.selectOption("expert");
    await delay(250);
  }

  const variantSelect = page.getByLabel("Số bản nội dung").first();
  if (await variantSelect.count()) {
    await variantSelect.selectOption("2");
    await delay(220);
  }

  const generateBtn = page.getByRole("button", { name: "Tạo kịch bản video" });
  await clickWithFocusZoom(page, generateBtn);
  await page.waitForTimeout(2300);

  await context.close();
  await browser.close();

  const videoPath = await video.path();
  await fs.copyFile(videoPath, OUTPUT_WEBM);
  console.log(OUTPUT_WEBM);
}

recordGuideVideo().catch((error) => {
  console.error(error);
  process.exit(1);
});
