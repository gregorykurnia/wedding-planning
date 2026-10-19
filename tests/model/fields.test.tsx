import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SaveScopeContext, type SaveScope } from "@/lib/data/use-autosave-field";
import { saveLine, type FieldStatus } from "@/lib/model/save-state";
import {
  Check,
  DateInput,
  FieldInput,
  FieldRow,
  Fields,
  FieldSelect,
  FieldText,
  Hint,
  StaticValue,
  Stepper,
} from "@/veil/parts/fields/fields";
import { InlineRename } from "@/veil/parts/fields/inline-rename";
import { BigInput, MoneyInput } from "@/veil/parts/fields/money";
import { Notes, NotesView } from "@/veil/parts/fields/notes";
import { SaveLine } from "@/veil/parts/fields/save-scope";

// Task 3.4: the field parts as markup. The behaviour (saving, failing, retrying)
// is driven in a browser by tests/e2e/demo/veil-fields.spec.ts.

const noop = () => {};
const working = { failed: false, retry: noop, disabled: false };

function scope(statuses: FieldStatus[], demo = false, sheet = false): SaveScope {
  return { demo, sheet, line: saveLine(statuses, demo), report: noop, forget: noop, retryAll: noop };
}

const render = (node: React.ReactNode) => renderToStaticMarkup(node);

describe("FieldRow", () => {
  it("ties the label to the input and the hint to the label", () => {
    const html = render(
      <FieldRow label="Wedding date" hint="Every countdown works from this.">
        <DateInput value="2027-06-12" />
      </FieldRow>,
    );
    const id = /<label[^>]*for="([^"]+)"/.exec(html)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
    expect(html).toContain("Every countdown works from this.");
    expect(html).toMatch(/aria-describedby="[^"]+"/);
  });

  it("shows the failure line and Try again, not the hint, when a change didn't save", () => {
    const html = render(
      <FieldRow label="Name" hint="A hint." field={{ ...working, failed: true }}>
        <FieldInput value="Isabella" />
      </FieldRow>,
    );
    expect(html).toContain("Couldn’t save this change. What you typed is kept.");
    expect(html).toContain("Try again");
    expect(html).not.toContain("A hint.");
    expect(html).toContain('aria-invalid="true"');
  });

  it("leaves the failure line to a sheet's save line, keeping only the ring", () => {
    const html = render(
      <SaveScopeContext.Provider value={scope(["failed"], false, true)}>
        <FieldRow label="Name" hint="A hint." field={{ ...working, failed: true }}>
          <FieldInput value="Isabella" />
        </FieldRow>
      </SaveScopeContext.Provider>,
    );
    expect(html).toContain('aria-invalid="true"');
    expect(html).not.toContain("Try again");
    expect(html).not.toContain("What you typed is kept");
    expect(html).toContain("A hint.");
  });

  it("says a value can't be saved with the same look as a failure", () => {
    const html = render(
      <FieldRow label="Name" problem="Give the booking a name so you can find it later.">
        <FieldInput value="" />
      </FieldRow>,
    );
    expect(html).toContain("Give the booking a name so you can find it later.");
    expect(html).not.toContain("Try again");
    expect(html).toContain('aria-invalid="true"');
  });

  it("disables the row and its control in demonstration mode", () => {
    const html = render(
      <FieldRow label="Name" field={{ ...working, disabled: true }}>
        <FieldInput value="" />
      </FieldRow>,
    );
    expect(html).toContain('aria-disabled="true"');
    expect(html).toMatch(/<input[^>]*disabled/);
  });

  it("names a group of controls by its label, not a for attribute", () => {
    const html = render(
      <FieldRow label="Plus-ones" group>
        <Stepper value={2} />
      </FieldRow>,
    );
    expect(html).not.toContain("<label");
    expect(html).toMatch(/role="group"[^>]*aria-labelledby="[^"]+"/);
  });

  it("hides the label from sight but not from screen readers in the notes editor", () => {
    const html = render(
      <FieldRow label="Notes" hideLabel>
        <FieldText value="" />
      </FieldRow>,
    );
    expect(html).toMatch(/<label[^>]*class="sr"/);
  });
});

describe("controls", () => {
  it("renders every type", () => {
    const html = render(
      <Fields>
        <FieldRow label="Text"><FieldInput value="a" /></FieldRow>
        <FieldRow label="Money"><MoneyInput value={12_500_000} /></FieldRow>
        <FieldRow label="Date"><DateInput value="2027-06-12" /></FieldRow>
        <FieldRow label="Select"><FieldSelect value="b" options={[{ value: "a", label: "A" }, { value: "b", label: "B" }]} /></FieldRow>
        <FieldRow label="Textarea"><FieldText value="long" /></FieldRow>
        <FieldRow label="Check" group><Check value>Sent</Check></FieldRow>
        <FieldRow label="Static" group><StaticValue>Rp 1</StaticValue></FieldRow>
      </Fields>,
    );
    expect(html).toContain('type="text"');
    expect(html).toContain('type="date"');
    expect(html).toContain("<select");
    expect(html).toContain("<textarea");
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Rp 1");
  });

  it("shows money as Rp with dots, with a numeric keyboard and a Rp 0 placeholder", () => {
    const html = render(<MoneyInput value={12_500_000} />);
    expect(html).toContain('value="Rp 12.500.000"');
    expect(html).toContain('inputMode="numeric"');
    expect(html).toContain('placeholder="Rp 0"');
    expect(render(<MoneyInput value={null} />)).toContain('value=""');
  });

  it("renders the big input with a hidden label", () => {
    const html = render(<BigInput id="amt" label="Amount paid" text="Rp 75.000.000" onText={noop} />);
    expect(html).toMatch(/<label[^>]*for="amt"[^>]*>Amount paid<\/label>/);
    expect(html).toContain('value="Rp 75.000.000"');
  });

  it("rings the big input rose when what is typed isn't an amount", () => {
    const html = render(<BigInput id="amt" label="Amount paid" text="12 juta" onText={noop} invalid />);
    expect(html).toContain('aria-invalid="true"');
    expect(render(<BigInput id="amt" label="Amount paid" text="" onText={noop} />)).not.toContain("aria-invalid");
  });

  it("stops the stepper at its limits", () => {
    expect(render(<Stepper value={0} label="Plus-ones" />)).toMatch(/aria-label="One fewer"[^>]*disabled/);
    expect(render(<Stepper value={20} label="Plus-ones" />)).toMatch(/aria-label="One more"[^>]*disabled/);
    const middle = render(<Stepper value={2} label="Plus-ones" />);
    expect(middle).not.toMatch(/disabled/);
    expect(middle).toContain("<b aria-live=\"polite\">2</b>");
  });

  it("has a standalone hint", () => {
    expect(render(<Hint>It never changes the agreed price.</Hint>)).toContain("It never changes the agreed price.");
  });
});

describe("SaveLine", () => {
  const html = (statuses: FieldStatus[], demo = false, inSheet = false) =>
    render(
      <SaveScopeContext.Provider value={scope(statuses, demo, inSheet)}>
        <SaveLine />
      </SaveScopeContext.Provider>,
    );

  it("is a status line that follows the fields", () => {
    expect(html([])).toContain('role="status"');
    expect(html([])).toContain("Every change saves as you go");
    expect(html(["saving"])).toContain(">Saving<");
    expect(html(["saved"])).toContain(">Saved<");
  });

  it("says how many changes didn't save, with no button on a screen", () => {
    const out = html(["failed", "failed"]);
    expect(out).toContain("2 changes not saved");
    expect(out).not.toContain("<button");
  });

  it("gives a sheet the failure words and a Try again", () => {
    const out = html(["failed"], false, true);
    expect(out).toContain("Couldn’t save. What you typed is kept.");
    expect(out).toContain("Try again");
  });

  it("says demonstration mode before anything else", () => {
    expect(html(["failed"], true)).toContain("Demonstration mode: changes aren’t saved");
  });

  it("renders nothing outside a save scope", () => {
    expect(render(<SaveLine />)).toBe("");
  });
});

describe("notes", () => {
  it("turns web addresses into links that open, without https://", () => {
    const html = render(<NotesView text={"See https://www.example.com/menu now"} />);
    expect(html).toContain('href="https://www.example.com/menu"');
    expect(html).toContain(">example.com/menu<");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("keeps line breaks", () => {
    expect(render(<NotesView text={"one\ntwo"} />)).toContain("one\ntwo");
  });

  it("offers Add notes, and says nothing is written, when empty", () => {
    const html = render(<Notes value="" />);
    expect(html).toContain("Add notes");
    expect(html).toContain("Nothing written yet.");
  });

  it("offers Edit when there are notes, and none in demonstration mode", () => {
    expect(render(<Notes value="Ask about the tasting" />)).toContain(">Edit<");
    expect(render(<Notes value="" disabled />)).not.toContain("<button");
  });
});

describe("InlineRename", () => {
  it("shows the name as an input with Save name and Cancel", () => {
    const html = render(<InlineRename name="Greg" label="Funder's name" onSave={async () => {}} onClose={noop} />);
    expect(html).toContain('value="Greg"');
    expect(html).toContain("Save name");
    expect(html).toContain("Cancel");
    expect(html).toMatch(/<label[^>]*class="sr"[^>]*>Funder&#x27;s name<\/label>/);
    expect(html).toContain('maxLength="60"');
  });

  it("takes a name's own cap while typing, such as a category's 40 (review P4-S12)", () => {
    const html = render(<InlineRename name="Food" label="Rename Food" maxLength={40} onSave={async () => {}} onClose={noop} />);
    expect(html).toContain('maxLength="40"');
  });
});
