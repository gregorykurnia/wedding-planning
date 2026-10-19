"use client";

import { useState } from "react";
import { headcounts, sides, type GuestRecord } from "@/lib/model/guests";
import type { ItemRecord } from "@/lib/model/items";
import { peopleNames, withEvent, withPerson, workOnNext } from "@/lib/model/items";
import type { ItemEvent, ItemPerson, Rsvp } from "@/lib/model/labels";
import { finishedTasks, openTasks, type SubtaskRecord, type TaskRecord } from "@/lib/model/tasks";
import { CountCards, HeadcountsCard, SidesCard } from "@/veil/parts/guests/counts";
import { GuestRow } from "@/veil/parts/guests/guest-row";
import { rsvpToast } from "@/veil/parts/guests/guest-text";
import { ItemList } from "@/veil/parts/items/item-list";
import type { ItemActions } from "@/veil/parts/items/item-row";
import type { ItemField } from "@/veil/parts/items/item-text";
import { WorkOnNextCard } from "@/veil/parts/items/work-on-next-card";
import { FinishedTasks } from "@/veil/parts/tasks/finished-tasks";
import { TaskRow, type TaskActions } from "@/veil/parts/tasks/task-row";

/**
 * Task 3.12's gallery section: task, item and guest rows, drawn from fixed fake
 * data held in the page. Nothing is saved anywhere. "Today" is 14 October 2026.
 * The switches force a change to fail so the failed look and Try again can be
 * seen: a failing change doesn't land, keeps what was typed and says so.
 */

const TODAY = "2026-10-14";

const step = (id: string, title: string, done = false, dueDate: string | null = null): SubtaskRecord => ({ id, title, done, dueDate });

const TASKS: TaskRecord[] = [
  {
    id: "t1",
    title: "Book the honeymoon flights",
    notes: "",
    dueDate: "2026-10-25",
    done: false,
    subtasks: [
      step("s1", "Pick the dates", true),
      step("s2", "Check the passports", true, "2026-10-18"),
      step("s3", "Buy the tickets"),
    ],
  },
  { id: "t2", title: "Send the save-the-dates", notes: "Ask Bella for the final list first.", dueDate: "2026-10-12", done: false, subtasks: [] },
  { id: "t3", title: "Choose the 王小明 family’s seating plan", notes: "", dueDate: null, done: false, subtasks: [] },
  { id: "t4", title: "Order the rings", notes: "", dueDate: "2026-09-29", doneOn: "2026-09-29", done: true, subtasks: [] },
];

const item = (over: Partial<ItemRecord> & Pick<ItemRecord, "id" | "item" | "sortOrder">): ItemRecord => ({
  vendor: "",
  confirmed: false,
  types: [],
  persons: ["General"],
  next: false,
  ...over,
});

const ITEMS: ItemRecord[] = [
  item({ id: "i1", item: "Wedding cake", sortOrder: 1, vendor: "Manis Bakery", types: ["Reception"], next: true }),
  item({ id: "i2", item: "Bride’s gown", sortOrder: 2, vendor: "Butik Cantik", types: ["Matrimony", "Reception"], persons: ["Bride"], confirmed: true }),
  item({ id: "i3", item: "Groom’s father’s suit", sortOrder: 3, types: ["Matrimony"], persons: ["Groom Dad"] }),
  item({ id: "i4", item: "Make-up artist for the groom and bride’s mothers, with a very long name to see it wrap", sortOrder: 4, types: ["Sangjit"], persons: ["Groom Mom", "Bride Mom"] }),
  item({ id: "i5", item: "Photo booth", sortOrder: 5, vendor: "Bespoke Tailor Bali", types: ["Reception", "Pre-Wedding"], next: true }),
  item({ id: "i6", item: "Ring bearer’s pillow", sortOrder: 6 }),
];

const guest = (over: Partial<GuestRecord> & Pick<GuestRecord, "id" | "name" | "number">): GuestRecord => ({
  connection: "",
  country: "Indonesia",
  allergies: "",
  rsvpStatus: "pending",
  eventType: "Both",
  inviteSent: true,
  plusOnes: 0,
  ...over,
});

const GUESTS: GuestRecord[] = [
  guest({ id: "g1", number: 1, name: "Hendra Santoso", connection: "Groom’s uncle", rsvpStatus: "yes", plusOnes: 1 }),
  guest({ id: "g2", number: 2, name: "Tante Lily", connection: "Bride’s aunt", rsvpStatus: "pending", allergies: "Vegetarian" }),
  guest({ id: "g3", number: 3, name: "Pak Joko Susilo", connection: "Groom’s business client", rsvpStatus: "no", plusOnes: 2, eventType: "Reception" }),
  guest({ id: "g4", number: 12, name: "王小明", country: "Singapore", rsvpStatus: "pending", inviteSent: false, eventType: "Reception Shortlist", allergies: "Allergic to peanuts and shellfish; the children eat halal food only, and Grandma needs a soft meal without any spice or strong flavours at all" }),
];

const dropKey = <T,>(map: ReadonlyMap<string, T>, key: string) => {
  if (!map.has(key)) return map;
  const next = new Map(map);
  next.delete(key);
  return next;
};

const replace = <T extends { id: string }>(list: T[], id: string, change: Partial<T>) =>
  list.map((x) => (x.id === id ? { ...x, ...change } : x));

export function RowsDemos() {
  const [log, setLog] = useState("Nothing changed yet.");
  const [failing, setFailing] = useState(false);
  const [tasks, setTasks] = useState(TASKS);
  const [items, setItems] = useState(ITEMS);
  const [guests, setGuests] = useState(GUESTS);
  const [sorted, setSorted] = useState(false);
  const [demo, setDemo] = useState(false);
  // Failures by what they were in, so several show at once and each clears only when its own retry lands.
  const [failedSteps, setFailedSteps] = useState<ReadonlyMap<string, { task: string; step: string; retry: () => void }>>(new Map());
  const [failedItems, setFailedItems] = useState<ReadonlyMap<string, { id: string; field: ItemField; retry: () => void }>>(new Map());
  const [failedGuests, setFailedGuests] = useState<ReadonlyMap<string, () => void>>(new Map());
  const [focusStep, setFocusStep] = useState<string | null>(null);
  const [counter, setCounter] = useState(0);

  const say = (text: string) => setLog(text);

  const taskActions: TaskActions = {
    onFinish: (task, done) => {
      setTasks((list) => replace(list, task.id, { done, doneOn: done ? TODAY : null }));
      say(`${done ? "Finished" : "Reopened"} ${task.title}`);
    },
    onStepDone: (task, s, done) => {
      setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, subtasks: replace(t.subtasks, s.id, { done }) } : t)));
      say(`Step ${done ? "done" : "reopened"}: ${s.title}`);
    },
    onStepTitle: (task, s, title) => {
      const apply = () => {
        setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, subtasks: replace(t.subtasks, s.id, { title }) } : t)));
        setFailedSteps((map) => dropKey(map, `${task.id}:${s.id}`));
        say(`Saved the step “${title}”`);
      };
      if (failing) {
        setFailedSteps((map) => new Map(map).set(`${task.id}:${s.id}`, { task: task.id, step: s.id, retry: apply }));
        say("A step didn’t save");
      } else apply();
    },
    onStepDue: (task, s, dueDate) => {
      setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, subtasks: replace(t.subtasks, s.id, { dueDate }) } : t)));
      say(`Step date: ${dueDate ?? "none"}`);
    },
    onRemoveStep: (task, s) => {
      setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, subtasks: t.subtasks.filter((x) => x.id !== s.id) } : t)));
      say(`Removed the step ${s.title}`);
    },
    onAddStep: (task) => {
      const id = `s-new-${counter}`;
      setCounter((n) => n + 1);
      setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, subtasks: [...t.subtasks, step(id, "")] } : t)));
      setFocusStep(id);
      say("Added a step");
    },
    onDue: (task, dueDate) => {
      setTasks((list) => replace(list, task.id, { dueDate }));
      say(`Due date: ${dueDate ?? "none"}`);
    },
    onNotes: (task, notes) => {
      setTasks((list) => replace(list, task.id, { notes }));
      say(`Saved the notes of ${task.title}`);
    },
    onDelete: (task) => {
      setTasks((list) => list.filter((t) => t.id !== task.id));
      say(`Deleted ${task.title}`);
    },
    onRetryStep: (task, s) => failedSteps.get(`${task.id}:${s.id}`)?.retry(),
  };

  const changeItem = (target: ItemRecord, change: Partial<ItemRecord>, message: string, field: ItemField) => {
    const apply = () => {
      setItems((list) => replace(list, target.id, change));
      setFailedItems((map) => dropKey(map, `${target.id}:${field}`));
      say(message);
    };
    if (failing) {
      // A one-tap choice is kept and shown, as the screen would; a typed field keeps its own text.
      if (field !== "name" && field !== "vendor") setItems((list) => replace(list, target.id, change));
      setFailedItems((map) => new Map(map).set(`${target.id}:${field}`, { id: target.id, field, retry: apply }));
      say(`“${target.item}” didn’t save`);
    } else apply();
  };

  const itemActions: ItemActions = {
    onName: (i, name) => changeItem(i, { item: name }, `Renamed to ${name}`, "name"),
    onVendor: (i, vendor) => changeItem(i, { vendor }, `Vendor for ${i.item}: ${vendor || "none"}`, "vendor"),
    onToggleEvent: (i, event: ItemEvent) =>
      changeItem(i, { types: withEvent(i.types, event, !i.types.includes(event)) }, `Toggled ${event} on ${i.item}`, "events"),
    onPerson: (i, person: ItemPerson, on) => changeItem(i, { persons: withPerson(i.persons, person, on) }, `${i.item} is for ${peopleNames(withPerson(i.persons, person, on))}`, "person"),
    onMark: (i, next) => changeItem(i, { next }, `${i.item}: work on next ${next ? "on" : "off"}`, "next"),
    onConfirmed: (i, confirmed) => changeItem(i, { confirmed }, `${i.item}: ${confirmed ? "confirmed" : "not confirmed"}`, "confirmed"),
    onMenu: (i, action) => {
      if (action === "remove") {
        setItems((list) => list.filter((x) => x.id !== i.id));
        say(`Removed ${i.item}`);
      } else if (action === "up" || action === "down") {
        const ordered = [...items].sort((a, z) => a.sortOrder - z.sortOrder);
        const at = ordered.findIndex((x) => x.id === i.id);
        const to = at + (action === "up" ? -1 : 1);
        if (to >= 0 && to < ordered.length) {
          ordered.splice(to, 0, ordered.splice(at, 1)[0]);
          setItems(ordered.map((x, n) => ({ ...x, sortOrder: n + 1 })));
          say(`Moved ${i.item} ${action}`);
        }
      } else say(`Menu: ${action} for ${i.item}`);
    },
    onRetry: (i) => [...failedItems.values()].filter((f) => f.id === i.id).forEach((f) => f.retry()),
  };

  const shownItems = sorted
    ? [...items].sort((a, z) => a.item.localeCompare(z.item))
    : [...items].sort((a, z) => a.sortOrder - z.sortOrder);

  const onRsvp = (g: GuestRecord, next: Rsvp) => {
    const apply = () => {
      setGuests((list) => replace(list, g.id, { rsvpStatus: next }));
      setFailedGuests((map) => dropKey(map, g.id));
      say(rsvpToast(g.name, next));
    };
    if (failing) {
      // The choice is kept and shown, as the screen would; the write is what failed.
      setGuests((list) => replace(list, g.id, { rsvpStatus: next }));
      setFailedGuests((map) => new Map(map).set(g.id, apply));
      say(`The reply for ${g.name} didn’t save`);
    } else apply();
  };

  const failedByItem = new Map<string, Set<ItemField>>();
  for (const f of failedItems.values()) failedByItem.set(f.id, (failedByItem.get(f.id) ?? new Set()).add(f.field));

  const open = openTasks(tasks);
  const done = finishedTasks(tasks);
  const next = workOnNext(items);

  return (
    <div>
      <p role="status">{log}</p>
      <p>
        <label>
          <input type="checkbox" checked={failing} onChange={(event) => setFailing(event.target.checked)} /> Make saves fail
        </label>{" "}
        <label>
          <input type="checkbox" checked={sorted} onChange={(event) => setSorted(event.target.checked)} /> A sort is on
        </label>{" "}
        <label>
          <input type="checkbox" checked={demo} onChange={(event) => setDemo(event.target.checked)} /> Demonstration mode
        </label>
      </p>

      <h3>Task rows</h3>
      <ul aria-label="Open tasks" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {open.map((task) => (
          <TaskRow
            key={task.id}
            task={task}
            today={TODAY}
            actions={taskActions}
            demo={demo}
            defaultOpen={task.id === "t1"}
            failedStepIds={new Set([...failedSteps.values()].filter((f) => f.task === task.id).map((f) => f.step))}
            focusStepId={focusStep}
          />
        ))}
      </ul>
      <FinishedTasks count={done.length}>
        <ul aria-label="Finished tasks" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {done.map((task) => (
            <TaskRow key={task.id} task={task} today={TODAY} actions={taskActions} demo={demo} />
          ))}
        </ul>
      </FinishedTasks>

      <h3>Item rows</h3>
      <WorkOnNextCard {...next} />
      <ItemList
        items={shownItems}
        actions={itemActions}
        reorderable={!sorted}
        demo={demo}
        failed={failedByItem}
        onReorder={(ids, moved) => {
          setItems((list) => list.map((x) => ({ ...x, sortOrder: ids.indexOf(x.id) + 1 })));
          say(`Moved ${items.find((x) => x.id === moved)?.item ?? ""}`);
        }}
      />

      <h3>Guest rows</h3>
      <CountCards>
        <HeadcountsCard counts={headcounts(guests)} />
        <SidesCard sides={sides(guests)} />
      </CountCards>
      <ul aria-label="Guests" style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {guests.map((g) => (
          <GuestRow
            key={g.id}
            guest={g}
            demo={demo}
            onRsvp={onRsvp}
            onOpen={(opened) => say(`Opened ${opened.name}`)}
            failed={failedGuests.has(g.id)}
            onRetry={() => failedGuests.get(g.id)?.()}
          />
        ))}
      </ul>
    </div>
  );
}
