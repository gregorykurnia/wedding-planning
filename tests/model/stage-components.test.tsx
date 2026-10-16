import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { KeenHeart } from "@/veil/parts/keen/keen-heart";
import { StageChips } from "@/veil/parts/stage/stage-chips";
import { StageThread } from "@/veil/parts/stage/stage-thread";
import { WhatsAppLink } from "@/veil/parts/whatsapp/whatsapp-link";

// Task 3.9: the stage thread, its chips, the keen heart and the WhatsApp link as
// markup (guide §4.21–§4.23). The e2e test in tests/e2e/demo/veil-device.spec.ts
// presses them in a browser.

const markup = (node: ReactElement) => renderToStaticMarkup(node);
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;
const noop = () => {};

describe("StageThread", () => {
  it("draws one dash per step, filled up to the current stage, with the name as text", () => {
    const html = markup(<StageThread kind="vendor" stage="Consideration" />);
    expect(count(html, /<i/g)).toBe(5);
    expect(count(html, /<i class="/g)).toBe(3);
    expect(html).toMatch(/<span class="[^"]*steps[^"]*" aria-hidden="true">/);
    expect(html).toMatch(/<\/span>Considering<\/span>$/);
  });

  it("draws a venue's four steps, all filled once it is booked", () => {
    const html = markup(<StageThread kind="venue" stage="Booked" />);
    expect(count(html, /<i/g)).toBe(4);
    expect(count(html, /<i class="/g)).toBe(4);
    expect(html).toMatch(/Booked<\/span>$/);
  });

  it("draws ruled out as its words, with no dashes", () => {
    const html = markup(<StageThread kind="vendor" stage="Rejected" />);
    expect(html).toMatch(/^<span class="[^"]*out[^"]*">Ruled out<\/span>$/);
    expect(html).not.toContain("<i");
  });
});

describe("StageChips", () => {
  it("offers every stage and then ruled out, as one choice", () => {
    const html = markup(<StageChips kind="vendor" stage="Chosen" onChange={noop} />);
    expect(html).toMatch(/^<div role="radiogroup" aria-label="Stage"/);
    expect(count(html, /role="radio"/g)).toBe(6);
    expect(html).toMatch(/aria-checked="true"[^>]*>Chosen<\/button>/);
    expect(html).toMatch(/>Ruled out<\/button>/);
  });

  it("names the group for the vendor it sets, when given a label", () => {
    const html = markup(
      <StageChips kind="vendor" stage="Noted" label="Stage of Kebun Bunga Atelier" onChange={noop} />,
    );
    expect(html).toContain('aria-label="Stage of Kebun Bunga Atelier"');
  });

  it("offers a venue's four stages and ruled out", () => {
    const html = markup(<StageChips kind="venue" stage="Shortlist" onChange={noop} />);
    expect(count(html, /role="radio"/g)).toBe(5);
    expect(html).toMatch(/>Visited<\/button>/);
  });

  it("is inert in demonstration mode", () => {
    const html = markup(<StageChips kind="vendor" stage="Done" disabled onChange={noop} />);
    expect(count(html, /disabled=""/g)).toBe(6);
  });
});

describe("KeenHeart", () => {
  it("is a toggle button labelled by the vendor, pressed when keen", () => {
    expect(markup(<KeenHeart name="Kebun Bunga Atelier" keen />)).toMatch(
      /^<button type="button" class="[^"]*" aria-pressed="true" aria-label="Keen on Kebun Bunga Atelier">/,
    );
  });

  it("is not pressed when the vendor isn't one we're keen on", () => {
    expect(markup(<KeenHeart name="Kebun Bunga Atelier" keen={false} />)).toContain('aria-pressed="false"');
  });

  it("hides its heart from screen readers, because the label covers it", () => {
    expect(markup(<KeenHeart name="Kebun Bunga Atelier" keen />)).toMatch(/<svg[^>]*aria-hidden="true"/);
  });

  it("is inert in demonstration mode", () => {
    expect(markup(<KeenHeart name="Kebun Bunga Atelier" keen disabled />)).toMatch(/disabled=""/);
  });
});

describe("WhatsAppLink", () => {
  it("opens the number on wa.me in a new tab, with noopener, and a leading 0 becomes 62", () => {
    expect(markup(<WhatsAppLink phone="0812-3456-7890" />)).toMatch(
      /^<a class="[^"]*" href="https:\/\/wa\.me\/6281234567890" target="_blank" rel="noopener">/,
    );
  });

  it("reads WhatsApp in a row and Message on WhatsApp on a detail screen", () => {
    expect(markup(<WhatsAppLink phone="+62 812 3456 7890" />)).toMatch(/>WhatsApp<\/a>$/);
    expect(markup(<WhatsAppLink phone="+62 812 3456 7890" variant="detail" />)).toMatch(
      />Message on WhatsApp<\/a>$/,
    );
  });

  it("draws nothing without a usable number", () => {
    expect(markup(<WhatsAppLink phone={null} />)).toBe("");
    expect(markup(<WhatsAppLink phone="" />)).toBe("");
    expect(markup(<WhatsAppLink phone="Ibu Rina" />)).toBe("");
  });

  it("hides its icon from screen readers", () => {
    expect(markup(<WhatsAppLink phone="0812-3456-7890" />)).toMatch(/<svg[^>]*aria-hidden="true"/);
  });
});
