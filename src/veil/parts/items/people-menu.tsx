"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { ITEM_PEOPLE, type ItemPerson } from "@/lib/model/labels";
import { GENERAL_CHOICE } from "./item-text";
import styles from "./people-menu.module.css";

export interface PeopleMenuProps {
  /** What the closed menu reads: the people so far, or "Anyone". */
  summary: ReactNode;
  /** The summary's accessible name, when it says more than it shows: "Who Wedding cake is for: General". */
  summaryLabel?: string;
  /** What the group of checks is called. */
  groupLabel: string;
  /** Who is ticked. */
  picked: readonly ItemPerson[];
  /** A person ticked (`on`) or unticked. Ticking General when it already is on does nothing. */
  onToggle: (person: ItemPerson, on: boolean) => void;
  /**
   * `row`: "General, no one in particular", a hairline, then every person (guide §4.28, N12).
   * `filter`: every choice including General, as the "Anyone" filter lists them (§6.8).
   */
  kind: "row" | "filter";
  /** The closed menu reads muted: an item for no one in particular. */
  muted?: boolean;
  /** Ringed rose: the last change to it didn't save. */
  ringed?: boolean;
  /** Demonstration mode, or anything else that makes it inert. */
  disabled?: boolean;
  /** Which edge the open menu lines up with. */
  align?: "start" | "end";
  className?: string;
}

/**
 * A `<details>` with a list of checks (guide §4.28, §6.8). Each tick acts at
 * once. It closes when a press lands anywhere else, and on Escape, which puts
 * focus back on the summary.
 */
export function PeopleMenu({
  summary,
  summaryLabel,
  groupLabel,
  picked,
  onToggle,
  kind,
  muted = false,
  ringed = false,
  disabled = false,
  align = "start",
  className,
}: PeopleMenuProps) {
  const box = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const away = (event: PointerEvent) => {
      const open = box.current;
      if (open?.open && !open.contains(event.target as Node)) open.open = false;
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key !== "Escape" || !box.current?.open) return;
    event.preventDefault();
    event.stopPropagation();
    box.current.open = false;
    box.current.querySelector<HTMLElement>("summary")?.focus();
  };

  // On an item, General is ticked when nobody else is; in the filter it is a choice like any other.
  const named = picked.filter((p) => p !== "General");
  const isOn = (person: ItemPerson) => (person === "General" && kind === "row" ? named.length === 0 : picked.includes(person));
  const check = (person: ItemPerson, label: string) => (
    <label key={person} className={styles.check}>
      <input type="checkbox" checked={isOn(person)} onChange={(event) => onToggle(person, event.target.checked)} />
      {label}
    </label>
  );

  const classes = [styles.menuBox, kind === "filter" && styles.filter, className].filter(Boolean).join(" ");
  const summaryClasses = [styles.summary, muted && styles.muted, ringed && styles.ringed, disabled && styles.inert]
    .filter(Boolean)
    .join(" ");
  return (
    <details ref={box} className={classes} onKeyDown={onKeyDown}>
      <summary
        className={summaryClasses}
        aria-label={summaryLabel}
        aria-disabled={disabled || undefined}
        dir="auto"
        onClick={(event) => {
          if (disabled) event.preventDefault();
        }}
      >
        {summary}
      </summary>
      <div className={`${styles.menu} ${align === "end" ? styles.end : ""}`} role="group" aria-label={groupLabel}>
        {kind === "row" ? (
          <>
            {check("General", GENERAL_CHOICE)}
            <span className={styles.sep} aria-hidden="true" />
            {ITEM_PEOPLE.filter((p) => p.value !== "General").map((p) => check(p.value, p.label))}
          </>
        ) : (
          ITEM_PEOPLE.map((p) => check(p.value, p.label))
        )}
      </div>
    </details>
  );
}
