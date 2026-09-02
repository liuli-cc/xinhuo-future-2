import type { Metadata } from "next";
import "./globals.css";
import "./xinhuo-redesign.css";
import RouteMotionProvider from "@/modules/shared/motion/RouteMotionProvider";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      "http://localhost:3000",
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
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body><RouteMotionProvider>{children}</RouteMotionProvider></body>
    </html>
  );
}
