import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Context, CountFigure, Figure, Hero, Kicker } from "@/veil/parts/hero/hero";
import { Thread } from "@/veil/parts/hero/thread";

// Task 3.1: the hero, kicker, figure, context and thread as markup (guide §3,
// §4.4). The e2e test in tests/e2e/demo/veil-hero.spec.ts checks the look.

const markup = (node: ReactElement) => renderToStaticMarkup(node);

describe("Figure", () => {
  it("writes the digits with dots, with Rp set small before them", () => {
    expect(markup(<Figure amount={409_650_000} />)).toMatch(
      /^<p class="[^"]*figure[^"]*"><span class="[^"]*rp[^"]*">Rp<\/span>409\.650\.000<\/p>$/,
    );
  });

  it("puts a true minus first, before Rp", () => {
    expect(markup(<Figure amount={-12_500_000} />)).toMatch(
      /^<p class="[^"]*">−<span class="[^"]*rp[^"]*">Rp<\/span>12\.500\.000<\/p>$/,
    );
  });

  it("is rose when late or overpaid, and gold when paid in full", () => {
    expect(markup(<Figure amount={1} tone="late" />)).toMatch(/class="[^"]*late/);
    expect(markup(<Figure amount={1} tone="over" />)).toMatch(/class="[^"]*over/);
    expect(markup(<Figure amount={1} tone="settled" />)).toMatch(/class="[^"]*settled/);
  });

  it("shrinks when it is longer than 13 digits, and not before", () => {
    expect(markup(<Figure amount={98_765_432_109_876} />)).toMatch(/class="[^"]*long/);
    expect(markup(<Figure amount={409_650_000} />)).not.toMatch(/class="[^"]*long/);
  });
});

describe("CountFigure", () => {
  it("is the figure for a count: digits with dots and no Rp", () => {
    expect(markup(<CountFigure count={3} />)).toMatch(/^<p class="[^"]*figure[^"]*md[^"]*">3<\/p>$/);
    expect(markup(<CountFigure count={1204} />)).toContain(">1.204<");
    expect(markup(<CountFigure count={3} />)).not.toContain("Rp");
  });

  it("can say how many there are in all: \"12 of 25\"", () => {
    expect(markup(<CountFigure count={12} of={25} />)).toMatch(/>12<span class="[^"]*of[^"]*">of 25<\/span><\/p>$/);
    expect(markup(<CountFigure count={1204} of={2004} />)).toContain("of 2.004");
    expect(markup(<CountFigure count={12} />)).not.toContain("of");
  });

  it("is rose when something is late", () => {
    expect(markup(<CountFigure count={2} tone="late" />)).toMatch(/class="[^"]*late/);
    expect(markup(<CountFigure count={2} />)).not.toMatch(/class="[^"]*late/);
  });
});

describe("Kicker and Context", () => {
  it("are paragraphs with their words in them", () => {
    expect(markup(<Kicker>Still to pay</Kicker>)).toMatch(
      /^<p class="[^"]*kicker[^"]*">Still to pay<\/p>$/,
    );
    expect(markup(<Context>of Rp 1 committed</Context>)).toMatch(
      /^<p class="[^"]*context[^"]*">of Rp 1 committed<\/p>$/,
    );
  });
});

describe("Hero", () => {
  it("puts the title in a level-one heading that follows the text's direction", () => {
    expect(markup(<Hero title="Budget" />)).toMatch(/<h1 class="[^"]*" dir="auto">Budget<\/h1>/);
  });

  it("has no heading for a figure-only hero", () => {
    expect(
      markup(
        <Hero>
          <Kicker>If you went ahead</Kicker>
        </Hero>,
      ),
    ).not.toContain("<h1");
  });

  it("shows the category above the title and the sub line below it", () => {
    const html = markup(
      <Hero category="Florist" title="Blossom" sub="Booked 2 March">
        <Kicker>Still to pay</Kicker>
      </Hero>,
    );
    expect(html.indexOf("Florist")).toBeLessThan(html.indexOf("<h1"));
    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("Booked 2 March"));
    expect(html.indexOf("Booked 2 March")).toBeLessThan(html.indexOf("Still to pay"));
  });

  it("sets the figure block under a title, and not on a figure-only hero", () => {
    const titled = markup(
      <Hero title="Budget">
        <Kicker>Still to pay</Kicker>
      </Hero>,
    );
    const figureOnly = markup(
      <Hero>
        <Kicker>Still to pay</Kicker>
      </Hero>,
    );
    expect(titled).toMatch(/<div class="[^"]*afterHead[^"]*"><p/);
    expect(figureOnly).not.toMatch(/afterHead/);
  });

  it("places the sub-navigation between the title and the figure", () => {
    const html = markup(
      <Hero title="Vendors" nav={<nav>Shortlist</nav>}>
        <Kicker>Still to pay</Kicker>
      </Hero>,
    );
    expect(html.indexOf("<h1")).toBeLessThan(html.indexOf("Shortlist"));
    expect(html.indexOf("Shortlist")).toBeLessThan(html.indexOf("Still to pay"));
  });
});

describe("Thread", () => {
  it("is an image labelled in words, so a screen reader hears the share", () => {
    expect(markup(<Thread fill={54} ends={["54% paid", "46% to go"]} label="54% paid, 46% to go" />)).toMatch(
      /^<div class="[^"]*thread[^"]*" role="img" aria-label="54% paid, 46% to go">/,
    );
  });

  it("fills the track to its share, with a dot at the end of the fill", () => {
    const html = markup(<Thread fill={54} label="54% paid" />);
    expect(html).toContain('style="width:54%"');
    expect(html).toContain('style="left:54%"');
  });

  it("keeps the share between 0 and 100", () => {
    expect(markup(<Thread fill={130} label="over" />)).toContain('style="width:100%"');
    expect(markup(<Thread fill={-5} label="none" />)).toContain('style="width:0%"');
  });

  it("has no dot when told not to, as on the what-if thread", () => {
    expect(markup(<Thread fill={88} dot={false} label="88% committed" />)).not.toContain(
      'style="left:88%"',
    );
  });

  it("draws a dashed run from the fill to the end, for what-if money", () => {
    expect(markup(<Thread fill={88} maybe label="88% committed" />)).toContain(
      'style="left:88%;right:0"',
    );
  });

  it("turns the fill rose when overpaid", () => {
    expect(markup(<Thread fill={100} over label="100% paid, overpaid" />)).toMatch(
      /class="[^"]*over/,
    );
  });

  it("is a thin track with no dot or labels when small", () => {
    const html = markup(
      <Thread small fill={60} ends={["60% paid", "40% to go"]} label="60% paid" />,
    );
    expect(html).toMatch(/class="[^"]*small/);
    expect(html).not.toContain("60% paid</span>");
    expect(html).not.toContain('style="left:60%"');
  });
});

describe("Hero lead", () => {
  it("puts what's above the title first, and gives it room only when a title follows", () => {
    const withTitle = markup(<Hero lead={<p>Greg &amp; Bella</p>} title="When is the wedding?" />);
    expect(withTitle).toMatch(/<div class="[^"]*lead[^"]*"><p>Greg &amp; Bella<\/p><\/div><div><h1/);
    const figureOnly = markup(<Hero lead={<p>Greg &amp; Bella</p>}><p>157</p></Hero>);
    expect(figureOnly).toMatch(/<div><p>Greg &amp; Bella<\/p><\/div><div><p>157<\/p><\/div>/);
  });

  it("draws nothing for a missing lead", () => {
    expect(markup(<Hero title="Budget" />)).not.toMatch(/lead/);
  });
});
