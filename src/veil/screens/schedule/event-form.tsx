"use client";

import { useId, type Ref } from "react";
import type { IsoDate } from "@/lib/model/bookings";
import { SCHEDULE_KINDS, type ScheduleKind } from "@/lib/model/labels";
import { REMINDER_HINT, oldReminderLine, reminderOptions, type ReminderState } from "@/lib/model/schedule";
import { ChipGroup } from "@/veil/parts/chips/chip";
import { NotificationState } from "@/veil/parts/device/notification-state";
import { useNotificationPermission } from "@/veil/parts/device/use-permission";
import { Check, DateInput, FieldInput, FieldRow, Fields, FieldSelect, FieldText, Hint, type Bound } from "@/veil/parts/fields/fields";
import { useToast } from "@/veil/shell/toasts";
import { TITLE_PLACEHOLDER, allowedToast } from "./schedule-text";
import styles from "./event-form.module.css";

/** The value a reminder set for a time of day shows under: it isn't one of the choices. */
export const OLD_REMINDER = "old";

export interface EventFormProps {
  kind: Bound<ScheduleKind>;
  title: Bound<string> & { ref?: Ref<HTMLInputElement>; autoFocus?: boolean };
  date: Bound<string>;
  allDay: Bound<boolean>;
  start: Bound<string>;
  end: Bound<string>;
  /** "", "vendor:<id>" or "venue:<id>". */
  related: Bound<string>;
  where: Bound<string>;
  notes: Bound<string>;
  /** "", "1d", "7d", or `OLD_REMINDER` for one that can't arrive. */
  remind: Bound<string>;
  /** What "With" offers; the event's current one is added when it isn't among them. */
  withChoices: readonly { value: string; label: string }[];
  /** For an event that exists, what it is linked to now, so a ruled-out vendor still shows. */
  currentRelated?: { value: string; label: string } | null;
  /** Today, for the reminder choices. */
  today: IsoDate;
  /** The reminder as stored, to name one that can't arrive. */
  reminderState: ReminderState;
  /** The line under a field that needs fixing (N9). */
  problems: { title?: string | null; date?: string | null; end?: string | null };
  /** A change that didn't save, per row (the ring). */
  failed?: Partial<Record<"title" | "date" | "time" | "related" | "where" | "notes" | "remind", { failed: boolean; retry: () => void; disabled: boolean }>>;
}

/**
 * The fields of an event, as the sheet shows them for both an event that exists
 * (which saves as you go) and a new one (which saves on its button): the kind,
 * title, date, time, who it's with, where, notes and Remind us (guide §5.19).
 * It only draws; each sheet decides when anything is saved.
 */
export function EventForm(props: EventFormProps) {
  const { kind, title, date, allDay, start, end, related, where, notes, remind, withChoices, today, problems, failed } = props;
  const toast = useToast();
  const { permission, allow } = useNotificationPermission();
  const id = useId();

  const options = [{ value: "", label: "Nothing" }, ...withChoices];
  const current = props.currentRelated;
  if (current && current.value && !options.some((o) => o.value === current.value)) options.push(current);

  const date_ = date.value && /^\d{4}-\d{2}-\d{2}$/.test(date.value) ? (date.value as IsoDate) : null;
  const old = props.reminderState.kind === "old" ? props.reminderState : null;
  const remindOptions = [
    ...(old ? [{ value: OLD_REMINDER, label: "Choose again", disabled: true }] : []),
    ...reminderOptions(date_, today),
  ];

  return (
    <>
      <div className={styles.kinds}>
        <ChipGroup
          label="Kind"
          options={SCHEDULE_KINDS}
          value={kind.value}
          disabled={kind.disabled}
          onChange={(next) => {
            kind.onChange?.(next);
            kind.onCommit?.(next);
          }}
        />
      </div>
      <Fields>
        <FieldRow label="Title" problem={problems.title} field={failed?.title}>
          <FieldInput {...title} placeholder={TITLE_PLACEHOLDER} />
        </FieldRow>
        <FieldRow label="Date" problem={problems.date} field={failed?.date}>
          <DateInput {...date} />
        </FieldRow>
        <FieldRow label="Time" group problem={problems.end} field={failed?.time}>
          <div className={styles.when}>
            <Check {...allDay}>All day</Check>
            {allDay.value ? null : (
              <span className={styles.times}>
                <FieldInput {...start} id={`${id}-start`} type="time" aria-label="Starts" aria-invalid={false} />
                <span aria-hidden>to</span>
                <FieldInput {...end} id={`${id}-end`} type="time" aria-label="Ends, optional" />
              </span>
            )}
          </div>
        </FieldRow>
        <FieldRow label="With" field={failed?.related}>
          <FieldSelect {...related} options={options} />
        </FieldRow>
        <FieldRow label="Where, or a call link" field={failed?.where}>
          <FieldInput {...where} placeholder="An address or https://…" />
        </FieldRow>
        <FieldRow label="Notes" field={failed?.notes}>
          <FieldText {...notes} />
        </FieldRow>
        <FieldRow
          label="Remind us"
          problem={old ? oldReminderLine(old.label, date_, today) : undefined}
          field={failed?.remind}
        >
          {/* One grid cell: the select, then what this device allows. */}
          <div>
            <FieldSelect {...remind} options={remindOptions} />
            {old ? null : <Hint>{REMINDER_HINT}</Hint>}
            {permission === "unsupported" ? null : (
              <NotificationState
                permission={permission}
                where="sheet"
                onAllow={() => void allow().then((now) => now === "granted" && toast.confirmation(allowedToast))}
              />
            )}
          </div>
        </FieldRow>
      </Fields>
    </>
  );
}
