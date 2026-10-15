import type { IsoDate } from "@/lib/model/bookings";
import { plural } from "@/lib/model/format";
import { isTaskLate, taskDueText, taskMeta, type StepsDone, type TaskRecord } from "@/lib/model/tasks";

/**
 * The words of a task row (guide §4.27), ported from the prototype's tasks.html.
 * The model has the due text and the line under the title; this adds the
 * tick's label, the steps line, the thread's label and the failed-step line.
 */

export { isTaskLate, taskDueText, taskMeta };

/** "Finish Choose the caterer" on an open task, "Reopen …" on a finished one. */
export const tickLabel = (task: Pick<TaskRecord, "title" | "done">) => `${task.done ? "Reopen" : "Finish"} ${task.title}`;

/** "2 of 5 steps done". */
export const stepsLine = (steps: Pick<StepsDone, "done" | "total">) => `${steps.done} of ${plural(steps.total, "step")} done`;

/** The small thread's label: "40% of steps done". */
export const threadLabel = (steps: Pick<StepsDone, "percent">) => `${steps.percent}% of steps done`;

export const STEP_FAILED = "Couldn’t save this step. What you typed is kept.";

/** "Show 4 finished tasks" · "Hide 4 finished tasks". */
export const finishedLabel = (count: number, open: boolean) => `${open ? "Hide" : "Show"} ${plural(count, "finished task")}`;

export const isDate = (value: string): value is IsoDate => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number(value.slice(0, 4)) >= 1000;
