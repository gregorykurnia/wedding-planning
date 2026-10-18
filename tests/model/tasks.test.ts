import { describe, expect, it } from "vitest";
import { finishedTasks, isTaskLate, openTasks, shownCount, stepsDone, taskCounts, taskDueText, taskMeta, type TaskRecord } from "@/lib/model/tasks";

const TODAY = "2026-10-14";

let n = 0;
const task = (over: Partial<TaskRecord> = {}): TaskRecord => ({
  id: `t${++n}`,
  title: `Task ${n}`,
  notes: "",
  dueDate: null,
  done: false,
  subtasks: [],
  ...over,
});

const step = (done: boolean) => ({ id: `s${++n}`, title: "Step", dueDate: null, done });

const ids = (list: TaskRecord[]) => list.map((t) => t.id);

describe("open tasks", () => {
  it("run by due date with undated ones last, and leave out finished ones", () => {
    const a = task({ id: "a", dueDate: "2026-10-25" });
    const b = task({ id: "b", dueDate: null });
    const c = task({ id: "c", dueDate: "2026-10-12" });
    const d = task({ id: "d", dueDate: "2026-10-18", done: true });
    const e = task({ id: "e", dueDate: "2027-01-02" });
    expect(ids(openTasks([a, b, c, d, e]))).toEqual(["c", "a", "e", "b"]);
  });

  it("keep their order when dates tie, and treat a bad date as undated", () => {
    const a = task({ id: "a", dueDate: "2026-10-20" });
    const b = task({ id: "b", dueDate: "2026-10-20" });
    const c = task({ id: "c", dueDate: "not a date" });
    const d = task({ id: "d", dueDate: "" });
    expect(ids(openTasks([c, b, d, a]))).toEqual(["b", "a", "c", "d"]);
  });

  it("don't change the list they were given", () => {
    const list = [task({ id: "a", dueDate: "2026-10-25" }), task({ id: "b", dueDate: "2026-10-01" })];
    openTasks(list);
    expect(ids(list)).toEqual(["a", "b"]);
  });

  it("handle 401 tasks", () => {
    const many = Array.from({ length: 401 }, (_, i) => task({ dueDate: i % 5 ? `2026-10-${String(1 + (i % 28)).padStart(2, "0")}` : null, done: i % 7 === 0 }));
    const open = openTasks(many);
    expect(open).toHaveLength(many.filter((t) => !t.done).length);
    const firstUndated = open.findIndex((t) => !t.dueDate);
    expect(open.slice(firstUndated).every((t) => !t.dueDate)).toBe(true);
  });
});

describe("finished tasks", () => {
  it("run with the latest finished first", () => {
    const a = task({ id: "a", done: true, doneOn: "2026-09-29", dueDate: "2026-09-30" });
    const b = task({ id: "b", done: true, doneOn: "2026-10-10", dueDate: "2026-10-01" });
    const c = task({ id: "c", done: true, doneOn: "2026-10-02", dueDate: "2026-11-01" });
    const open = task({ id: "open" });
    expect(ids(finishedTasks([a, b, c, open]))).toEqual(["b", "c", "a"]);
  });

  it("put tasks finished before the day was kept last, whatever their due date (N8)", () => {
    const old = task({ id: "old", done: true, dueDate: "2026-10-12" });
    const kept = task({ id: "kept", done: true, doneOn: "2026-01-13", dueDate: "2026-10-01" });
    const bare = task({ id: "bare", done: true });
    expect(ids(finishedTasks([bare, old, kept]))).toEqual(["kept", "bare", "old"]);
  });
});

describe("counts and steps", () => {
  it("counts open and done", () => {
    expect(taskCounts([task(), task(), task({ done: true })])).toEqual({ open: 2, done: 1 });
    expect(taskCounts([])).toEqual({ open: 0, done: 0 });
  });

  it("counts the steps that are done", () => {
    expect(stepsDone(task())).toEqual({ done: 0, total: 0, percent: 0 });
    expect(stepsDone(task({ subtasks: [step(true), step(false), step(false), step(false)] }))).toEqual({ done: 1, total: 4, percent: 25 });
    expect(stepsDone(task({ subtasks: [step(true), step(true), step(false)] }))).toEqual({ done: 2, total: 3, percent: 67 });
    const sixty = Array.from({ length: 60 }, (_, i) => step(i < 23));
    expect(stepsDone(task({ subtasks: sixty }))).toEqual({ done: 23, total: 60, percent: 38 });
  });
});

describe("due text", () => {
  it("reads No date, late, today, tomorrow and a short date", () => {
    expect(taskDueText(task({ dueDate: null }), TODAY)).toBe("No date");
    expect(taskDueText(task({ dueDate: "2026-10-12" }), TODAY)).toBe("2 days late");
    expect(taskDueText(task({ dueDate: "2026-10-13" }), TODAY)).toBe("1 day late");
    expect(taskDueText(task({ dueDate: "2026-10-14" }), TODAY)).toBe("Due today");
    expect(taskDueText(task({ dueDate: "2026-10-15" }), TODAY)).toBe("Due tomorrow");
    expect(taskDueText(task({ dueDate: "2026-10-25" }), TODAY)).toBe("Due 25 Oct");
    expect(taskDueText(task({ dueDate: "2027-01-02" }), TODAY)).toBe("Due 2 Jan 2027");
  });

  it("says when a finished task was done", () => {
    expect(taskDueText(task({ done: true, doneOn: "2026-09-29", dueDate: "2026-09-30" }), TODAY)).toBe("Done 29 Sep");
    expect(taskDueText(task({ done: true, dueDate: "2026-09-30" }), TODAY)).toBe("Done");
    expect(taskDueText(task({ done: true, doneOn: null, dueDate: "2026-09-30" }), TODAY)).toBe("Done");
    expect(taskDueText(task({ done: true }), TODAY)).toBe("Done");
  });

  it("is late only while open and past due", () => {
    expect(isTaskLate(task({ dueDate: "2026-10-13" }), TODAY)).toBe(true);
    expect(isTaskLate(task({ dueDate: "2026-10-14" }), TODAY)).toBe(false);
    expect(isTaskLate(task({ dueDate: null }), TODAY)).toBe(false);
    expect(isTaskLate(task({ dueDate: "2026-10-01", done: true }), TODAY)).toBe(false);
  });
});

describe("meta line", () => {
  it("shows the steps done when there are steps", () => {
    expect(taskMeta(task({ subtasks: [step(true), step(false)], notes: "ignored" }))).toEqual({ kind: "steps", done: 1, total: 2, percent: 50 });
  });

  it("shows the start of the notes otherwise", () => {
    expect(taskMeta(task({ notes: "Venue holds 450; aim for 400." }))).toEqual({ kind: "notes", text: "Venue holds 450; aim for 400." });
    const long = "x".repeat(200);
    const meta = taskMeta(task({ notes: long }));
    expect(meta?.kind === "notes" && Array.from(meta.text)).toHaveLength(79);
  });

  it("shows nothing when there are neither", () => {
    expect(taskMeta(task())).toBeNull();
    expect(taskMeta(task({ notes: "   " }))).toBeNull();
  });
});

describe("paging", () => {
  const list = Array.from({ length: 250 }, (_, i) => ({ id: `t${i}` }));

  it("shows one page, or as many as it takes for the task a link names to be on screen", () => {
    expect(shownCount(list, null, 100)).toBe(100);
    expect(shownCount(list, "t5", 100)).toBe(100);
    expect(shownCount(list, "t99", 100)).toBe(100);
    expect(shownCount(list, "t100", 100)).toBe(200);
    expect(shownCount(list, "t249", 100)).toBe(300);
    expect(shownCount(list, "gone", 100)).toBe(100);
  });
});
