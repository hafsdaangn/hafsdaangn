import type { Metadata, Viewport } from "next";
import { ExternalBrowser } from "@/components/external-browser";
import { PwaProvider } from "@/components/pwa-provider";
import { siteDescription, siteTitle } from "@/lib/site-metadata";
import "@fontsource-variable/noto-sans-kr";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.APP_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : "http://localhost:3000"),
  ),
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    type: "website",
    locale: "ko_KR",
    siteName: siteTitle,
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: "/brand/og.png",
        width: 1200,
        height: 630,
        alt: "합스당근 로고",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [{ url: "/brand/og.png", alt: "합스당근 로고" }],
  },
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "합스당근", statusBarStyle: "default" },
  applicationName: siteTitle,
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
      </body>
    </html>
  );
}
