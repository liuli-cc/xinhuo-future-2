import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      "https://xinhuo-student-growth-287017-7-1417313793.sh.run.tcloudbase.com",
  ),
  title: "薪火·AI 大学生成长平台",
  description: "聚合成长地图、证据型能力画像、可解释成长决策、成长资源与实习就业的学生成长中心。",
  openGraph: {
    title: "薪火·AI 大学生成长平台",
    description: "让每一次成长，都有迹可循。",
    images: [{ url: "/og-v2.png", width: 1672, height: 941 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "薪火·AI 大学生成长平台",
    description: "让每一次成长，都有迹可循。",
    images: ["/og-v2.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
