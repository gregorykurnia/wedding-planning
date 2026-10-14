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
    ];
  },
};

export default nextConfig;
