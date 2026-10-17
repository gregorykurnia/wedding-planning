"use client";

import { useRef, useState } from "react";
import { addEvent, newEventId, useSchedule } from "@/lib/data/schedule";
import { useToday } from "@/lib/data/use-today";
import type { IsoDate } from "@/lib/model/bookings";
import { isIsoDate } from "@/lib/model/dates";
import type { ScheduleKind } from "@/lib/model/labels";
import {
  DEFAULT_START,
  defaultReminder,
  eventProblems,
  needLine,
  reminderPast,
  reminderState,
  storedEvent,
  type EventField,
  type ReminderKey,
} from "@/lib/model/schedule";
import { Banner } from "@/veil/shell/banner";
import { useFlasher } from "@/veil/shell/flash";
import { CreateSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import { EventForm } from "./event-form";
import { ADD_FAILED, ADD_TITLE, addedToast } from "./schedule-text";

/**
 * "Add to the schedule" (guide §5.19; S1, N9). A new event saves on its button,
 * because there is nothing to save into until it exists. With a title or a date
 * missing, or an end before the start, each field is ringed with one line on what
 * to do, everything typed stays, and focus goes to the first problem. The record
 * id is made on the first press and kept until it lands, so Try again after a
 * lost connection writes the same event.
 */
export function AddEventSheet({ date }: { date?: IsoDate | null }) {
  const sheet = useSheet();
  const toast = useToast();
  const flash = useFlasher();
  const today = useToday();
  const read = useSchedule();

  const [kind, setKind] = useState<ScheduleKind>("appointment");
  const [title, setTitle] = useState("");
  const [day, setDay] = useState<string>(date ?? today);
  const [allDay, setAllDay] = useState(false);
  const [start, setStart] = useState(DEFAULT_START);
  const [end, setEnd] = useState("");
  const [related, setRelated] = useState("");
  const [where, setWhere] = useState("");
  const [notes, setNotes] = useState("");
  const [remind, setRemind] = useState<ReminderKey>(() => defaultReminder(date ?? today, today));
  const [pressed, setPressed] = useState(false);
  const [adding, setAdding] = useState(false);
  const [failed, setFailed] = useState(false);
  const id = useRef<string | null>(null);
  const form = useRef<HTMLDivElement>(null);

  const problems = eventProblems({ title, date: day, allDay, start, end });
  const shown: EventField[] = pressed ? problems : [];
  const line = (field: EventField) => (shown.includes(field) ? needLine(field, null, today) : null);

  async function add() {
    if (adding) return;
    setPressed(true);
    if (problems.length) {
      // Focus goes to the first problem, in the order the fields are on the sheet.
      requestAnimationFrame(() => form.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setFailed(false);
    setAdding(true);
    id.current ??= newEventId();
    const eventId = id.current;
    const fields = storedEvent({ title, kind, when: { date: day, allDay, start, end }, related, where, notes, remind });
    try {
      const { undo } = await addEvent(eventId, fields);
      toast.undoable(addedToast(fields.title), undo);
      flash({ kind: "event", id: eventId });
    } catch {
      setAdding(false);
      setFailed(true);
      return;
    }
    sheet.close();
  }

  return (
    <div ref={form}>
      <Sheet title={ADD_TITLE}>
        <EventForm
          kind={{ value: kind, onChange: setKind }}
          title={{ value: title, onChange: setTitle, autoFocus: true }}
          date={{
            value: day,
            onChange: (next) => {
              setDay(next);
              // A morning that has gone can't stay chosen: it goes back to no reminder.
              if (reminderPast(remind, isIsoDate(next) ? next : null, today)) setRemind("");
            },
          }}
          allDay={{ value: allDay, onChange: setAllDay }}
          start={{ value: start, onChange: setStart }}
          end={{ value: end, onChange: setEnd }}
          related={{ value: related, onChange: setRelated }}
          where={{ value: where, onChange: setWhere }}
          notes={{ value: notes, onChange: setNotes }}
          remind={{ value: remind, onChange: (next) => setRemind(next as ReminderKey) }}
          withChoices={read.data?.withChoices ?? []}
          today={today}
          reminderState={reminderState([])}
          problems={{ title: line("title"), date: line("date"), end: line("end") }}
        />
        {failed && (
          <Banner tone="rose" inline role="alert">
            {ADD_FAILED}
          </Banner>
        )}
        <CreateSheetActions
          action={failed ? "Try again" : ADD_TITLE}
          busy={adding}
          busyLabel="Adding"
          onAction={() => void add()}
        />
      </Sheet>
    </div>
  );
}
