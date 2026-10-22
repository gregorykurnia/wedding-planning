"use client";

import { useRef, type KeyboardEvent } from "react";
import type { GuestRecord } from "@/lib/model/guests";
import { RSVPS, type Rsvp } from "@/lib/model/labels";
import { TextLink } from "@/veil/parts/actions/text-link";
import { useFlash } from "@/veil/shell/flash";
import { inviteLine, metaParts, plusText, rsvpFailed } from "./guest-text";
import styles from "./guests.module.css";
import { useOnline } from "@/lib/data/session";
import { offlineOr } from "@/lib/model/save-state";

const join = (...names: (string | false | null | undefined)[]) => names.filter(Boolean).join(" ");

export interface RsvpSwitchProps {
  /** Names the switch for a screen reader: "RSVP for Hendra Santoso", or "RSVP" in the guest's own sheet. */
  label: string;
  value: Rsvp;
  onChange: (next: Rsvp) => void;
  /** Demonstration mode: pressing does nothing. */
  disabled?: boolean;
  /** The reply didn't save: a rose ring (the row says so). */
  failed?: boolean;
}

/**
 * The three-way RSVP switch (guide §4.29): Waiting · Attending · Not attending.
 * A radio group: one tab stop on the chosen segment, and the arrow keys, Home
 * and End move and choose. Pressed is ink for Waiting, sage for Attending and
 * muted ink for Not attending; on a phone the segments are bigger for thumbs.
 */
export function RsvpSwitch({ label, value, onChange, disabled = false, failed = false }: RsvpSwitchProps) {
  const segments = useRef<(HTMLButtonElement | null)[]>([]);
  const checked = Math.max(0, RSVPS.findIndex((r) => r.value === value));

  function choose(index: number) {
    if (disabled) return;
    const next = RSVPS[index].value;
    if (next !== value) onChange(next);
    segments.current[index]?.focus();
  }

  function onKeyDown(event: KeyboardEvent<HTMLSpanElement>) {
    const index = segments.current.indexOf(event.target as HTMLButtonElement);
    if (index < 0) return;
    const last = RSVPS.length - 1;
    let next: number | undefined;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") next = index === last ? 0 : index + 1;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = index === 0 ? last : index - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === undefined) return;
    event.preventDefault();
    choose(next);
  }

  return (
    <span
      className={join(styles.seg, failed && styles.segFailed)}
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
    >
      {RSVPS.map((r, index) => (
        <button
          key={r.value}
          ref={(element) => {
            segments.current[index] = element;
          }}
          type="button"
          role="radio"
          aria-checked={r.value === value}
          tabIndex={index === checked ? 0 : -1}
          data-rsvp={r.value}
          className={styles.segment}
          onClick={() => choose(index)}
        >
          {r.label}
        </button>
      ))}
    </span>
  );
}

export interface GuestRowProps {
  guest: GuestRecord;
  /** One tap on the switch saves; the screen writes and shows its toast. */
  onRsvp: (guest: GuestRecord, next: Rsvp) => void;
  /** The guest's name opens their sheet. */
  onOpen: (guest: GuestRecord) => void;
  /** The last reply didn't save. The switch shows the choice that was made. */
  failed?: boolean;
  onRetry?: (guest: GuestRecord) => void;
  /** Demonstration mode: the switch is inert. */
  demo?: boolean;
}

/**
 * One guest (guide §4.29): the number in gold italic that is never reused, the
 * name (opens the guest), "+2" for plus-ones, who they're invited to, the RSVP
 * switch, and a line of connection, country and food notes. A reply that
 * didn't save keeps the choice and offers Try again.
 */
export function GuestRow({ guest, onRsvp, onOpen, failed = false, onRetry, demo = false }: GuestRowProps) {
  const offline = !useOnline();
  const flash = useFlash({ kind: "guest", id: guest.id });
  const meta = metaParts(guest);
  const plus = plusText(guest.plusOnes);

  return (
    <li className={join(styles.grow, flash)} data-guest-id={guest.id}>
      <span className={styles.no}>
        {guest.number != null ? (
          <>
            <span className="sr">Guest number </span>
            {guest.number}
          </>
        ) : null}
      </span>
      <button type="button" className={styles.gname} dir="auto" onClick={() => onOpen(guest)}>
        {guest.name}
        {plus ? <small>{plus}</small> : null}
      </button>
      <div className={styles.right}>
        <span className={styles.inv}>{inviteLine(guest)}</span>
        <RsvpSwitch
          label={`RSVP for ${guest.name}`}
          value={guest.rsvpStatus}
          disabled={demo}
          failed={failed}
          onChange={(next) => onRsvp(guest, next)}
        />
      </div>
      <span className={styles.gmeta} dir="auto">
        {meta.plain.join(", ")}
        {meta.plain.length && meta.food ? ", " : ""}
        {meta.food ? <span className={styles.food}>{meta.food}</span> : null}
        {!meta.plain.length && !meta.food ? " " : null}
      </span>
      {failed ? (
        <p className={styles.rowErr} role="alert">
          <span>{offlineOr(rsvpFailed(guest.name), offline)}</span>
          <TextLink tone="rose" onClick={() => onRetry?.(guest)}>
            Try again
          </TextLink>
        </p>
      ) : null}
    </li>
  );
}
