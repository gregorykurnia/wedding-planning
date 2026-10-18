import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DaysLine } from "@/veil/parts/days/days-line";

// Task 4.3: the budget's closing line (guide §5.4, N7) as markup. The e2e tests
// in tests/e2e/ check it on the screen.

/** The words on screen: the markup without its tags and React's comment markers. */
const words = (node: ReactElement) =>
  renderToStaticMarkup(node)
    .replace(/<!--.*?-->/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();

// Wednesday 14 October 2026, the day the design's examples are written for.
const TODAY = "2026-10-14";

describe("DaysLine", () => {
  it("counts the days to a wedding that's further off", () => {
    expect(words(<DaysLine wedding="2027-03-20" today={TODAY} />)).toBe("157 days until Saturday 20 March 2027");
  });

  it("says tomorrow the day before", () => {
    expect(words(<DaysLine wedding="2026-10-15" today={TODAY} />)).toBe(
      "Tomorrow is the wedding, Thursday 15 October",
    );
  });

  it("says today on the day", () => {
    expect(words(<DaysLine wedding={TODAY} today={TODAY} />)).toBe("Today is the wedding day");
  });

  it("says married, with the day, once the count has ended", () => {
    expect(words(<DaysLine wedding="2026-10-02" today={TODAY} />)).toBe("Married on Friday 2 October");
  });

  it("draws nothing without a wedding date", () => {
    expect(renderToStaticMarkup(<DaysLine wedding={null} today={TODAY} />)).toBe("");
  });
});
