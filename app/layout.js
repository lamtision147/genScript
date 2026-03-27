import "./globals.css";

export const metadata = {
  title: "Seller Studio",
  description: "AI-powered product description studio"
};

export default function RootLayout({ children }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
