import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Gregory & Partner's Wedding Planner",
    short_name: "Wedding Planner",
    description: "A cozy place to plan our big day.",
    start_url: "/",
    display: "standalone",
    background_color: "#2b2f4a",
    theme_color: "#2b2f4a",
    icons: [
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
