import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The test runs start two dev servers from this folder; each needs its own
  // build folder (tests set NEXT_DIST_DIR). Normal runs use .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // The state harness's switch (src/lib/data/dev-faults.ts) is fixed at build time:
  // "0" unless the build asked for "1", so a production build drops the fault code
  // rather than reading process.env when it runs (P5-S22).
  env: { NEXT_PUBLIC_VEIL_DEV: process.env.NEXT_PUBLIC_VEIL_DEV === "1" ? "1" : "0" },
  // The dev disk cache (on by default since 16.1) never shrinks; in the test
  // folders it reached 4 GB each per lane. Test servers start cold instead.
  experimental: {
    turbopackFileSystemCacheForDev: !process.env.NEXT_DIST_DIR,
  },
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
  // Since the switch-over (Task 7.1) the new UI serves the site root and the old
  // one is the frozen fallback under /old. Old addresses with no page of the same
  // name in the new UI, and every /new address the new UI had while it was built
  // (bookmarks, links in reminders already sent), go to their new pages. These
  // stay temporary until the fallback is removed (Phase 9): a browser remembers a
  // permanent redirect, and after a rollback (plan §9.3) it would keep sending
  // /login to a /sign-in that no longer exists.
  async redirects() {
    const moved: [string, string][] = [
      ["/new", "/"],
      ["/new/:path*", "/:path*"],
      ["/login", "/sign-in"],
      ["/confirmed", "/budget/bookings"],
      ["/master-list", "/items"],
      ["/todo", "/schedule/tasks"],
      ["/checklist", "/schedule/tasks"],
      ["/notes", "/documents"],
      ["/venues", "/vendors/venues"],
      ["/shortlist", "/vendors/shortlist"],
      ["/files", "/documents/files"],
    ];
    return moved.map(([source, destination]) => ({ source, destination, permanent: false }));
  },
  // The component gallery is dev-only. With its switch off, its addresses are
  // rewritten to /gallery-off, whose own route answers a plain 404 (any other
  // unknown address reaches the new UI's catch-all, which shows the not-found
  // screen with a 200). beforeFiles runs before the page match, so the gallery
  // pages never render.
  async rewrites() {
    if (process.env.NEXT_PUBLIC_VEIL_GALLERY === "1") return [];
    return {
      beforeFiles: [{ source: "/gallery/:path*", destination: "/gallery-off" }],
      afterFiles: [],
      fallback: [],
    };
  },
};

export default nextConfig;
