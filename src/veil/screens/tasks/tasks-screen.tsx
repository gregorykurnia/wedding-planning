"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useSession } from "@/lib/data/session";
import {
  addStep,
  deleteTask,
  newStepId,
  removeStep,
  saveStep,
  saveTask,
  setTaskDone,
  useTasks,
} from "@/lib/data/tasks";
import { useToday } from "@/lib/data/use-today";
import { finishedTasks, openTasks, shownCount, taskCounts, type TaskRecord } from "@/lib/model/tasks";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { Hero } from "@/veil/parts/hero/hero";
import { Message } from "@/veil/parts/message/message";
import { FinishedTasks } from "@/veil/parts/tasks/finished-tasks";
import { TaskRow, type TaskActions, type TaskField } from "@/veil/parts/tasks/task-row";
import { CountLine, ShowMore } from "@/veil/parts/tools/results";
import { showingOfText } from "@/veil/parts/tools/tools-text";
import { AddButton } from "@/veil/shell/add-button";
import { Banner } from "@/veil/shell/banner";
import { useConfirm } from "@/veil/shell/confirm";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useSheets } from "@/veil/shell/sheet";
import { SubNav } from "@/veil/shell/sub-nav";
import { useToast } from "@/veil/shell/toasts";
import { AddTaskSheet } from "./add-task-sheet";
import styles from "./tasks-screen.module.css";
import {
  ADD_TASK,
  ALL_DONE,
  NO_TASKS,
  OPEN_HEADING,
  OPEN_NOTE,
  REMOVED_STEP_TOAST,
  STEP_ADD_FAILED,
  deleteConfirm,
  deletedToast,
  finishFailed,
  finishedToast,
  reopenedToast,
  tasksSub,
} from "./tasks-text";

/** Tasks shown at a time, open and finished each (guide §5.21). */
const PAGE = 100;

/** A change that didn't land, and how to run it again. */
interface Failure {
  /** A step's, a task field's, or a note above the list. */
  kind: "step" | "field" | "notice";
  taskId: string;
  /** The step's id and which of its writes (`<step>:title`), the field's name, or the notice's words. */
  what: string;
  retry: () => void;
}

/** The writes a step makes. Each fails, and is retried, on its own: a later tick doesn't clear a failed title. */
type StepWrite = "title" | "done" | "due" | "remove";

const keyOf = (f: Pick<Failure, "kind" | "taskId" | "what">) => `${f.kind}:${f.taskId}:${f.what}`;
const stepWhat = (stepId: string, write: StepWrite) => `${stepId}:${write}`;
const stepOf = (f: Failure) => f.what.slice(0, f.what.lastIndexOf(":"));

/**
 * Tasks (guide §5.21; S8, S9): open tasks by due date with undated last, then
 * the finished ones in a disclosure. Everything saves as you go; a step that
 * didn't save keeps what was typed and offers Try again. `?open=` (from the
 * agenda) opens that task.
 */
export function TasksScreen() {
  const read = useTasks();
  return (
    <PageColumn width="wide">
      <ScreenState read={read} what="your tasks" onRetry={() => window.location.reload()}>
        {(data) => <Tasks tasks={data ?? []} />}
      </ScreenState>
    </PageColumn>
  );
}

function Tasks({ tasks }: { tasks: TaskRecord[] }) {
  const today = useToday();
  const sheets = useSheets();
  const toast = useToast();
  const confirm = useConfirm();
  const demo = useSession().connection === "demo";

  const openParam = useSearchParams().get("open");
  const [opened, setOpened] = useState<ReadonlySet<string>>(() => new Set(openParam ? [openParam] : []));
  const [shown, setShown] = useState(() => ({
    open: shownCount(openTasks(tasks), openParam, PAGE),
    done: shownCount(finishedTasks(tasks), openParam, PAGE),
  }));
  const [failures, setFailures] = useState<ReadonlyMap<string, Failure>>(new Map());
  const [focusStep, setFocusStep] = useState<string | null>(null);
  // A new step takes the cursor once; it is let go then, so an Undo bringing the step back doesn't take it again.
  const focused = useCallback((id: string) => setFocusStep((f) => (f === id ? null : f)), []);

  // A link from the agenda to another task while this screen is already showing.
  const [seenParam, setSeenParam] = useState(openParam);
  if (openParam !== seenParam) {
    setSeenParam(openParam);
    if (openParam) setOpened((set) => new Set(set).add(openParam));
  }

  const open = useMemo(() => openTasks(tasks), [tasks]);
  const done = useMemo(() => finishedTasks(tasks), [tasks]);
  const counts = taskCounts(tasks);
  const openOne = (id: string) => setOpened((set) => new Set(set).add(id));

  /** Runs a write; a failure is kept (replacing an earlier one for the same thing) until a retry lands. */
  function attempt(about: Omit<Failure, "retry">, write: () => Promise<void>) {
    const key = keyOf(about);
    const clear = () =>
      setFailures((map) => {
        if (!map.has(key)) return map;
        const next = new Map(map);
        next.delete(key);
        return next;
      });
    const run = async () => {
      try {
        await write();
        clear();
      } catch {
        setFailures((map) => new Map(map).set(key, { ...about, retry: () => void run() }));
      }
    };
    void run();
  }

  async function remove(task: TaskRecord) {
    let undo: (() => Promise<void>) | undefined;
    const gone = await confirm({
      ...deleteConfirm(task),
      danger: true,
      run: async () => {
        undo = (await deleteTask(task.id)).undo;
      },
    });
    if (gone && undo) toast.undoable(deletedToast(task.title), undo);
  }

  const actions: TaskActions = {
    onFinish: (task, finish) =>
      attempt({ kind: "notice", taskId: task.id, what: finishFailed(task.title, finish) }, async () => {
        const { undo } = await setTaskDone(task, finish, today);
        toast.undoable(finish ? finishedToast(task.title) : reopenedToast(task.title), undo);
      }),
    onStepDone: (task, step, tick) =>
      attempt({ kind: "step", taskId: task.id, what: stepWhat(step.id, "done") }, async () => void (await saveStep(task.id, step, { done: tick }))),
    onStepTitle: (task, step, title) =>
      attempt({ kind: "step", taskId: task.id, what: stepWhat(step.id, "title") }, async () => void (await saveStep(task.id, step, { title }))),
    onStepDue: (task, step, due) =>
      attempt({ kind: "step", taskId: task.id, what: stepWhat(step.id, "due") }, async () => void (await saveStep(task.id, step, { dueDate: due }))),
    onRemoveStep: (task, step) =>
      attempt({ kind: "step", taskId: task.id, what: stepWhat(step.id, "remove") }, async () => {
        const { undo } = await removeStep(task.id, step.id);
        toast.undoable(REMOVED_STEP_TOAST, undo);
      }),
    onAddStep: (task) => {
      const id = newStepId();
      setFocusStep(id);
      attempt({ kind: "notice", taskId: task.id, what: STEP_ADD_FAILED }, async () => {
        try {
          await addStep(task.id, id);
        } catch (error) {
          setFocusStep(null);
          throw error;
        }
      });
    },
    onDue: (task, due) => attempt({ kind: "field", taskId: task.id, what: "due" }, () => saveTask(task.id, { dueDate: due })),
    onNotes: (task, notes) => attempt({ kind: "field", taskId: task.id, what: "notes" }, () => saveTask(task.id, { notes })),
    onDelete: (task) => void remove(task),
    // Every write of the step that didn't save runs again.
    onRetryStep: (task, step) => stepFailures(task, step.id).forEach((f) => f.retry()),
    onRetryField: (task, field) => failures.get(keyOf({ kind: "field", taskId: task.id, what: field }))?.retry(),
  };

  function stepFailures(task: TaskRecord, stepId?: string) {
    return [...failures.values()].filter((f) => f.kind === "step" && f.taskId === task.id && (stepId === undefined || stepOf(f) === stepId));
  }
  const failedSteps = (task: TaskRecord): ReadonlySet<string> => new Set(stepFailures(task).map(stepOf));
  const failedFields = (task: TaskRecord): ReadonlySet<TaskField> =>
    new Set((["due", "notes"] as const).filter((f) => failures.has(keyOf({ kind: "field", taskId: task.id, what: f }))));

  const row = (task: TaskRecord) => (
    <TaskRow
      key={task.id}
      task={task}
      today={today}
      actions={actions}
      defaultOpen={opened.has(task.id)}
      onToggle={(isOpen) =>
        setOpened((set) => {
          if (set.has(task.id) === isOpen) return set;
          const next = new Set(set);
          if (isOpen) next.add(task.id);
          else next.delete(task.id);
          return next;
        })
      }
      failedStepIds={failedSteps(task)}
      focusStepId={focusStep}
      onFocusedStep={focused}
      failedFields={failedFields(task)}
      demo={demo}
    />
  );

  const openAdd = () => sheets.open(<AddTaskSheet onAdded={openOne} />);
  const hero = <Hero title="Tasks" sub={tasksSub(counts)} nav={<SubNav set="schedule" current="/schedule/tasks" />} />;

  if (tasks.length === 0) {
    return (
      <>
        {hero}
        <Message kind="nothing-yet" inline title={NO_TASKS.title} actions={<Btn onClick={openAdd}>{ADD_TASK}</Btn>}>
          {NO_TASKS.body}
        </Message>
      </>
    );
  }

  const notices = [...failures.values()].filter((f) => f.kind === "notice");
  const paging = (list: readonly TaskRecord[], which: "open" | "done") =>
    list.length > shown[which] ? (
      <div className={styles.paging}>
        <CountLine>{showingOfText(shown[which], list.length)}</CountLine>
        <ShowMore
          more={Math.min(PAGE, list.length - shown[which])}
          onMore={() => setShown((s) => ({ ...s, [which]: s[which] + PAGE }))}
        />
      </div>
    ) : null;

  return (
    <>
      {hero}
      {notices.map((f) => (
        <div key={keyOf(f)} className={styles.notice}>
          <Banner tone="rose" inline role="alert">
            {f.what}{" "}
            <TextLink tone="rose" onClick={f.retry}>
              Try again
            </TextLink>
          </Banner>
        </div>
      ))}
      {open.length ? (
        <>
          <h2 className={styles.section}>
            {OPEN_HEADING} <small>{OPEN_NOTE}</small>
          </h2>
          <ul className={styles.list}>{open.slice(0, shown.open).map(row)}</ul>
          {paging(open, "open")}
        </>
      ) : (
        <Message kind="nothing-yet" inline title={ALL_DONE.title}>
          {ALL_DONE.body}
        </Message>
      )}
      <FinishedTasks count={done.length} defaultOpen={Boolean(openParam && done.some((t) => t.id === openParam))}>
        <ul className={styles.list}>{done.slice(0, shown.done).map(row)}</ul>
        {paging(done, "done")}
      </FinishedTasks>
      <AddButton onPress={openAdd}>{ADD_TASK}</AddButton>
    </>
  );
}
