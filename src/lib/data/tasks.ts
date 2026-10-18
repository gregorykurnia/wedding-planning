"use client";

import { useTodos } from "@/lib/collections/todos";
import { addElement, updateElement } from "@/lib/data/array-ops";
import type { IsoDate } from "@/lib/model/bookings";
import type { SubtaskRecord, TaskRecord } from "@/lib/model/tasks";
import type { TodoSubtask } from "@/lib/types";
import { logActivity } from "./activity";
import { readOf } from "./read";
import { useSession } from "./session";
import type { Loaded } from "./settings";
import { removeElementWithUndo, removeWithUndo, updateWithUndo, type Undoable } from "./undo";
import { create, newId, update, type WriteOptions } from "./write";

const COLLECTION = "todos";

/**
 * The Tasks screen's read (guide §5.21): every task with its steps, live, so a
 * step the partner finishes arrives in place. Demonstration mode has none.
 */
export function useTasks(): Loaded<TaskRecord[]> {
  const { connection } = useSession();
  const todos = useTodos();
  return readOf(connection, [todos], todos.data);
}

/** A new task's id, made once per sheet so Try again never adds two. */
export const newTaskId = (opts: WriteOptions = {}) => newId(COLLECTION, opts);

/** A new step's id, made once per press of Add a step. */
export const newStepId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `step-${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Adds a task (S8). It is stored as the old UI stores a to-do, so both UIs show
 * it; `doneOn` is the new field that remembers the day it was finished.
 */
export function addTask(id: string, fields: { title: string; dueDate: IsoDate | null }, opts: WriteOptions = {}): Promise<string> {
  return create(COLLECTION, { title: fields.title, notes: "", dueDate: fields.dueDate, done: false, doneOn: null, subtasks: [] }, { ...opts, id });
}

/** Saves a task's due date or notes (they save as you go). */
export function saveTask(id: string, patch: { dueDate: IsoDate | null } | { notes: string }, opts: WriteOptions = {}): Promise<void> {
  return update(COLLECTION, id, patch, opts);
}

/**
 * Finish or reopen a task (S9). Finishing records today as `doneOn`, and
 * reopening clears it. Undo puts both back, unless the task was changed again
 * since. Finishing tells the partner.
 */
export async function setTaskDone(task: Pick<TaskRecord, "id" | "title">, done: boolean, today: IsoDate, opts: WriteOptions = {}): Promise<Undoable> {
  const result = await updateWithUndo(COLLECTION, task.id, { done, doneOn: done ? today : null }, opts);
  if (done) void logActivity("task.finished", { name: task.title }, { kind: "task", id: task.id }, opts);
  return result;
}

/** Delete task (S9): the task goes with its steps, with an undo that puts it back exactly. */
export function deleteTask(id: string, opts: WriteOptions = {}): Promise<Undoable> {
  return removeWithUndo(COLLECTION, id, opts);
}

// Steps change through transactions on the latest stored array, so a partner's
// edit to another step is never overwritten (src/lib/data/array-ops.ts).
type StoredStep = TodoSubtask & Record<string, unknown>;

/** Adds an empty step at the end. Adding the same id again does nothing, so a retry is safe. */
export function addStep(taskId: string, stepId: string, opts: WriteOptions = {}): Promise<unknown> {
  const step: StoredStep = { id: stepId, title: "", notes: "", dueDate: null, done: false };
  return addElement(COLLECTION, taskId, "subtasks", step, opts);
}

/** Saves one step's title, date or tick, leaving the others as the partner has them. */
export function saveStep(
  taskId: string,
  step: Pick<SubtaskRecord, "id" | "title">,
  patch: Partial<Pick<TodoSubtask, "title" | "dueDate" | "done">>,
  opts: WriteOptions = {},
): Promise<unknown> {
  const saved = updateElement<StoredStep>(COLLECTION, taskId, "subtasks", step.id, patch, opts);
  // Ticking a step tells the partner too: "Bella finished “Tasting at Sendok Emas”".
  if (patch.done === true && step.title.trim()) {
    return saved.then((out) => {
      void logActivity("task.finished", { name: step.title.trim() }, { kind: "task", id: taskId }, opts);
      return out;
    });
  }
  return saved;
}

/** Removes a step, with an undo that puts it back at the same place. */
export function removeStep(taskId: string, stepId: string, opts: WriteOptions = {}): Promise<Undoable> {
  return removeElementWithUndo(COLLECTION, taskId, "subtasks", stepId, opts);
}
