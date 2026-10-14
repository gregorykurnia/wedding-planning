/**
 * Tasks (guide §4.27, §5.21; S8, S9).
 *
 * A task is stored as a to-do with `subtasks`; the design calls them steps.
 * Open tasks run by due date with undated ones last. Finished tasks run with
 * the latest finished first.
 */
import type { IsoDate } from "./bookings";
import { dateShort, daysUntil, isIsoDate } from "./dates";
import { cut, plural } from "./format";
import { sortBy } from "./order";

export interface SubtaskRecord {
  id: string;
  title: string;
  notes?: string;
  dueDate: IsoDate | null;
  done: boolean;
}

export interface TaskRecord {
  id: string;
  title: string;
  notes: string;
  dueDate: IsoDate | null;
  done: boolean;
  /** The day it was finished; tasks finished before this was kept don't have one. */
  doneOn?: IsoDate | null;
  subtasks: SubtaskRecord[];
}

const dueOf = (t: Pick<TaskRecord, "dueDate">) => (isIsoDate(t.dueDate) ? t.dueDate : null);

/** Open tasks by due date, undated last; tasks that tie stay in the order they came in. */
export const openTasks = <T extends TaskRecord>(tasks: readonly T[]): T[] =>
  sortBy(
    tasks.filter((t) => !t.done),
    dueOf,
    "asc",
  );

/**
 * Finished tasks, the latest finished first. A task finished before `doneOn`
 * was kept falls back to its due date, and one with neither goes last.
 */
export const finishedTasks = <T extends TaskRecord>(tasks: readonly T[]): T[] =>
  sortBy(
    tasks.filter((t) => t.done),
    (t) => (isIsoDate(t.doneOn) ? t.doneOn : dueOf(t)),
    "desc",
  );

export interface TaskCounts {
  open: number;
  done: number;
}

export const taskCounts = (tasks: readonly TaskRecord[]): TaskCounts => ({
  open: tasks.filter((t) => !t.done).length,
  done: tasks.filter((t) => t.done).length,
});

export interface StepsDone {
  done: number;
  total: number;
  /** Whole percent; 0 when there are no steps. */
  percent: number;
}

export function stepsDone(task: Pick<TaskRecord, "subtasks">): StepsDone {
  const total = task.subtasks.length;
  const done = task.subtasks.filter((s) => s.done).length;
  return { done, total, percent: total ? Math.round((done / total) * 100) : 0 };
}

/** A task is late when it's still open and its due date has passed. */
export const isTaskLate = (task: TaskRecord, today: IsoDate) => {
  const due = dueOf(task);
  return !task.done && due !== null && daysUntil(due, today) < 0;
};

/** The due text on a task row: "No date" · "3 days late" · "Due today" · "Due tomorrow" · "Due 25 Oct" · "Done 29 Sep". */
export function taskDueText(task: TaskRecord, today: IsoDate): string {
  const due = dueOf(task);
  if (task.done) {
    const on = isIsoDate(task.doneOn) ? task.doneOn : due;
    return on ? `Done ${dateShort(on, today)}` : "Done";
  }
  if (!due) return "No date";
  const n = daysUntil(due, today);
  if (n < 0) return `${plural(-n, "day")} late`;
  if (n === 0) return "Due today";
  if (n === 1) return "Due tomorrow";
  return `Due ${dateShort(due, today)}`;
}

export type TaskMeta = ({ kind: "steps" } & StepsDone) | { kind: "notes"; text: string } | null;

/** The line under a task's title: how many steps are done, or else the start of its notes. */
export function taskMeta(task: TaskRecord): TaskMeta {
  const steps = stepsDone(task);
  if (steps.total) return { kind: "steps", ...steps };
  const notes = task.notes.trim();
  return notes ? { kind: "notes", text: cut(notes, 80) } : null;
}
