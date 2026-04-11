from PIL import Image, ImageDraw, ImageFont
import imageio.v3 as iio
import numpy as np
import math
import os


def main():
    w, h = 1280, 720
    fps = 30
    duration = 10
    total = fps * duration
    out = "D:/genScript/public/guide/video-script-quickstart-10s.mp4"

    steps = [
        (0.0, 2.2, "1. Upload ảnh sản phẩm\n2. Chọn template ngành phù hợp"),
        (2.2, 4.6, "3. Điền brief ngắn: nỗi đau\n4. Chỉnh phong cách nội dung"),
        (4.6, 7.0, "5. Bấm Tạo kịch bản video\n6. Xem output theo từng cảnh"),
        (7.0, 10.0, "7. Chuyển tab so sánh các bản\n8. Chọn bản tốt nhất để dùng"),
    ]

    font_main = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 54)
    font_step = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 40)
    font_small = ImageFont.truetype("C:/Windows/Fonts/segoeui.ttf", 28)

    frames = []
    os.makedirs(os.path.dirname(out), exist_ok=True)

    for i in range(total):
        t = i / fps
        img = Image.new("RGB", (w, h), (18, 14, 20))
        d = ImageDraw.Draw(img)

        for y in range(h):
            r = int(18 + 22 * (y / h))
            g = int(14 + 16 * (y / h))
            b = int(20 + 28 * (y / h))
            d.line([(0, y), (w, y)], fill=(r, g, b))

        orb_x = int(w * 0.18 + math.sin(t * 1.7) * 70)
        orb_y = int(h * 0.22 + math.cos(t * 1.3) * 40)
        d.ellipse((orb_x - 170, orb_y - 170, orb_x + 170, orb_y + 170), fill=(246, 132, 56))

        orb2_x = int(w * 0.82 + math.cos(t * 1.1) * 80)
        orb2_y = int(h * 0.18 + math.sin(t * 1.9) * 36)
        d.ellipse((orb2_x - 130, orb2_y - 130, orb2_x + 130, orb2_y + 130), fill=(235, 83, 108))

        overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        od = ImageDraw.Draw(overlay)
        od.rectangle((80, 90, w - 80, h - 100), fill=(14, 12, 18, 195), outline=(255, 182, 126, 180), width=2)
        img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
        d = ImageDraw.Draw(img)

        title = "Seller Studio · Video Review"
        tw = d.textlength(title, font=font_main)
        d.text(((w - tw) / 2, 130), title, fill=(255, 236, 210), font=font_main)

        subtitle = "Hướng dẫn nhanh 10 giây"
        sw = d.textlength(subtitle, font=font_small)
        d.text(((w - sw) / 2, 200), subtitle, fill=(255, 198, 145), font=font_small)

        current = steps[-1][2]
        for start, end, text in steps:
            if start <= t < end:
                current = text
                break

        lines = current.split("\n")
        y0 = 300
        for idx, line in enumerate(lines):
            lw = d.textlength(line, font=font_step)
            d.text(((w - lw) / 2, y0 + idx * 64), line, fill=(244, 246, 255), font=font_step)

        progress = t / duration
        bar_w, bar_h = 760, 14
        x0 = (w - bar_w) // 2
        yb = h - 150
        d.rounded_rectangle((x0, yb, x0 + bar_w, yb + bar_h), radius=8, fill=(64, 57, 73))
        d.rounded_rectangle((x0, yb, x0 + int(bar_w * progress), yb + bar_h), radius=8, fill=(245, 132, 48))

        hint = "Mẹo: So sánh tab output để chốt bản có hook cuốn nhất"
        hw = d.textlength(hint, font=font_small)
        d.text(((w - hw) / 2, h - 118), hint, fill=(255, 213, 176), font=font_small)

        frames.append(np.array(img))

    iio.imwrite(out, frames, fps=fps, codec="libx264", quality=8)
    print(out)


if __name__ == "__main__":
    main()
