import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Back } from "@/veil/icons/back";
import { Chevron } from "@/veil/icons/chevron";
import { EnvelopeFolder } from "@/veil/icons/envelope-folder";
import { FileTypeTag } from "@/veil/icons/file-type-tag";
import { GoogleMark } from "@/veil/icons/google-mark";
import { Heart } from "@/veil/icons/heart";
import type { IconProps } from "@/veil/icons/icon-props";
import { RibbonKnot } from "@/veil/icons/ribbon-knot";
import { Search } from "@/veil/icons/search";
import { SixDotHandle } from "@/veil/icons/six-dot-handle";
import { Star } from "@/veil/icons/star";
import { StruckCloud } from "@/veil/icons/struck-cloud";
import { Tick } from "@/veil/icons/tick";
import { WhatsApp } from "@/veil/icons/whatsapp";

// The gallery (Task 3.0) shows every icon on screen. These checks pin what the
// markup must say for each icon, whatever the screen does with it.
const CURRENT_COLOUR_ICONS = {
  Back,
  Chevron,
  EnvelopeFolder,
  Heart,
  RibbonKnot,
  Search,
  SixDotHandle,
  Star,
  StruckCloud,
  Tick,
  WhatsApp,
};

describe("icons", () => {
  it.each(Object.entries(CURRENT_COLOUR_ICONS))(
    "%s is hidden from screen readers and drawn in currentColor",
    (_name, Icon) => {
      const markup = renderToStaticMarkup(<Icon />);
      expect(markup.startsWith("<svg")).toBe(true);
      expect(markup).toContain('aria-hidden="true"');
      expect(markup).toContain("currentColor");
      expect(markup).not.toMatch(/#[0-9a-f]{3,6}\b/i);
    },
  );

  it("keeps the Google mark hidden and in Google's four brand colours", () => {
    const markup = renderToStaticMarkup(<GoogleMark />);
    expect(markup).toContain('aria-hidden="true"');
    for (const colour of ["#4285F4", "#34A853", "#FBBC05", "#EA4335"]) {
      expect(markup).toContain(`fill="${colour}"`);
    }
  });

  it("passes className to the drawing and cannot turn aria-hidden off", () => {
    // The type already forbids aria-hidden; this checks the runtime as well.
    const sneaky = { "aria-hidden": "false", className: "chev" } as unknown as IconProps;
    const markup = renderToStaticMarkup(<Chevron {...sneaky} />);
    expect(markup).toContain('class="chev"');
    expect(markup).toContain('aria-hidden="true"');
  });

  it("writes the file type as hidden text", () => {
    expect(renderToStaticMarkup(<FileTypeTag ext="pdf" />)).toBe(
      '<span aria-hidden="true">pdf</span>',
    );
  });
});
