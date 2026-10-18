import { n0, plural } from "@/lib/model/format";
import type { TaskCounts, TaskRecord } from "@/lib/model/tasks";

/** The words of the Tasks screen and its add sheet (guide §5.21, §6.1, §6.2), pure so the tests read them. */

/** "5 open, 2 done"; before any task, what the screen is for. */
export function tasksSub(counts: TaskCounts): string {
  if (counts.open + counts.done === 0) return "Big jobs, broken into steps";
  return `${n0(counts.open)} open${counts.done ? `, ${n0(counts.done)} done` : ""}`;
}

export const OPEN_HEADING = "Open";
export const OPEN_NOTE = "by due date, undated last";

export const NO_TASKS = {
  title: "No tasks yet",
  body: "Add the big jobs, like choosing the caterer, and break them into steps with their own dates. Tasks with a due date also show in the agenda.",
};

export const ALL_DONE = {
  title: "Everything’s done",
  body: "Finished tasks are kept below in case you need one back.",
};

export const ADD_TASK = "Add a task";

// ---------- the add sheet ----------

export const WHAT_LABEL = "What needs doing";
export const WHAT_PLACEHOLDER = "For example, Choose the caterer";
export const DUE_LABEL = "Due date";
export const ADD_SUB = "Break it into steps once it’s added.";
/** N9: adding without a title. */
export const NEED_TITLE = "Say what needs doing, so you can find the task later.";
export const ADD_FAILED = "The task wasn’t added. What you typed is still here.";
export const addedToast = (title: string) => `Added ${title}`;

// ---------- changes ----------

export const finishedToast = (title: string) => `Finished ${title}`;
export const reopenedToast = (title: string) => `Reopened ${title}`;
export const REMOVED_STEP_TOAST = "Removed a step";
export const deletedToast = (title: string) => `Deleted ${title}`;

const stepsGo = (n: number) => (n === 0 ? "" : n === 1 ? "Its 1 step goes with it. " : `Its ${plural(n, "step")} go with it. `);

export const deleteConfirm = (task: Pick<TaskRecord, "title" | "subtasks">) => ({
  title: `Delete ${task.title}?`,
  body: `${stepsGo(task.subtasks.length)}You can undo for a few seconds.`,
  action: "Delete task",
});

/** Provisional (G29/N29): the design words no failure for a tick or an added step. */
export const finishFailed = (title: string, done: boolean) =>
  `Couldn’t ${done ? "finish" : "reopen"} “${title}”. Nothing was changed.`;
export const STEP_ADD_FAILED = "Couldn’t add the step. Nothing was changed.";
