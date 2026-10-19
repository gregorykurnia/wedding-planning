"use client";

import { useEffect, useRef, type MouseEvent } from "react";
import type { IsoDate } from "@/lib/model/bookings";
import { FIELD_FAILED } from "@/lib/model/save-state";
import type { SubtaskRecord, TaskRecord } from "@/lib/model/tasks";
import { Chevron } from "@/veil/icons/chevron";
import { TextLink } from "@/veil/parts/actions/text-link";
import { DateInput, FieldRow, Fields } from "@/veil/parts/fields/fields";
import { useDraft } from "@/veil/parts/use-draft";
import { useFlash } from "@/veil/shell/flash";
import {
  STEP_FAILED,
  isDate,
  isTaskLate,
  stepsLine,
  taskDueText,
  taskMeta,
  threadLabel,
  tickLabel,
} from "./task-text";
import styles from "./tasks.module.css";

const NONE: ReadonlySet<never> = new Set();

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

/** What a task row can ask its screen to do. Each is a write; leave one out and that control does nothing. */
export interface TaskActions {
  onFinish?: (task: TaskRecord, done: boolean) => void;
  onStepDone?: (task: TaskRecord, step: SubtaskRecord, done: boolean) => void;
  onStepTitle?: (task: TaskRecord, step: SubtaskRecord, title: string) => void;
  onStepDue?: (task: TaskRecord, step: SubtaskRecord, due: IsoDate | null) => void;
  onRemoveStep?: (task: TaskRecord, step: SubtaskRecord) => void;
  onAddStep?: (task: TaskRecord) => void;
  onDue?: (task: TaskRecord, due: IsoDate | null) => void;
  onNotes?: (task: TaskRecord, notes: string) => void;
  onDelete?: (task: TaskRecord) => void;
  onRetryStep?: (task: TaskRecord, step: SubtaskRecord) => void;
  /** Try again for a due date or notes that didn't save. */
  onRetryField?: (task: TaskRecord, field: TaskField) => void;
}

/** The task's own fields that save as you go. */
export type TaskField = "due" | "notes";

/** A date saves once it is whole, or on leaving the field; an empty one clears the date. */
const dateValue = (text: string): IsoDate | null => (isDate(text) ? text : null);

interface StepRowProps {
  task: TaskRecord;
  step: SubtaskRecord;
  actions: TaskActions;
  failed: boolean;
  /** Put the cursor in this step's title (a step was just added). */
  focus: boolean;
  /** Called once the cursor is in it, so the screen can let the request go. */
  onFocused?: (stepId: string) => void;
  disabled: boolean;
}

/** One step: a 24px check, a title, a date and a 32px ×. A change that didn't save keeps what was typed. */
function StepRow({ task, step, actions, failed, focus, onFocused, disabled }: StepRowProps) {
  const [title, setTitle] = useDraft(step.title);
  const [due, setDue] = useDraft(step.dueDate ?? "");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!focus) return;
    input.current?.focus();
    onFocused?.(step.id);
  }, [focus, onFocused, step.id]);

  const commitTitle = (text: string) => {
    if (text !== step.title) actions.onStepTitle?.(task, step, text);
  };
  const commitDue = (text: string) => {
    const next = text === "" ? null : dateValue(text);
    if (next !== step.dueDate && (text === "" || next)) actions.onStepDue?.(task, step, next);
  };

  return (
    <li className={join(styles.step, step.done && styles.stepDone, failed && styles.stepFailed)} data-step-id={step.id}>
      <input
        type="checkbox"
        className={styles.sbox}
        checked={step.done}
        disabled={disabled}
        aria-label={step.title ? `Step done: ${step.title}` : "Step done"}
        onChange={(event) => actions.onStepDone?.(task, step, event.target.checked)}
      />
      <input
        ref={input}
        type="text"
        className={styles.stepTitle}
        dir="auto"
        value={title}
        disabled={disabled}
        aria-label="Step"
        aria-invalid={failed || undefined}
        onChange={(event) => setTitle(event.target.value)}
        onBlur={(event) => commitTitle(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") commitTitle(event.currentTarget.value);
        }}
      />
      <input
        type="date"
        className={styles.stepDate}
        value={due}
        disabled={disabled}
        aria-label="Step due date"
        onChange={(event) => {
          setDue(event.target.value);
          if (isDate(event.target.value)) commitDue(event.target.value);
        }}
        onBlur={(event) => commitDue(event.currentTarget.value)}
      />
      <button
        type="button"
        className={styles.x}
        aria-label="Remove step"
        title="Remove step"
        disabled={disabled}
        onClick={() => actions.onRemoveStep?.(task, step)}
      >
        ×
      </button>
      {failed ? (
        <p className={styles.rowErr} role="alert">
          <span>{STEP_FAILED}</span>
          <TextLink tone="rose" onClick={() => actions.onRetryStep?.(task, step)}>
            Try again
          </TextLink>
        </p>
      ) : null}
    </li>
  );
}

export interface TaskRowProps {
  task: TaskRecord;
  /** Today as `YYYY-MM-DD`; late is worked out against it, never stored. */
  today: IsoDate;
  actions: TaskActions;
  /** Open when the screen first draws it; after that the reader opens and closes it. */
  defaultOpen?: boolean;
  onToggle?: (open: boolean) => void;
  /** The steps with a change that didn't save (any of title, tick, date or removal). */
  failedStepIds?: ReadonlySet<string>;
  /** The step to put the cursor in (one just added). */
  focusStepId?: string | null;
  /** Told when that step has the cursor, so the request can be let go. */
  onFocusedStep?: (stepId: string) => void;
  /** Due date and notes changes that didn't save: each is ringed and keeps what was typed. */
  failedFields?: ReadonlySet<TaskField>;
  /** Demonstration mode: every control is inert. */
  demo?: boolean;
}

/**
 * One task (guide §4.27): a native disclosure. The summary has a 24px tick box
 * (a `checkbox` that finishes or reopens the task), the title, the due text
 * and a chevron, and under them how many steps are done, or the start of the
 * notes. Open, it holds the steps, "Add a step", the due date, the notes and
 * "Delete task". Render rows inside a `ul`.
 */
export function TaskRow({
  task,
  today,
  actions,
  defaultOpen = false,
  onToggle,
  failedStepIds = NONE,
  focusStepId = null,
  onFocusedStep,
  failedFields = NONE,
  demo = false,
}: TaskRowProps) {
  const flash = useFlash({ kind: "task", id: task.id });
  const [notes, setNotes] = useDraft(task.notes);
  const [due, setDue] = useDraft(task.dueDate ?? "");
  const meta = taskMeta(task);
  const late = isTaskLate(task, today);

  const tick = (event: MouseEvent) => {
    // The tick lives inside the summary: it finishes the task and leaves the disclosure as it was.
    event.preventDefault();
    if (!demo) actions.onFinish?.(task, !task.done);
  };
  const commitDue = (text: string) => {
    const next = text === "" ? null : dateValue(text);
    if (next !== task.dueDate && (text === "" || next)) actions.onDue?.(task, next);
  };

  return (
    <li className={styles.item}>
      <details
        className={join(styles.tk, task.done && styles.done, flash)}
        data-task-id={task.id}
        open={defaultOpen}
        onToggle={(event) => onToggle?.(event.currentTarget.open)}
      >
        <summary>
          <button
            type="button"
            role="checkbox"
            aria-checked={task.done}
            aria-label={tickLabel(task)}
            aria-disabled={demo || undefined}
            className={styles.tickBox}
            onClick={tick}
          />
          <span className={styles.tt} dir="auto">
            {task.title}
          </span>
          <span className={join(styles.td, late && styles.late)}>{taskDueText(task, today)}</span>
          <span className={styles.chev}>
            <Chevron />
          </span>
          {meta ? (
            <span className={styles.tm} dir="auto">
              {meta.kind === "steps" ? stepsLine(meta) : meta.text}
              {meta.kind === "steps" ? (
                <span className={styles.thread} role="img" aria-label={threadLabel(meta)}>
                  <span className={styles.threadDone} style={{ width: `${meta.percent}%` }} />
                </span>
              ) : null}
            </span>
          ) : null}
        </summary>
        <div className={styles.inner}>
          <ul className={styles.steps} aria-label={`Steps of ${task.title}`}>
            {task.subtasks.map((step) => (
              <StepRow
                key={step.id}
                task={task}
                step={step}
                actions={actions}
                failed={failedStepIds.has(step.id)}
                focus={focusStepId === step.id}
                onFocused={onFocusedStep}
                disabled={demo}
              />
            ))}
          </ul>
          <p className={styles.addStep}>
            <TextLink onClick={() => !demo && actions.onAddStep?.(task)}>Add a step</TextLink>
          </p>
          <Fields className={styles.dueFields}>
            <FieldRow
              label="Due date"
              field={failedFields.has("due") ? { failed: true, retry: () => actions.onRetryField?.(task, "due"), disabled: demo } : undefined}
            >
              <DateInput
                value={due}
                disabled={demo}
                onChange={setDue}
                onCommit={commitDue}
              />
            </FieldRow>
          </Fields>
          <label className="sr" htmlFor={`${task.id}-notes`}>
            Notes
          </label>
          <textarea
            id={`${task.id}-notes`}
            className={join(styles.notes, failedFields.has("notes") && styles.notesFailed)}
            aria-invalid={failedFields.has("notes") || undefined}
            dir="auto"
            placeholder="Notes"
            value={notes}
            disabled={demo}
            onChange={(event) => setNotes(event.target.value)}
            onBlur={(event) => event.currentTarget.value !== task.notes && actions.onNotes?.(task, event.currentTarget.value)}
          />
          {failedFields.has("notes") ? (
            <p className={styles.rowErr} role="alert">
              <span>{FIELD_FAILED}</span>
              <TextLink tone="rose" onClick={() => actions.onRetryField?.(task, "notes")}>
                Try again
              </TextLink>
            </p>
          ) : null}
          <div className={styles.tacts}>
            <TextLink tone="rose" onClick={() => !demo && actions.onDelete?.(task)}>
              Delete task
            </TextLink>
          </div>
        </div>
      </details>
    </li>
  );
}
