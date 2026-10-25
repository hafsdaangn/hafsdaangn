import type { Metadata } from "next";
import "@fontsource-variable/noto-sans-kr";
import "./globals.css";

export const metadata: Metadata = {
  title: "합스당근 | 우리 학교의 작은 나눔",
  description: "HAFS 학교 계정으로 만나는 무료나눔, 분실물 연결.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "합스당근", statusBarStyle: "default" },
  icons: { apple: "/icons/push-192.png" },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
