import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI 說書人",
    short_name: "AI 說書人",
    description: "為 AI 說書語音打造的私人網頁播放器。",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f1e4",
    theme_color: "#0f3f35",
    icons: [
      {
        src: "/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
