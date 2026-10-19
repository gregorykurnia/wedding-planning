import { describe, expect, it } from "vitest";
import { isIphone, suggestInstall } from "@/lib/model/install";

const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const MAC_SAFARI =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15";

describe("isIphone", () => {
  it("recognises an iPhone's browsers", () => {
    expect(isIphone(IPHONE_SAFARI)).toBe(true);
  });

  it("is false for Android Chrome and for a Mac", () => {
    expect(isIphone(ANDROID_CHROME)).toBe(false);
    expect(isIphone(MAC_SAFARI)).toBe(false);
  });
});

describe("suggestInstall (guide §4.30)", () => {
  const phoneInBrowser = { phone: true, installed: false, dismissed: false, iphone: false, installable: false };

  it("suggests on an iPhone in the browser, which never gets an install prompt", () => {
    expect(suggestInstall({ ...phoneInBrowser, iphone: true })).toBe(true);
  });

  it("suggests on Android once the browser offers to install the planner", () => {
    expect(suggestInstall({ ...phoneInBrowser, installable: true })).toBe(true);
  });

  it("stays quiet on Android until the browser offers to install", () => {
    expect(suggestInstall(phoneInBrowser)).toBe(false);
  });

  it("never suggests on a computer", () => {
    expect(suggestInstall({ ...phoneInBrowser, phone: false, iphone: true, installable: true })).toBe(false);
  });

  it("never suggests once it is installed, or turned away on this device", () => {
    expect(suggestInstall({ ...phoneInBrowser, iphone: true, installed: true })).toBe(false);
    expect(suggestInstall({ ...phoneInBrowser, iphone: true, dismissed: true })).toBe(false);
  });
});
