"use client";

import { useRef, useState } from "react";
import { addTask, newTaskId } from "@/lib/data/tasks";
import type { IsoDate } from "@/lib/model/bookings";
import { isDate } from "@/veil/parts/tasks/task-text";
import { DateInput, FieldInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { Banner } from "@/veil/shell/banner";
import { useFlasher } from "@/veil/shell/flash";
import { CreateSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import {
  ADD_FAILED,
  ADD_SUB,
  ADD_TASK,
  DUE_LABEL,
  NEED_TITLE,
  WHAT_LABEL,
  WHAT_PLACEHOLDER,
  addedToast,
} from "./tasks-text";
import styles from "./tasks-screen.module.css";
import { OfflineOr } from "@/veil/parts/fields/offline-or";

/**
 * "Add a task" (guide §5.21; S8, N9). A new task saves on its button, because
 * there is nothing to save into until it exists. With no title the field is
 * ringed with one line on what to do, and the date chosen stays. The record id is
 * made on the first press and kept until it lands, so Try again after a lost
 * connection writes the same task.
 */
export function AddTaskSheet({ onAdded }: { onAdded: (id: string) => void }) {
  const sheet = useSheet();
  const toast = useToast();
  const flash = useFlasher();

  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [pressed, setPressed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useRef<string | null>(null);
  const what = useRef<HTMLInputElement>(null);

  const missing = pressed && !title.trim();

  async function add() {
    if (adding) return;
    setPressed(true);
    if (!title.trim()) {
      what.current?.focus();
      return;
    }
    setFailed(false);
    setAdding(true);
    id.current ??= newTaskId();
    const taskId = id.current;
    const text = title.trim();
    try {
      await addTask(taskId, { title: text, dueDate: isDate(due) ? (due as IsoDate) : null });
    } catch {
      setAdding(false);
      setFailed(true);
      return;
    }
    toast.confirmation(addedToast(text));
    flash({ kind: "task", id: taskId });
    onAdded(taskId);
    sheet.close();
  }

  return (
    <Sheet title={ADD_TASK}>
      <Fields>
        <FieldRow label={WHAT_LABEL} problem={missing ? NEED_TITLE : undefined}>
          <FieldInput ref={what} value={title} onChange={setTitle} placeholder={WHAT_PLACEHOLDER} autoFocus />
        </FieldRow>
        <FieldRow label={DUE_LABEL}>
          <DateInput value={due} onChange={setDue} />
        </FieldRow>
      </Fields>
      <p className={styles.sheetSub}>{ADD_SUB}</p>
      {failed && (
        <Banner tone="rose" inline role="alert">
          <OfflineOr>{ADD_FAILED}</OfflineOr>
        </Banner>
      )}
      <CreateSheetActions action={failed ? "Try again" : "Add task"} busy={adding} busyLabel="Adding" onAction={() => void add()} />
    </Sheet>
  );
}
