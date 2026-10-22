"use client";

import { useEffect, useRef, useState } from "react";
import { deleteEvent, saveEvent, setEventStatus, useSchedule } from "@/lib/data/schedule";
import { useAutosaveField } from "@/lib/data/use-autosave-field";
import { useToday } from "@/lib/data/use-today";
import { isLate, type EventRecord, type EventStatus } from "@/lib/model/agenda";
import type { IsoDate } from "@/lib/model/bookings";
import { isIsoDate } from "@/lib/model/dates";
import {
  DEFAULT_START,
  eventProblems,
  heldLine,
  kindOf,
  needLine,
  relatedFields,
  relatedValue,
  reminderMinutesOf,
  reminderState,
  whenOf,
  whenPatch,
  type EventField,
  type ReminderKey,
  type WhenDraft,
} from "@/lib/model/schedule";
import { Btn } from "@/veil/parts/actions/btn";
import { TextLink } from "@/veil/parts/actions/text-link";
import { SaveScopeProvider } from "@/veil/parts/fields/save-scope";
import { Banner } from "@/veil/shell/banner";
import { useConfirm } from "@/veil/shell/confirm";
import { EditSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import { EventForm, OLD_REMINDER } from "./event-form";
import styles from "./event-sheet.module.css";
import { STATUS_FAILED, STATUS_TOAST, deleteConfirm, deletedToast, sheetSub } from "./schedule-text";
import { useOnline } from "@/lib/data/session";
import { offlineOr } from "@/lib/model/save-state";

/**
 * An event's sheet (guide §5.19; S1, S2, S10): every change saves as you go, and
 * it closes with Done. It reads the event live, so a change from Bella arrives in
 * the open sheet; if the event goes while it is open, the last one seen stays.
 */
export function EventSheet({ eventId }: { eventId: string }) {
  const read = useSchedule();
  const today = useToday();
  const found = read.data?.events.find((e) => e.id === eventId);
  const [latest, setLatest] = useState<EventRecord | undefined>(found);
  // Kept as state, so the last event seen outlasts the event leaving the read.
  if (found && found !== latest) setLatest(found);
  const event = found ?? latest;
  if (!event) return <Sheet title="This event isn’t here" sub="It may have been deleted." />;
  const relatedId = event.relatedVendorId ?? event.relatedVenueId;
  const linked = relatedId ? read.data?.related.get(relatedId) : undefined;
  return (
    <SaveScopeProvider sheet>
      <Editor
        event={event}
        today={today}
        withChoices={read.data?.withChoices ?? []}
        currentRelated={
          linked && relatedId
            ? { value: `${linked.kind}:${relatedId}`, label: linked.kind === "venue" ? `${linked.name}, venue` : linked.name }
            : null
        }
      />
    </SaveScopeProvider>
  );
}

function Editor({
  event,
  today,
  withChoices,
  currentRelated,
}: {
  event: EventRecord;
  today: IsoDate;
  withChoices: readonly { value: string; label: string }[];
  currentRelated: { value: string; label: string } | null;
}) {
  const offline = !useOnline();
  const sheet = useSheet();
  const toast = useToast();
  const confirm = useConfirm();
  const form = useRef<HTMLDivElement>(null);

  const when = whenOf(event);
  const remindNow = reminderState(event.reminderMinutes);

  // The time is stored as one value made of four pieces. Each piece saves on its
  // own, so the next write builds on the one before it, not on a snapshot that
  // hasn't caught up; a failed write puts it back.
  const whenRef = useRef<WhenDraft>(when);
  useEffect(() => {
    whenRef.current = whenOf({ startAt: event.startAt, endAt: event.endAt, allDay: event.allDay });
  }, [event.startAt, event.endAt, event.allDay]);
  async function writeWhen(change: Partial<WhenDraft>) {
    const before = whenRef.current;
    const next = { ...before, ...change };
    whenRef.current = next;
    try {
      await saveEvent(event.id, whenPatch(before, next));
    } catch (err) {
      whenRef.current = before;
      throw err;
    }
  }

  const title = useAutosaveField({ value: event.title, save: (next: string) => saveEvent(event.id, { title: next }), normalize: (v) => v.trim() });
  const kind = useAutosaveField({ value: kindOf(event.type), save: (next) => saveEvent(event.id, { type: next }) });
  const date = useAutosaveField({ value: when.date, save: (next: string) => writeWhen({ date: next }) });
  const allDay = useAutosaveField({
    value: when.allDay,
    save: (next: boolean) => writeWhen(next ? { allDay: true } : { allDay: false, start: whenRef.current.start || DEFAULT_START }),
  });
  const start = useAutosaveField({ value: when.start, save: (next: string) => writeWhen({ start: next }) });
  const end = useAutosaveField({ value: when.end, save: (next: string) => writeWhen({ end: next }) });
  const related = useAutosaveField({ value: relatedValue(event), save: (next: string) => saveEvent(event.id, relatedFields(next)) });
  const where = useAutosaveField({ value: event.location, save: (next: string) => saveEvent(event.id, { location: next }), normalize: (v) => v.trim() });
  const notes = useAutosaveField({ value: event.notes, save: (next: string) => saveEvent(event.id, { notes: next }) });
  const remindValue = remindNow.kind === "old" ? OLD_REMINDER : remindNow.key;
  const remind = useAutosaveField({
    value: remindValue,
    save: (next: string) => saveEvent(event.id, { reminderMinutes: reminderMinutesOf(next as ReminderKey) }),
  });

  // N9: a change that would leave the event without a title or a date, or ending
  // before it starts, isn't saved. The field keeps what was typed, and the others
  // keep saving. `shown` is what the person has already tried to save.
  const drafts = { title: title.draft, date: date.draft, allDay: allDay.draft, start: start.draft, end: end.draft };
  const [tried, setTried] = useState<EventField[]>([]);
  const problems = eventProblems(drafts);
  const shown = tried.filter((f) => problems.includes(f));

  const holdable: Record<EventField, (value: string) => void> = {
    title: (v) => title.commit(v),
    date: (v) => date.commit(v),
    end: (v) => end.commit(v),
  };

  function attempt(changed: Partial<typeof drafts>, own: EventField | null, commit: () => void) {
    const now = { ...drafts, ...changed };
    const bad = eventProblems(now);
    // A saved end the new start passes is kept as typed, so the sheet shows it and says what to fix.
    if (!own && bad.includes("end")) end.change(now.end);
    setTried(bad);
    if (!own || !bad.includes(own)) commit();
    // A field that was waiting for a fix saves as soon as it can.
    for (const field of tried) {
      if (field !== own && !bad.includes(field)) holdable[field](now[field]);
    }
  }

  const fail = (f: { failed: boolean; retry: () => void; disabled: boolean }) => ({ failed: f.failed, retry: f.retry, disabled: f.disabled });
  const time = {
    failed: allDay.failed || start.failed || end.failed,
    retry: () => {
      for (const f of [allDay, start, end]) if (f.failed) f.retry();
    },
    disabled: allDay.disabled,
  };

  const [statusBusy, setStatusBusy] = useState<EventStatus | null>(null);
  const [statusFailed, setStatusFailed] = useState(false);
  async function changeStatus(next: EventStatus) {
    if (statusBusy) return;
    setStatusBusy(next);
    setStatusFailed(false);
    try {
      const { undo } = await setEventStatus(event.id, next);
      toast.undoable(STATUS_TOAST[next], undo);
      setStatusBusy(null);
      // Closes the way Done does (N18): a field's change that is saving or didn't save holds it open.
      sheet.requestClose();
    } catch {
      setStatusFailed(true);
      setStatusBusy(null);
    }
  }

  async function remove() {
    let undo: (() => Promise<void>) | undefined;
    const gone = await confirm({
      ...deleteConfirm(event.title),
      danger: true,
      run: async () => {
        undo = (await deleteEvent(event.id)).undo;
      },
    });
    if (!gone || !undo) return;
    toast.undoable(deletedToast(event.title), undo);
    sheet.close();
  }

  const date_ = when.date && isIsoDate(when.date) ? when.date : null;
  const kept = { title: event.title, date: when.date };
  const line = (field: EventField) => (shown.includes(field) ? needLine(field, kept, today) : null);
  const scheduled = event.status === "scheduled";
  const late = scheduled && date_ !== null && isLate({ status: event.status, date: date_ }, today);

  return (
    <div ref={form}>
      <Sheet
        title={event.title}
        sub={<span className={late ? styles.was : undefined}>{sheetSub(event.status, date_, late, today)}</span>}
      >
        <EventForm
          kind={{ ...kind.bind, onChange: kind.change, onCommit: (v) => kind.commit(v) }}
          title={{ ...title.bind, onCommit: (v) => attempt({ title: v }, "title", () => title.commit(v)) }}
          date={{ ...date.bind, onCommit: (v) => attempt({ date: v }, "date", () => date.commit(v)) }}
          allDay={{ ...allDay.bind, onCommit: (v) => attempt({ allDay: v }, null, () => allDay.commit(v)) }}
          start={{ ...start.bind, onCommit: (v) => attempt({ start: v }, null, () => start.commit(v)) }}
          end={{ ...end.bind, onCommit: (v) => attempt({ end: v }, "end", () => end.commit(v)) }}
          related={related.bind}
          where={where.bind}
          notes={notes.bind}
          remind={remind.bind}
          withChoices={withChoices}
          currentRelated={currentRelated}
          today={today}
          reminderState={remindNow}
          problems={{ title: line("title"), date: line("date"), end: line("end") }}
          failed={{
            title: fail(title),
            date: fail(date),
            time,
            related: fail(related),
            where: fail(where),
            notes: fail(notes),
            remind: fail(remind),
          }}
        />
        {statusFailed && (
          <Banner tone="rose" inline role="alert">
            {offlineOr(STATUS_FAILED, offline)}
          </Banner>
        )}
        <EditSheetActions
          blocked={shown.length}
          blockedLine={shown.length ? heldLine(shown) : null}
          onBlocked={() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()}
          before={
            scheduled ? (
              <>
                <Btn variant="quiet" busy={statusBusy === "completed"} busyLabel="Saving" disabled={statusBusy !== null} onClick={() => void changeStatus("completed")}>
                  Mark completed
                </Btn>
                <Btn variant="quiet" busy={statusBusy === "cancelled"} busyLabel="Saving" disabled={statusBusy !== null} onClick={() => void changeStatus("cancelled")}>
                  Cancel it
                </Btn>
              </>
            ) : (
              <Btn variant="quiet" busy={statusBusy === "scheduled"} busyLabel="Saving" disabled={statusBusy !== null} onClick={() => void changeStatus("scheduled")}>
                Back to scheduled
              </Btn>
            )
          }
          link={
            <TextLink tone="rose" onClick={() => void remove()}>
              Delete
            </TextLink>
          }
        />
      </Sheet>
    </div>
  );
}
