import type { ReactElement, ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SaveScopeContext, type SaveScope } from "@/lib/data/use-autosave-field";
import { SAVE_DEMO, SAVE_IDLE, SHEET_FAILED, saveLine, type FieldStatus } from "@/lib/model/save-state";
import { TextLink } from "@/veil/parts/actions/text-link";
import { BlockedNotice, InlineConfirm } from "@/veil/shell/confirm";
import { CreateSheetActions, EditSheetActions, SheetContext } from "@/veil/shell/sheet";

// Task 3.8: the create and edit sheet frames, the inline and blocked confirms, as
// markup (guide §4.14, §4.15). The session is a stand-in (the components read
// it), and the sheet is a stand-in control, since there is no host here. The
// e2e test in tests/e2e/demo/veil-sheets.spec.ts drives the real host.

vi.mock("@/lib/data/session", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/data/session")>()),
  useSession: () => ({ connection: "online" }),
}));

const noop = () => {};

const sheetStand = { close: noop, setBusy: noop, titleId: "sheet-title" };
const markup = (node: ReactElement) =>
  renderToStaticMarkup(<SheetContext.Provider value={sheetStand}>{node}</SheetContext.Provider>);

const scopeOf = (statuses: FieldStatus[], demo = false): SaveScope => ({
  demo,
  sheet: true,
  line: saveLine(statuses, demo),
  report: noop,
  forget: noop,
  retryAll: noop,
});

const inScope = (scope: SaveScope, node: ReactNode) => (
  <SaveScopeContext.Provider value={scope}>{node}</SaveScopeContext.Provider>
);

// Done is the sheet's only button that closes it, so its disabled attribute is
// what the tests read.
const doneIsOff = (html: string) => /disabled=""[^>]*>Done</.test(html);

describe("CreateSheetActions", () => {
  it("puts the quiet Cancel before the primary", () => {
    const html = markup(<CreateSheetActions action="Add a booking" onAction={noop} demo={false} />);
    expect(html.indexOf(">Cancel<")).toBeLessThan(html.indexOf(">Add a booking<"));
  });

  it("says adding is off and disables the primary in demonstration mode", () => {
    const html = markup(<CreateSheetActions action="Add a booking" onAction={noop} demo />);
    expect(html).toContain("Demonstration mode: adding is turned off.");
    expect(html).toMatch(/disabled=""[^>]*>Add a booking</);
  });

  it("says its own line in demonstration mode when it records rather than adds", () => {
    const html = markup(
      <CreateSheetActions
        action="Record payment"
        onAction={noop}
        demo
        demoLine="Demonstration mode: recording is turned off."
      />,
    );
    expect(html).toContain("Demonstration mode: recording is turned off.");
    expect(html).not.toContain("adding is turned off");
    expect(html).toMatch(/disabled=""[^>]*>Record payment</);
  });

  it("disables the primary while something it waits for isn't ready, with no demonstration line", () => {
    const html = markup(<CreateSheetActions action="Record payment" onAction={noop} demo={false} disabled />);
    expect(html).toMatch(/disabled=""[^>]*>Record payment</);
    expect(html).not.toContain("Demonstration mode");
  });

  it("leaves the primary enabled, with no line, outside demonstration mode", () => {
    const html = markup(<CreateSheetActions action="Add a booking" onAction={noop} demo={false} />);
    expect(html).not.toContain("Demonstration mode");
    expect(html).not.toMatch(/disabled=""[^>]*>Add a booking</);
  });

  it("shows its busy label while the write runs, and holds Cancel off", () => {
    const html = markup(
      <CreateSheetActions action="Add a booking" onAction={noop} demo={false} busy busyLabel="Adding" />,
    );
    expect(html).toContain(">Adding<");
    expect(html).toContain('aria-busy="true"');
    expect(html).toMatch(/disabled=""[^>]*>Cancel</);
  });

  it("puts an optional rose link under the actions", () => {
    const html = markup(
      <CreateSheetActions
        action="Add a booking"
        onAction={noop}
        demo={false}
        link={
          <TextLink tone="rose" onClick={noop}>
            Delete
          </TextLink>
        }
      />,
    );
    expect(html.indexOf(">Add a booking<")).toBeLessThan(html.indexOf(">Delete<"));
  });
});

describe("EditSheetActions", () => {
  it("shows the idle save line and an enabled Done", () => {
    const html = markup(inScope(scopeOf([]), <EditSheetActions />));
    expect(html).toContain(SAVE_IDLE);
    expect(html).toContain(">Done<");
    expect(doneIsOff(html)).toBe(false);
  });

  it("holds Done off while a change is saving", () => {
    const html = markup(inScope(scopeOf(["saving"]), <EditSheetActions />));
    expect(html).toContain("Saving");
    expect(doneIsOff(html)).toBe(true);
  });

  it("keeps Done off after a change that didn't save, with the sheet's words and Try again", () => {
    const html = markup(inScope(scopeOf(["failed"]), <EditSheetActions />));
    expect(html).toContain(SHEET_FAILED);
    expect(html).toContain("Try again");
    expect(doneIsOff(html)).toBe(true);
  });

  it("enables Done once saved, and in demonstration mode", () => {
    const saved = markup(inScope(scopeOf(["saved"]), <EditSheetActions />));
    expect(saved).toContain("Saved");
    expect(doneIsOff(saved)).toBe(false);

    const demo = markup(inScope(scopeOf([], true), <EditSheetActions />));
    expect(demo).toContain(SAVE_DEMO);
    expect(doneIsOff(demo)).toBe(false);
  });

  it("shows no save line without a save scope", () => {
    const html = markup(<EditSheetActions />);
    expect(html).not.toContain(SAVE_IDLE);
    expect(html).toContain(">Done<");
  });

  it("puts the rose link under Done", () => {
    const html = markup(
      inScope(
        scopeOf([]),
        <EditSheetActions
          link={
            <TextLink tone="rose" onClick={noop}>
              Remove guest
            </TextLink>
          }
        />,
      ),
    );
    expect(html.indexOf(">Done<")).toBeLessThan(html.indexOf(">Remove guest<"));
  });
});

describe("InlineConfirm", () => {
  it("asks the question with its consequence, Keep it first, then the rose action", () => {
    const html = markup(
      <InlineConfirm
        question={
          <>
            Remove <b>Florist</b>?
          </>
        }
        body="Its 4 vendors move to Other."
        action="Remove category"
        run={async () => {}}
        onKeep={noop}
        onDone={noop}
      />,
    );
    expect(html).toContain("Remove <b>Florist</b>?");
    expect(html).toContain("Its 4 vendors move to Other.");
    expect(html.indexOf(">Keep it<")).toBeLessThan(html.indexOf(">Remove category<"));
  });

  it("shows no failure line before a write has failed", () => {
    const html = markup(
      <InlineConfirm
        question="Remove Florist?"
        action="Remove category"
        run={async () => {}}
        onKeep={noop}
        onDone={noop}
      />,
    );
    expect(html).not.toContain("Couldn’t do that.");
    expect(html).not.toContain('aria-busy="true"');
  });
});

describe("BlockedNotice", () => {
  it("names what is in the way, and its one button is OK", () => {
    const html = markup(
      <BlockedNotice
        title="Empty Catering first"
        body="It still holds 4 files and 1 folder. Move or delete them, then delete the folder."
      />,
    );
    expect(html).toContain("Empty Catering first");
    expect(html).toContain("It still holds 4 files and 1 folder.");
    expect(html).toContain(">OK<");
    expect(html).not.toContain("Cancel");
  });
});
