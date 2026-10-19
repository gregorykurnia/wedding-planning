import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import manifest from "@/app/manifest";
import { APP_IDENTITY } from "@/lib/model/app-identity";

const ROOT = join(__dirname, "../..");

/** Width, height and colour type from a PNG's IHDR chunk (colour type 6 has an alpha channel, 2 does not). */
function pngHeader(file: string) {
  const bytes = readFileSync(join(ROOT, file));
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20), colorType: bytes[25] };
}

describe("app identity (guide §4.31)", () => {
  it("names the planner in full and on the home screen", () => {
    expect(APP_IDENTITY.name).toBe("Gregory & Bella's Wedding");
    expect(APP_IDENTITY.shortName).toBe("Greg & Bella");
  });

  it("uses blush for the browser bar and white behind the opening screen", () => {
    expect(APP_IDENTITY.themeColor).toBe("#fce6ec");
    expect(APP_IDENTITY.backgroundColor).toBe("#ffffff");
  });

  it("the manifest opens the start page standalone, in those colours", () => {
    expect(manifest()).toMatchObject({
      name: "Gregory & Bella's Wedding",
      short_name: "Greg & Bella",
      start_url: "/",
      display: "standalone",
      background_color: "#ffffff",
      theme_color: "#fce6ec",
    });
  });

  it("lists the Android icons, a maskable one and a monochrome one", () => {
    expect(manifest().icons).toEqual([
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon-mono.svg", sizes: "any", type: "image/svg+xml", purpose: "monochrome" },
    ]);
    for (const icon of manifest().icons ?? []) {
      expect(existsSync(join(ROOT, "public", icon.src))).toBe(true);
    }
  });

  it("the manifest's PNG icons are the sizes they claim, and the maskable one has no transparency", () => {
    expect(pngHeader("public/icon-192.png")).toMatchObject({ width: 192, height: 192 });
    expect(pngHeader("public/icon-512.png")).toMatchObject({ width: 512, height: 512 });
    expect(pngHeader("public/icon-maskable-512.png")).toEqual({ width: 512, height: 512, colorType: 2 });
  });

  it("the iPhone icon is 180 px and opaque, so the home screen never paints black behind it", () => {
    expect(pngHeader("src/app/apple-icon.png")).toEqual({ width: 180, height: 180, colorType: 2 });
  });

  it("the browser tab uses the favicon art, with a 32 px favicon.ico as the fallback", () => {
    expect(existsSync(join(ROOT, "src/app/icon.svg"))).toBe(true);
    const ico = readFileSync(join(ROOT, "src/app/favicon.ico"));
    expect(ico.readUInt16LE(2)).toBe(1); // an icon, not a cursor
    expect(ico.readUInt8(6)).toBe(32); // the first image is 32 px wide
  });
});
