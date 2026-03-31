import "./globals.css";
import { Be_Vietnam_Pro, Noto_Sans, Noto_Sans_Display, Noto_Serif } from "next/font/google";

const fontSans = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap"
});

const fontSerif = Noto_Serif({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-serif",
  display: "swap"
});

const fontVi = Noto_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-vi",
  display: "swap"
});

const fontViDisplay = Noto_Sans_Display({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700"],
  variable: "--font-vi-display",
  display: "swap"
});

export const metadata = {
  title: "Seller Studio",
  description: "AI-powered product description studio",
  icons: {
    icon: [
      { url: "/favicon.ico", type: "image/x-icon", sizes: "any" },
      { url: "/favicon-32x32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16x16.png", type: "image/png", sizes: "16x16" },
      { url: "/favicon.svg", type: "image/svg+xml", sizes: "any" }
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }]
  },
  other: [
    { rel: "mask-icon", url: "/favicon.svg", color: "#df751c" }
  ]
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body className={`${fontSans.variable} ${fontSerif.variable} ${fontVi.variable} ${fontViDisplay.variable}`}>{children}</body>
    </html>
  );
}
