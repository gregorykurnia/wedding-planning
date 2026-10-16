import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { GuestRecord } from "@/lib/model/guests";
import type { ItemRecord } from "@/lib/model/items";
import type { TaskRecord } from "@/lib/model/tasks";
import { HeadcountsCard, SidesCard } from "@/veil/parts/guests/counts";
import { GuestRow, RsvpSwitch } from "@/veil/parts/guests/guest-row";
import { headcountRows, inviteLine, metaParts, notCountedLine, plusText, rsvpToast } from "@/veil/parts/guests/guest-text";
import { ItemList } from "@/veil/parts/items/item-list";
import { ItemRow } from "@/veil/parts/items/item-row";
import { menuEntries, personOf } from "@/veil/parts/items/item-text";
import { WorkOnNextCard } from "@/veil/parts/items/work-on-next-card";
import { FinishedTasks } from "@/veil/parts/tasks/finished-tasks";
import { TaskRow } from "@/veil/parts/tasks/task-row";
import { finishedLabel, stepsLine, threadLabel, tickLabel } from "@/veil/parts/tasks/task-text";
import { FlashProvider } from "@/veil/shell/flash";

// Task 3.12: task, item and guest rows as markup (guide §4.27–§4.29). The
// gallery e2e test in tests/e2e/demo/veil-rows.spec.ts moves, drags and fails
// them in a browser.

const TODAY = "2026-10-14";
const markup = (node: ReactElement) => renderToStaticMarkup(<FlashProvider>{node}</FlashProvider>);
const count = (html: string, pattern: RegExp) => (html.match(pattern) ?? []).length;

const task = (over: Partial<TaskRecord> = {}): TaskRecord => ({
  id: "t1",
  title: "Book the flights",
  notes: "",
  dueDate: "2026-10-25",
  done: false,
  subtasks: [],
  ...over,
});

describe("task words", () => {
  it("labels the tick for what pressing it does", () => {
    expect(tickLabel({ title: "Book the flights", done: false })).toBe("Finish Book the flights");
    expect(tickLabel({ title: "Book the flights", done: true })).toBe("Reopen Book the flights");
  });

  it("writes the steps line, the thread label and the finished disclosure", () => {
    expect(stepsLine({ done: 2, total: 5 })).toBe("2 of 5 steps done");
    expect(stepsLine({ done: 0, total: 1 })).toBe("0 of 1 step done");
    expect(threadLabel({ percent: 40 })).toBe("40% of steps done");
    expect(finishedLabel(4, false)).toBe("Show 4 finished tasks");
    expect(finishedLabel(1, true)).toBe("Hide 1 finished task");
  });
});

describe("TaskRow", () => {
  const steps = [
    { id: "s1", title: "Pick the dates", done: true, dueDate: null },
    { id: "s2", title: "Buy the tickets", done: false, dueDate: "2026-10-20" },
  ];

  it("is a closed disclosure with a tick box that reads as a checkbox", () => {
    const html = markup(<TaskRow task={task({ subtasks: steps })} today={TODAY} actions={{}} />);
    expect(html).toContain("<details");
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('aria-checked="false"');
    expect(html).toContain('aria-label="Finish Book the flights"');
    expect(html).toContain("Due 25 Oct");
    expect(html).toContain("1 of 2 steps done");
    expect(html).toContain('aria-label="50% of steps done"');
  });

  it("shows the start of the notes when there are no steps, and nothing when there are neither", () => {
    expect(markup(<TaskRow task={task({ notes: "Ask Bella first" })} today={TODAY} actions={{}} />)).toContain("Ask Bella first");
    expect(markup(<TaskRow task={task()} today={TODAY} actions={{}} />)).not.toContain("steps done");
  });

  it("says a late task is late, in the due text", () => {
    const html = markup(<TaskRow task={task({ dueDate: "2026-10-11" })} today={TODAY} actions={{}} />);
    expect(html).toContain("3 days late");
  });

  it("reads a finished task as Reopen, struck through, with the day it was done", () => {
    const html = markup(<TaskRow task={task({ done: true, doneOn: "2026-09-29" })} today={TODAY} actions={{}} />);
    expect(html).toContain('aria-label="Reopen Book the flights"');
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Done 29 Sep");
  });

  it("draws each step with its check, title, date and remove button, and the failed one with its line", () => {
    const html = markup(<TaskRow task={task({ subtasks: steps })} today={TODAY} actions={{}} defaultOpen failedStepId="s2" />);
    expect(count(html, /aria-label="Remove step"/g)).toBe(2);
    expect(count(html, /type="checkbox"/g)).toBe(2);
    expect(html).toContain('value="Buy the tickets"');
    expect(html).toContain('value="2026-10-20"');
    expect(count(html, /Couldn’t save this step\. What you typed is kept\./g)).toBe(1);
    expect(html).toContain("Try again");
    expect(html).toContain("Add a step");
    expect(html).toContain("Delete task");
  });

  it("makes every control inert in demonstration mode", () => {
    const html = markup(<TaskRow task={task({ subtasks: steps })} today={TODAY} actions={{}} defaultOpen demo />);
    expect(html).toContain('aria-disabled="true"');
    expect(count(html, /disabled=""/g)).toBeGreaterThanOrEqual(6);
  });
});

describe("FinishedTasks", () => {
  it("is a disclosure with the count, and is absent with none", () => {
    expect(markup(<FinishedTasks count={4}><ul /></FinishedTasks>)).toContain("Show 4 finished tasks");
    expect(markup(<FinishedTasks count={4} defaultOpen><ul /></FinishedTasks>)).toContain("Hide 4 finished tasks");
    expect(markup(<FinishedTasks count={0}><ul /></FinishedTasks>)).toBe("");
  });
});

const item = (over: Partial<ItemRecord> = {}): ItemRecord => ({
  id: "i1",
  item: "Wedding cake",
  vendor: "",
  confirmed: false,
  types: ["Reception"],
  persons: ["General"],
  next: false,
  sortOrder: 1,
  ...over,
});

describe("item words", () => {
  it("shows the first person of an item that lists several, and General for none", () => {
    expect(personOf({ persons: ["Groom Mom", "Bride Mom"] })).toBe("Groom Mom");
    expect(personOf({ persons: [] })).toBe("General");
  });

  it("offers Move up and Move down only in our own order", () => {
    expect(menuEntries(true).map((e) => e.label)).toEqual([
      "Add an item below",
      "Add several below",
      "Move up",
      "Move down",
      "Remove",
    ]);
    expect(menuEntries(false).map((e) => e.label)).toEqual(["Add an item below", "Add several below", "Remove"]);
    expect(menuEntries(true).find((e) => e.action === "remove")?.danger).toBe(true);
  });
});

describe("ItemRow", () => {
  const draw = (over: Partial<Parameters<typeof ItemRow>[0]> = {}) =>
    markup(
      <ul>
        <ItemRow item={item()} actions={{}} reorderable {...over} />
      </ul>,
    );

  it("has a handle, the name, the vendor with its placeholder, four event chips, a person, a star, a tick and a menu button", () => {
    const html = draw();
    expect(html).toContain('aria-label="Move Wedding cake. Use Alt with the up and down arrows."');
    expect(html).toContain('value="Wedding cake"');
    expect(html).toContain('placeholder="Vendor not known yet"');
    expect(count(html, /aria-pressed="(true|false)"[^>]*>(Reception|Holy matrimony|Sangjit|Pre-wedding)</g)).toBe(4);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Reception</);
    expect(html).toContain('aria-label="Work on next: Wedding cake"');
    expect(html).toContain('aria-label="Confirmed: Wedding cake"');
    expect(html).toContain('aria-label="More for Wedding cake"');
    expect(html).toContain('draggable="true"');
  });

  it("has no handle and can't be dragged while a sort or filter is on", () => {
    const html = draw({ reorderable: false });
    expect(html).not.toContain("Use Alt with the up and down arrows");
    expect(html).not.toContain("draggable");
  });

  it("presses the star and the tick with aria-pressed, and marks the row to work on next", () => {
    const html = draw({ item: item({ next: true, confirmed: true }) });
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Work on next: Wedding cake"/);
    expect(html).toMatch(/aria-pressed="true"[^>]*aria-label="Confirmed: Wedding cake"/);
  });

  it("says what failed, keeps the vendor typed and offers Try again", () => {
    const html = draw({ item: item({ vendor: "Bespoke Tailor Bali" }), failedField: "vendor" });
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("Couldn’t save “Bespoke Tailor Bali”. What you typed is kept.");
    expect(html).toContain("Try again");
  });

  it("rings a one-tap control whose change didn't save and says the choice is kept", () => {
    const html = draw({ item: item({ confirmed: true }), failedField: "confirmed" });
    expect(html).toMatch(/class="[^"]*ringed[^"]*"[^>]*aria-pressed="true"[^>]*aria-label="Confirmed: Wedding cake"/);
    expect(count(html, /ringed/g)).toBe(1);
    expect(html).toContain("Couldn’t save the change to Wedding cake. Your choice is kept.");
    expect(html).not.toContain('aria-invalid="true"');
    expect(html).toContain("Try again");
  });

  it("fades while dragged and shows the drop line on the edge it will land on", () => {
    expect(draw({ dragging: true })).toMatch(/class="[^"]*dragging/);
    expect(draw({ dropEdge: "above" })).toMatch(/class="[^"]*dropAbove/);
    expect(draw({ dropEdge: "below" })).toMatch(/class="[^"]*dropBelow/);
  });

  it("makes every control inert in demonstration mode", () => {
    const html = draw({ demo: true });
    expect(count(html, /disabled=""/g)).toBeGreaterThanOrEqual(9);
    expect(html).not.toContain("draggable");
  });
});

describe("ItemList and WorkOnNextCard", () => {
  it("draws one row per item and a live region for moves", () => {
    const html = markup(
      <ItemList
        items={[item({ id: "a", item: "A" }), item({ id: "b", item: "B" })]}
        actions={{}}
        reorderable
        onReorder={() => {}}
      />,
    );
    expect(count(html, /data-item-id=/g)).toBe(2);
    expect(html).toContain('aria-live="polite"');
  });

  it("lists the marked items, says how many more, and is absent with none", () => {
    const html = markup(<WorkOnNextCard shown={[item({ item: "Wedding cake" })]} more={4} />);
    expect(html).toContain("To work on next");
    expect(html).toContain("Wedding cake");
    expect(html).toContain("and 4 more");
    expect(markup(<WorkOnNextCard shown={[]} more={0} />)).toBe("");
  });
});

const guest = (over: Partial<GuestRecord> = {}): GuestRecord => ({
  id: "g1",
  number: 12,
  name: "Hendra Santoso",
  connection: "Groom’s uncle",
  country: "Indonesia",
  allergies: "",
  rsvpStatus: "pending",
  eventType: "Both",
  inviteSent: true,
  plusOnes: 0,
  ...over,
});

describe("guest words", () => {
  it("says who a guest is invited to and whether the invitation went", () => {
    expect(inviteLine({ eventType: "Both", inviteSent: true })).toBe("Both events");
    expect(inviteLine({ eventType: "Reception Shortlist", inviteSent: false })).toBe(
      "Reception if space allows, invitation not sent",
    );
  });

  it("writes the toast after one tap, and the plus-ones", () => {
    expect(rsvpToast("王小明", "yes")).toBe("王小明: attending");
    expect(rsvpToast("Tante Lily", "no")).toBe("Tante Lily: not attending");
    expect(plusText(2)).toBe("+2");
    expect(plusText(0)).toBe("");
  });

  it("cuts long food notes after 88 characters, with an ellipsis, as the prototype does", () => {
    const food = metaParts({ connection: "", country: "", allergies: "x".repeat(200) }).food;
    expect(food).toBe("x".repeat(88) + "…");
    expect(metaParts({ connection: "", country: "", allergies: "x".repeat(90) }).food).toBe("x".repeat(90));
    expect(metaParts({ connection: " Aunt ", country: "", allergies: "" })).toEqual({ plain: ["Aunt"], food: "" });
  });
});

describe("RsvpSwitch", () => {
  const draw = (value: "pending" | "yes" | "no", extra: { failed?: boolean; disabled?: boolean } = {}) =>
    markup(<RsvpSwitch label="RSVP for Hendra Santoso" value={value} onChange={() => {}} {...extra} />);

  it("is a radio group of three, with one tab stop on the chosen one", () => {
    const html = draw("yes");
    expect(html).toContain('role="radiogroup"');
    expect(html).toContain('aria-label="RSVP for Hendra Santoso"');
    expect(count(html, /role="radio"/g)).toBe(3);
    expect(html).toMatch(/aria-checked="true"[^>]*tabindex="0"[^>]*data-rsvp="yes"[^>]*>Attending</);
    expect(count(html, /tabindex="-1"/g)).toBe(2);
    expect(html).toContain(">Waiting<");
    expect(html).toContain(">Not attending<");
  });

  it("rings the track when the reply didn't save", () => {
    expect(draw("yes", { failed: true })).toMatch(/class="[^"]*segFailed/);
    expect(draw("yes")).not.toMatch(/segFailed/);
  });
});

describe("GuestRow", () => {
  const draw = (g: GuestRecord, extra: Partial<Parameters<typeof GuestRow>[0]> = {}) =>
    markup(
      <ul>
        <GuestRow guest={g} onRsvp={() => {}} onOpen={() => {}} {...extra} />
      </ul>,
    );

  it("reads the guest number, the name, plus-ones, the invitation and the line of details", () => {
    const html = draw(guest({ plusOnes: 2, allergies: "No pork" }));
    expect(html).toContain("Guest number ");
    expect(html).toMatch(/>12<\/span>/);
    expect(html).toContain("Hendra Santoso");
    expect(html).toContain("<small>+2</small>");
    expect(html).toContain("Both events");
    expect(html).toContain("Groom’s uncle, Indonesia, ");
    expect(html).toContain("No pork");
  });

  it("says the invitation hasn't gone out", () => {
    expect(draw(guest({ inviteSent: false }))).toContain("Both events, invitation not sent");
  });

  it("keeps the line's height when there is nothing to say", () => {
    expect(draw(guest({ connection: "", country: "" }))).toContain(" ");
  });

  it("shows the failed reply with its line and Try again, and the choice that was made", () => {
    const html = draw(guest({ rsvpStatus: "yes" }), { failed: true });
    expect(html).toContain("Couldn’t save the reply for Hendra Santoso. Your choice is kept.");
    expect(html).toContain("Try again");
    expect(html).toMatch(/aria-checked="true"[^>]*data-rsvp="yes"/);
  });

  it("has no failure line otherwise", () => {
    expect(draw(guest())).not.toContain("Try again");
  });
});

describe("HeadcountsCard and SidesCard", () => {
  const counts = { guests: 9, people: 14, attending: 6, waiting: 5, both: 8, reception: 11, receptionIfSpace: 2, ceremony: 9, unsure: 1 };

  it("lists each event, with if space allows under the reception only when someone is", () => {
    expect(headcountRows(counts).map((r) => r.label)).toEqual([
      "Both events",
      "Reception",
      "of which, if space allows",
      "Ceremony",
      "Unsure, living abroad",
    ]);
    expect(headcountRows({ ...counts, receptionIfSpace: 0 }).map((r) => r.label)).not.toContain("of which, if space allows");
    const html = markup(<HeadcountsCard counts={counts} />);
    expect(html).toContain("<h2");
    expect(html).toContain("Headcounts");
    expect(html).toContain("Plus-ones included; anyone not attending left out");
  });

  it("shows family and business on both sides, and a line for people on neither", () => {
    const sides = { groomFamily: 40, groomBusiness: 12, brideFamily: 1250, brideBusiness: 0, notCounted: 3 };
    const html = markup(<SidesCard sides={sides} />);
    expect(html).toContain("Groom’s side");
    expect(html).toContain("Bride’s side");
    expect(html).toMatch(/>1\.250<\/b> family/);
    expect(html).toContain(notCountedLine(3));
    expect(notCountedLine(1)).toBe("1 person not counted: their connection doesn’t say groom’s or bride’s.");
    expect(markup(<SidesCard sides={{ ...sides, notCounted: 0 }} />)).not.toContain("not counted");
  });
});
