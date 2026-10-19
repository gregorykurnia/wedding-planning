import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Btn } from "@/veil/parts/actions/btn";
import { DirectionWord } from "@/veil/parts/actions/direction-word";
import { TextLink } from "@/veil/parts/actions/text-link";
import { Chip, ChipGroup } from "@/veil/parts/chips/chip";
import { FocusChips } from "@/veil/parts/chips/focus-chips";

// Task 3.3: the buttons, links and chips as markup (guide §4.10, §4.11, §4.13).
// The e2e test in tests/e2e/demo/veil-actions.spec.ts checks how they look and
// what a press does in a browser.

const markup = (node: ReactElement) => renderToStaticMarkup(node);
const noop = () => {};

describe("Btn", () => {
  it("is a button of type button, so it can't submit a form by accident", () => {
    expect(markup(<Btn>Add vendor</Btn>)).toMatch(/^<button [^>]*type="button"/);
  });

  it("is busy with its gerund in place of the label, and says so", () => {
    const busy = markup(
      <Btn busy busyLabel="Recording">
        Record payment
      </Btn>,
    );
    expect(busy).toContain('aria-busy="true"');
    expect(busy).toContain(">Recording<");
    expect(busy).not.toContain("Record payment");
  });

  it("keeps its label when busy has no gerund to show", () => {
    expect(markup(<Btn busy>Save</Btn>)).toContain(">Save<");
  });

  it("is disabled with the disabled attribute, so a press does nothing", () => {
    expect(markup(<Btn disabled>Move here</Btn>)).toMatch(/^<button [^>]*disabled=""/);
  });

  it("renders as a link when it has a path", () => {
    expect(markup(<Btn href="/new/budget">Add a booking</Btn>)).toMatch(
      /^<a [^>]*href="\/new\/budget"/,
    );
  });

  it("opens an outside address in a new tab, or saves it when asked to download", () => {
    const open = markup(
      <Btn href="https://example.com/q.pdf" external={{}}>
        Open
      </Btn>,
    );
    expect(open).toMatch(/^<a [^>]*href="https:\/\/example\.com\/q\.pdf"/);
    expect(open).toContain('target="_blank"');
    expect(open).toContain('rel="noreferrer"');
    const save = markup(
      <Btn href="https://example.com/q.pdf" external={{ download: true }}>
        Download
      </Btn>,
    );
    expect(save).toContain('download=""');
    expect(save).not.toContain("target=");
  });

  it("keeps Google's four brand colours in its mark", () => {
    const google = markup(<Btn variant="google">Continue with Google</Btn>);
    expect(google).toContain('fill="#4285F4"');
    expect(google).toContain('fill="#EA4335"');
  });
});

describe("TextLink", () => {
  it("is a button of type button, so it acts in place", () => {
    expect(markup(<TextLink>Rename</TextLink>)).toMatch(/^<button [^>]*type="button"/);
  });

  it("is a link when it has a path", () => {
    expect(markup(<TextLink href="/new/vendors">On the shortlist</TextLink>)).toMatch(
      /^<a [^>]*href="\/new\/vendors"/,
    );
  });

  it("is busy with its gerund in place of the label, and says so (Task 3.8's inline confirm)", () => {
    const busy = markup(
      <TextLink tone="rose" busy busyLabel="Removing">
        Remove category
      </TextLink>,
    );
    expect(busy).toContain('aria-busy="true"');
    expect(busy).toContain(">Removing<");
    expect(busy).not.toContain("Remove category");
  });
});

describe("DirectionWord", () => {
  it("shows the direction the list sorts in", () => {
    expect(markup(<DirectionWord ascending onToggle={noop} />)).toMatch(/>Ascending<\/button>$/);
    expect(markup(<DirectionWord ascending={false} onToggle={noop} />)).toMatch(
      />Descending<\/button>$/,
    );
  });
});

describe("Chip", () => {
  it("says whether it is pressed when it is a toggle", () => {
    expect(markup(<Chip pressed>Decoration</Chip>)).toContain('aria-pressed="true"');
    expect(markup(<Chip pressed={false}>Decoration</Chip>)).toContain('aria-pressed="false"');
  });

  it("has no pressed state when it is an action chip", () => {
    expect(markup(<Chip>Edit</Chip>)).not.toContain("aria-pressed");
  });

  it("shows its count after the name", () => {
    expect(markup(<Chip count="12">Decoration</Chip>)).toMatch(
      /Decoration<small[^>]*>12<\/small>/,
    );
  });
});

describe("ChipGroup", () => {
  const options = [
    { value: "akad", label: "Akad" },
    { value: "reception", label: "Reception" },
    { value: "both", label: "Both" },
  ];
  const chipsIn = (group: string) => [...group.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)];

  it("is a radio group whose one checked radio is the chosen value", () => {
    const group = markup(
      <ChipGroup label="Event" options={options} value="reception" onChange={noop} />,
    );
    expect(group).toMatch(/^<div [^>]*role="radiogroup"[^>]*aria-label="Event"/);
    const checked = chipsIn(group).map((m) => [m[2], m[1].includes('aria-checked="true"')]);
    expect(checked).toEqual([
      ["Akad", false],
      ["Reception", true],
      ["Both", false],
    ]);
  });

  it("keeps one tab stop, on the chosen radio", () => {
    const stops = chipsIn(
      markup(<ChipGroup label="Event" options={options} value="reception" onChange={noop} />),
    ).map((m) => [m[2], m[1].match(/tabindex="(-?\d)"/)?.[1]]);
    expect(stops).toEqual([
      ["Akad", "-1"],
      ["Reception", "0"],
      ["Both", "-1"],
    ]);
  });
});

describe("FocusChips", () => {
  const chips = [
    { id: "", label: "All", count: "2.004" },
    { id: "venue", label: "Venue", count: "3" },
    { id: "catering", label: "Catering", count: "5" },
  ];

  it("is a group with its name, and one pressed chip: the focus", () => {
    const row = markup(
      <FocusChips label="Focus on a category" chips={chips} value="venue" onChoose={noop} />,
    );
    expect(row).toMatch(/^<div [^>]*role="group"[^>]*aria-label="Focus on a category"/);
    const pressed = [...row.matchAll(/<button([^>]*)>([^<]*)<small/g)]
      .filter((m) => m[1].includes('aria-pressed="true"'))
      .map((m) => m[2]);
    expect(pressed).toEqual(["Venue"]);
  });

  it("shows each count after its name", () => {
    expect(
      markup(<FocusChips label="Focus" chips={chips} value="" onChoose={noop} />),
    ).toMatch(/Venue<small[^>]*>3<\/small>/);
  });

  it("offers Edit categories only when there is something to edit", () => {
    const withEdit = markup(
      <FocusChips label="Focus" chips={chips} value="" onChoose={noop} onEdit={noop} />,
    );
    expect(withEdit).toContain("Edit categories");
    expect(markup(<FocusChips label="Focus" chips={chips} value="" onChoose={noop} />)).not.toContain(
      "Edit categories",
    );
  });
});
