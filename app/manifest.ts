import type { MetadataRoute } from "next";
import { siteDescription, siteTitle } from "@/lib/site-metadata";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: siteTitle,
    short_name: siteTitle,
    description: siteDescription,
    start_url: "/app/chats",
    scope: "/",
    display: "standalone",
    lang: "ko",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      ...[192, 512].map((size) => ({
        src: `/icons/icon-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any" as const,
      })),
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
