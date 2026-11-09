import type { Metadata, Viewport } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/next";
import { ExternalBrowser } from "@/components/external-browser";
import { PwaProvider } from "@/components/pwa-provider";
import "@fontsource-variable/noto-sans-kr";
import "./globals.css";

export const metadata: Metadata = {
  title: "합스당근",
  description: "HAFS 학교 계정으로 만나는 무료나눔, 분실물 연결.",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "합스당근", statusBarStyle: "default" },
  applicationName: "합스당근",
  icons: {
    icon: [{ url: "/icons/favicon.svg", type: "image/svg+xml" }],
    apple: [
      {
        url: "/icons/apple-touch-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko">
      <body>
        <PwaProvider>
          <ExternalBrowser>{children}</ExternalBrowser>
        </PwaProvider>
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
