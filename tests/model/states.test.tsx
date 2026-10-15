import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Loaded } from "@/lib/data/settings";
import { Message, type MessageKind } from "@/veil/parts/message/message";
import { Shimmer } from "@/veil/parts/shimmer/shimmer";
import { Banner, Problem } from "@/veil/shell/banner";
import { ScreenState } from "@/veil/shell/screen-state";

// Task 2.5: the messages, banners, skeleton and screen states, checked as
// markup. The e2e test in tests/e2e/demo/veil-states.spec.ts drives the gallery.

// Path data unique to each mark (see RibbonKnot and StruckCloud).
const KNOT = "M36 36c-8-10-22-14-24-6";
const CLOUD = "M14 14l44 44";

const noop = () => {};

describe("messages", () => {
  const markFor = (kind: MessageKind) =>
    renderToStaticMarkup(<Message kind={kind} title="Title" />);

  it("gives the knot to nothing yet, failures and gone records", () => {
    for (const kind of ["nothing-yet", "failure", "gone"] as const) {
      expect(markFor(kind)).toContain(KNOT);
    }
  });

  it("gives the cloud to offline and no mark to no results", () => {
    expect(markFor("offline")).toContain(CLOUD);
    expect(markFor("no-results")).not.toContain("<svg");
  });

  it("has a level-one title in full and a level-two title inline", () => {
    expect(renderToStaticMarkup(<Message kind="failure" title="Full" />)).toMatch(
      /<h1[^>]*>Full<\/h1>/,
    );
    expect(renderToStaticMarkup(<Message kind="failure" title="Inline" inline />)).toMatch(
      /<h2[^>]*>Inline<\/h2>/,
    );
  });
});

describe("screen states", () => {
  const show = (read: Loaded<string>) =>
    renderToStaticMarkup(
      <ScreenState read={read} what="the budget" onRetry={noop}>
        {(data) => <p>{data ?? "The empty set"}</p>}
      </ScreenState>,
    );

  it("loading says what loads and shows a skeleton hidden from screen readers", () => {
    const html = show({ status: "loading", data: null });
    expect(html).toContain("Loading the budget");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("The empty set");
  });

  it("couldn't load shows the message with Try again when no data has arrived", () => {
    const html = show({ status: "error", data: null });
    expect(html).toContain("The budget didn’t load");
    expect(html).toContain("Try again");
  });

  it("offline with no data shows the cloud message, not the screen", () => {
    const html = show({ status: "offline", data: null });
    expect(html).toContain("You’re offline");
    expect(html).toContain(CLOUD);
    expect(html).not.toContain("The empty set");
  });

  it("keeps cached data on screen when a read fails or goes offline", () => {
    expect(show({ status: "offline", data: "Cached" })).toContain("<p>Cached</p>");
    expect(show({ status: "offline", data: "Cached" })).not.toContain("You’re offline");
    expect(show({ status: "error", data: "Cached" })).toContain("<p>Cached</p>");
  });

  it("demonstration mode shows the banner above the empty data set", () => {
    const html = show({ status: "demo", data: null });
    expect(html).toContain("Demonstration mode. The planner isn’t connected");
    expect(html).toContain("<p>The empty set</p>");
  });

  it("ready shows the screen with its data", () => {
    expect(show({ status: "ready", data: "Data" })).toContain("<p>Data</p>");
  });
});

describe("banners, problem boxes and the skeleton", () => {
  it("a problem with the alert role says so to screen readers", () => {
    expect(renderToStaticMarkup(<Problem role="alert">Wrong</Problem>)).toContain(
      'role="alert"',
    );
    expect(renderToStaticMarkup(<Problem tone="calm">Note</Problem>)).not.toContain("role=");
  });

  it("the pill under the top bar sits in a wrapper, and the inline box does not", () => {
    expect(renderToStaticMarkup(<Banner>Pill</Banner>).startsWith("<div")).toBe(true);
    expect(renderToStaticMarkup(<Banner inline>Box</Banner>).startsWith("<p")).toBe(true);
  });

  it("the skeleton is one hidden block of seven shapes", () => {
    const html = renderToStaticMarkup(<Shimmer />);
    expect(html.match(/<div/g)).toHaveLength(8);
    expect(html).toContain('aria-hidden="true"');
  });
});
