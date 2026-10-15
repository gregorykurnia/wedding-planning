import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The test runs start two dev servers from this folder; each needs its own
  // build folder (tests set NEXT_DIST_DIR). Normal runs use .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  async headers() {
    return [
      {
        // Firebase's signInWithPopup needs to poll window.closed on the
        // Google auth popup; the platform default COOP value blocks that.
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
        ],
      },
      {
        // Browsers must always check for a new worker, never use a stored one.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  // The component gallery is dev-only. With its switch off, its addresses are
  // rewritten to a path that doesn't exist, so the server answers 404. A not-found
  // page rendered while streaming would answer 200 instead. beforeFiles runs before
  // the page match, so the gallery pages never render.
  async rewrites() {
    if (process.env.NEXT_PUBLIC_VEIL_GALLERY === "1") return [];
    return {
      beforeFiles: [{ source: "/new/gallery/:path*", destination: "/new/gallery-off" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
