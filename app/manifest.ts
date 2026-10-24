import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "합스당근",
    short_name: "합스당근",
    description: "우리 학교의 작은 장터",
    start_url: "/app/chats",
    scope: "/",
    display: "standalone",
    lang: "ko",
    background_color: "#ffffff",
    theme_color: "#e87532",
    icons: [192, 512].map((size) => ({
      src: `/icons/push-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
    })),
  };
}
