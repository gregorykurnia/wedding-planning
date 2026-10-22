import { afterEach, describe, expect, it } from "vitest";
import nextConfig from "../../next.config";
import { GET } from "@/app/gallery-off/route";
import { veilHref } from "@/veil/href";

// Review P3-S13 and P6-S12: with its switch off, the dev-only component gallery
// is unreachable, and its addresses get a real 404 rather than the new UI's
// not-found screen (which answers 200 from the catch-all at the root).
const saved = process.env.NEXT_PUBLIC_VEIL_GALLERY;
afterEach(() => {
  if (saved === undefined) delete process.env.NEXT_PUBLIC_VEIL_GALLERY;
  else process.env.NEXT_PUBLIC_VEIL_GALLERY = saved;
});

describe("the gallery switch", () => {
  it("sends every gallery address to /gallery-off before any page matches, when off", async () => {
    delete process.env.NEXT_PUBLIC_VEIL_GALLERY;
    expect(await nextConfig.rewrites!()).toEqual({
      beforeFiles: [{ source: `${veilHref("/gallery")}/:path*`, destination: "/gallery-off" }],
      afterFiles: [],
      fallback: [],
    });
  });

  it("leaves the gallery alone when on", async () => {
    process.env.NEXT_PUBLIC_VEIL_GALLERY = "1";
    expect(await nextConfig.rewrites!()).toEqual([]);
  });

  it("answers /gallery-off with its own 404", async () => {
    const response = GET();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("Not found");
  });
});

describe("unknown API addresses", () => {
  it("answer 404 with JSON, not the new UI's not-found screen", async () => {
    const { GET, POST, DELETE } = await import("@/app/api/[...rest]/route");
    for (const handler of [GET, POST, DELETE]) {
      const response = handler();
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: "Not found" });
    }
  });
});
