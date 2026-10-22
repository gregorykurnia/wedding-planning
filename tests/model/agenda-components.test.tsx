import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { agendaGroups, monthCells, type AgendaItem } from "@/lib/model/agenda";
import { AgendaGroup } from "@/veil/parts/agenda/agenda-group";
import { AgendaRow } from "@/veil/parts/agenda/agenda-row";
import { isCallLink, lateFlag, paidByText, recordHref, rowKind, rowSub, rowWhen } from "@/veil/parts/agenda/agenda-text";
import { MonthCalendar } from "@/veil/parts/month/month-calendar";
import { FlashProvider } from "@/veil/shell/flash";

// Task 3.11: the agenda row's words and addresses, and the rows, groups and
// month grid as markup. The gallery e2e test drives them in a browser.

const TODAY = "2026-10-14";

const item = (over: Partial<AgendaItem> = {}): AgendaItem => ({
  key: "event:e",
  type: "event",
  id: "e",
  kind: "appointment",
  date: "2026-10-16",
  start: "11:00",
  end: "12:30",
  title: "Tasting",
  where: "",
  notes: "",
  status: "scheduled",
  relatedId: null,
  amount: null,
  funder: null,
  partId: null,
  steps: null,
  ...over,
});

const payment = (over: Partial<AgendaItem> = {}) =>
  item({ key: "payment:vendor-v:", type: "payment", id: "vendor-v", kind: "payment", start: null, end: null, amount: 60_000_000, ...over });

const task = (over: Partial<AgendaItem> = {}) =>
  item({ key: "task:t", type: "task", id: "t", kind: "task", start: null, end: null, title: "Book flights", ...over });

const noop = () => {};
const row = (i: AgendaItem, extra: Partial<Parameters<typeof AgendaRow>[0]> = {}) =>
  renderToStaticMarkup(
    <FlashProvider>
      <ul>
        <AgendaRow item={i} today={TODAY} {...extra} />
      </ul>
    </FlashProvider>,
  );

describe("rowWhen", () => {
  it("shows the start and end of a timed event", () => {
    expect(rowWhen(item(), TODAY)).toEqual({ main: "11:00", small: "12:30" });
    expect(rowWhen(item({ end: null }), TODAY)).toEqual({ main: "11:00", small: null });
  });

  it("says All day for an event with no time and Due for payments and tasks", () => {
    expect(rowWhen(item({ start: null, end: null }), TODAY).main).toBe("All day");
    expect(rowWhen(payment(), TODAY).main).toBe("Due");
    expect(rowWhen(task(), TODAY).main).toBe("Due");
  });

  it("shows the date instead of the time when late, and the time again once it's done", () => {
    expect(rowWhen(item({ date: "2026-10-11" }), TODAY)).toEqual({ main: "11 Oct", small: null });
    expect(rowWhen(payment({ date: "2026-10-10" }), TODAY).main).toBe("10 Oct");
    expect(rowWhen(item({ date: "2026-10-11", status: "completed" }), TODAY).main).toBe("11:00");
    expect(rowWhen(item({ date: "2026-10-14" }), TODAY).main).toBe("11:00");
  });

  it("adds the year to a late date from another year", () => {
    expect(rowWhen(item({ date: "2025-12-30" }), TODAY).main).toBe("30 Dec 2025");
  });
});

describe("rowKind", () => {
  it("names the kind and the end state", () => {
    expect(rowKind(item({ kind: "vendor_call" }))).toBe("Vendor call");
    expect(rowKind(item({ kind: "organiser_call" }))).toBe("Organiser call");
    expect(rowKind(payment())).toBe("Payment");
    expect(rowKind(task())).toBe("Task");
    expect(rowKind(item({ status: "completed" }))).toBe("Appointment, completed");
    expect(rowKind(item({ status: "cancelled" }))).toBe("Appointment, cancelled");
  });
});

describe("rowSub and the late flag", () => {
  it("gives an event's place, but a call link only as the link", () => {
    expect(rowSub(item({ where: "Jl. Raya 88" }))).toBe("Jl. Raya 88");
    expect(rowSub(item({ where: "https://meet.google.com/abc" }))).toBeNull();
    expect(isCallLink(" https://meet.google.com/abc ")).toBe(true);
    expect(isCallLink("Call on https://meet.google.com/abc")).toBe(false);
    expect(rowSub(item())).toBeNull();
  });

  it("gives a payment its amount and who pays", () => {
    expect(rowSub(payment(), "Bella")).toBe("Rp 60.000.000, paid by Bella");
    expect(rowSub(payment(), null)).toBe("Rp 60.000.000, no funder yet");
    expect(paidByText("")).toBe("no funder yet");
  });

  it("gives a task its steps done, and nothing without steps", () => {
    expect(rowSub(task({ steps: { done: 1, total: 3, percent: 33 } }))).toBe("1 of 3 steps done");
    expect(rowSub(task({ steps: { done: 0, total: 1, percent: 0 } }))).toBe("0 of 1 step done");
    expect(rowSub(task())).toBeNull();
  });

  it("flags only what is late", () => {
    expect(lateFlag(item({ date: "2026-10-11" }), TODAY)).toBe("3 days late");
    expect(lateFlag(item({ date: "2026-10-13" }), TODAY)).toBe("1 day late");
    expect(lateFlag(item({ date: "2026-10-14" }), TODAY)).toBeNull();
    expect(lateFlag(item({ date: "2026-10-11", status: "cancelled" }), TODAY)).toBeNull();
  });
});

describe("recordHref", () => {
  it("links a payment to its booking and a task to its open row, and an event to nothing", () => {
    expect(recordHref(payment())).toBe("/budget/bookings/vendor-v");
    expect(recordHref(task())).toBe("/schedule/tasks?open=t");
    expect(recordHref(item())).toBeNull();
  });

  it("escapes an id", () => {
    expect(recordHref(task({ id: "a b/c" }))).toBe("/schedule/tasks?open=a%20b%2Fc");
  });
});

describe("AgendaRow", () => {
  it("makes an event title a button and a payment or task title a link", () => {
    expect(row(item())).toMatch(/<button[^>]*>Tasting<\/button>/);
    expect(row(payment({ title: "Catering" }))).toMatch(/<a[^>]*href="\/budget\/bookings\/vendor-v"[^>]*>Catering<\/a>/);
    expect(row(task())).toMatch(/<a[^>]*href="\/schedule\/tasks\?open=t"[^>]*>Book flights<\/a>/);
  });

  it("marks titles and lines for either writing direction", () => {
    expect(row(item({ where: "Bali" }))).toMatch(/<button[^>]*dir="auto"/);
    expect(row(item({ where: "Bali" }))).toMatch(/<span[^>]*dir="auto"[^>]*>Bali<\/span>/);
  });

  it("draws a call link as Join the call, opening in a new tab", () => {
    const html = row(item({ where: "https://meet.google.com/abc" }));
    expect(html).toMatch(/<a[^>]*href="https:\/\/meet.google.com\/abc"[^>]*target="_blank"[^>]*rel="noopener noreferrer"[^>]*>Join the call<\/a>/);
    expect(html).not.toContain(">https://");
  });

  it("links an event to its vendor or venue", () => {
    expect(row(item(), { related: { name: "Sendok Emas", href: "/vendors/sendok" } })).toMatch(
      /<a[^>]*href="\/vendors\/sendok"[^>]*>Sendok Emas<\/a>/,
    );
    expect(row(payment(), { related: { name: "Sendok Emas", href: "/x" } })).not.toContain("Sendok Emas");
  });

  it("flags a late event and turns its date rose", () => {
    const html = row(item({ date: "2026-10-11", start: null, end: null }));
    expect(html).toContain("3 days late");
    expect(html).toMatch(/class="[^"]*late/);
    expect(html).toContain("<b>11 Oct</b>");
  });

  it("gives a payment a quiet Record payment, primary once it is late", () => {
    const ontime = row(payment({ date: "2026-10-20" }));
    const late = row(payment({ date: "2026-10-10" }));
    const button = (html: string) => /<button[^>]*class="([^"]*)"[^>]*>Record payment<\/button>/.exec(html)?.[1] ?? "";
    expect(button(ontime)).toMatch(/quiet/);
    expect(button(late)).not.toMatch(/quiet/);
    expect(late).toContain("4 days late");
    expect(ontime).not.toContain("days late");
    expect(row(task({ date: "2026-10-20" }))).not.toContain("Record payment");
  });

  it("strikes a completed or cancelled row and says so in the kind", () => {
    for (const status of ["completed", "cancelled"] as const) {
      const html = row(item({ status, date: "2026-10-11" }));
      expect(html).toMatch(new RegExp(`class="[^"]*${status}`));
      expect(html).toContain(`Appointment, ${status}`);
      expect(html).not.toContain("days late");
    }
  });

  it("colours our own Payment events by kind but gives them no payment button", () => {
    const html = row(item({ kind: "payment" }));
    expect(html).toMatch(/class="[^"]*payment/);
    expect(html).not.toContain("Record payment");
  });
});

describe("AgendaGroup", () => {
  const items = [item({ key: "a", id: "a", date: "2026-10-11", title: "Late one" }), item({ key: "b", id: "b", date: "2026-10-14", title: "Today one" })];
  const [late, today] = agendaGroups(items, TODAY);
  const draw = (group: typeof late) =>
    renderToStaticMarkup(
      <FlashProvider>
        <AgendaGroup group={group} today={TODAY} onOpen={noop} />
      </FlashProvider>,
    );

  it("heads Late with how many things, in rose", () => {
    const html = draw(late);
    expect(html).toMatch(/<h2[^>]*>Late<small>1 thing<\/small><\/h2>/);
    expect(html).toMatch(/<h2 class="[^"]*groupLate/);
  });

  it("heads today with the day and Today on the right", () => {
    expect(draw(today)).toMatch(/<h2[^>]*>Today, Wednesday 14 October<small>Today<\/small><\/h2>/);
  });

  it("heads a day with nothing on it without an empty list", () => {
    const html = draw({ key: "2026-10-20", title: "Tuesday 20 October", late: false, today: false, count: 0, items: [] });
    expect(html).toMatch(/<h2[^>]*>Tuesday 20 October<\/h2>/);
    expect(html).not.toContain("<ul");
  });

  it("says the whole group's size after paging", () => {
    expect(draw({ ...late, count: 12 })).toContain("12 things");
  });
});

describe("MonthCalendar", () => {
  const cellsFor = (selected: string | null) =>
    monthCells({
      year: 2026,
      month: 10,
      items: [item({ key: "w", id: "w", date: "2026-10-31", title: "Wedding" }), payment({ date: "2026-10-30" })],
      today: TODAY,
      selected,
      wedding: "2026-10-31",
    });
  const draw = (selected: string | null = TODAY) =>
    renderToStaticMarkup(
      <MonthCalendar year={2026} month={10} cells={cellsFor(selected)} today={TODAY} onPick={noop} onEarlier={noop} onLater={noop} onToday={noop} />,
    );

  it("heads the month with Earlier, Later and Back to today", () => {
    const html = draw();
    expect(html).toMatch(/<h2[^>]*>October<\/h2>/);
    expect(html).toContain('aria-label="Earlier: September"');
    expect(html).toContain('aria-label="Later: November"');
    expect(html).toContain("Back to today");
  });

  it("names the next year when the month is in another year", () => {
    const html = renderToStaticMarkup(
      <MonthCalendar year={2026} month={12} cells={[]} today={TODAY} onPick={noop} onEarlier={noop} onLater={noop} onToday={noop} />,
    );
    expect(html).toContain('aria-label="Later: January 2027"');
  });

  it("has one button per day, with the full label from the model", () => {
    const html = draw();
    expect(html.match(/<button[^>]*aria-pressed/g)).toHaveLength(31);
    expect(html).toContain('aria-label="Wednesday 14 October, today, selected, nothing"');
    expect(html).toContain('aria-label="Friday 30 October, 1 payment"');
    expect(html).toContain('aria-label="Saturday 31 October, the wedding day, 1 event"');
  });

  it("presses only the chosen day", () => {
    const html = draw();
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toMatch(/aria-label="Wednesday 14 October, today, selected, nothing" aria-pressed="true"/);
    expect(draw(null).match(/aria-pressed="true"/g)).toBeNull();
  });

  it("starts on the right weekday: three blank cells before Thursday 1 October", () => {
    const html = draw();
    expect(html.match(/aria-hidden="true"[^>]*class="[^"]*empty|class="[^"]*empty[^"]*"[^>]*aria-hidden/g)).toHaveLength(3);
    expect(html.indexOf("Thursday 1 October")).toBeGreaterThan(html.indexOf("Sun"));
  });

  it("hides the dots and the weekday letters from screen readers", () => {
    const html = draw();
    expect(html.match(/<span class="[^"]*weekday[^"]*" aria-hidden="true"/g)).toHaveLength(7);
    expect(html).toMatch(/<span class="[^"]*dots[^"]*" aria-hidden="true"/);
  });

  it("lists the legend", () => {
    const legend = /<p class="[^"]*legend[^"]*">(.*?)<\/p>/.exec(draw())?.[1] ?? "";
    for (const text of ["Our events", "Payments", "Tasks", "Late"]) expect(legend).toContain(text);
  });

  it("shows the +N after three marks", () => {
    const busy = Array.from({ length: 5 }, (_, n) => item({ key: `k${n}`, id: `k${n}`, date: "2026-10-16", title: `E${n}` }));
    const html = renderToStaticMarkup(
      <MonthCalendar
        year={2026}
        month={10}
        cells={monthCells({ year: 2026, month: 10, items: busy, today: TODAY, selected: null, wedding: null })}
        today={TODAY}
        onPick={noop}
        onEarlier={noop}
        onLater={noop}
        onToday={noop}
      />,
    );
    expect(html).toContain('<em data-more="+2">');
    expect(html).toContain("5 events");
  });
});
