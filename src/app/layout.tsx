import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI 說書人｜隨時繼續收聽",
  description: "為 AI 說書語音打造的私人網頁播放器，記住每一本書的收聽進度。",
  applicationName: "AI 說書人",
  appleWebApp: { capable: true, title: "AI 說書人", statusBarStyle: "black-translucent" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-Hant">
      <body>{children}</body>
    </html>
  );
}
