import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "災鏈 ResQLink",
  description: "堰塞湖災害通報與救災入口生成元件",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-Hant">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
