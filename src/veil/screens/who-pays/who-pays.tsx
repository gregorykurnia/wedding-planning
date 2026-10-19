"use client";

import { useEffect, useRef, useState } from "react";
import { addFunderWithUndo, removeFunder, renameFunderWithUndo } from "@/lib/data/funders";
import { useFunderTotals, type FunderTotals } from "@/lib/data/use-funders";
import { useWhatIf } from "@/lib/data/use-what-if";
import { budget, byFunder, whatIfParts } from "@/lib/model/money";
import { Btn } from "@/veil/parts/actions/btn";
import { Hero } from "@/veil/parts/hero/hero";
import { BackLink } from "@/veil/shell/back-link";
import { useConfirm } from "@/veil/shell/confirm";
import { PageColumn } from "@/veil/shell/page-column";
import { ScreenState } from "@/veil/shell/screen-state";
import { useToast } from "@/veil/shell/toasts";
import { AddFunderRow } from "./add-funder-row";
import { FunderItem } from "./funder-item";
import { NOTHING_BOOKED, removeBody, removeTitle, totalsNote } from "./funder-text";
import styles from "./who-pays.module.css";

/** What the screen shows in demonstration mode: no funders, nothing booked, only Not assigned. */
const NOTHING: FunderTotals = { rows: byFunder([], []), budget: budget([]), hasBookings: false, nextOrder: 0 };

/**
 * Who pays (guide §5.9, B7, B11): one row per funder with what they've paid and
 * still owe, Not assigned last. Add, rename and remove each save on the spot
 * and leave a few seconds of Undo (guide §6.2).
 */
export function WhoPays() {
  const read = useFunderTotals();
  return (
    <PageColumn>
      <ScreenState read={read} what="who pays" onRetry={() => window.location.reload()}>
        {(data) => <Funders totals={data ?? NOTHING} demo={read.status === "demo"} />}
      </ScreenState>
    </PageColumn>
  );
}

function Funders({ totals, demo }: { totals: FunderTotals; demo: boolean }) {
  const toast = useToast();
  const confirm = useConfirm();
  const whatIf = useWhatIf();
  const [renaming, setRenaming] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const addButton = useRef<HTMLDivElement>(null);
  const wasAdding = useRef(false);
  const { rows, budget: total, hasBookings, nextOrder } = totals;
  const sums = totalsNote(total.paid, total.left);

  // When the new funder's row closes, focus goes back to the button that opened it.
  useEffect(() => {
    if (wasAdding.current && !adding) addButton.current?.querySelector("button")?.focus();
    wasAdding.current = adding;
  }, [adding]);

  async function saveName(id: string, name: string) {
    const { undo } = await renameFunderWithUndo(id, name);
    toast.undoable(<>Renamed to {name}</>, undo);
  }

  async function add(id: string, name: string) {
    const { undo } = await addFunderWithUndo(id, name, nextOrder);
    toast.undoable(<>Added {name}</>, undo);
  }

  async function remove(id: string) {
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    const removed: { undo?: () => Promise<void> } = {};
    const done = await confirm({
      title: removeTitle(row.name),
      body: removeBody(row, (whatIf.data ?? []).filter((w) => whatIfParts(w).some((p) => p.funder === id)).length),
      action: "Remove funder",
      danger: true,
      run: async () => {
        removed.undo = (await removeFunder(id)).undo;
      },
    });
    if (done && removed.undo) toast.undoable(<>Removed {row.name}</>, removed.undo);
  }

  return (
    <>
      <BackLink path="/budget" label="Budget" />
      <Hero title="Who pays" sub="What each of you and your families have paid, and what’s still to pay" />
      {!hasBookings && <p className={`${styles.note} ${styles.centred}`}>{NOTHING_BOOKED}</p>}
      <ul className={styles.funders}>
        {rows.map((row) => (
          <FunderItem
            key={row.id ?? "not-assigned"}
            row={row}
            renaming={row.id !== null && renaming === row.id}
            onRename={() => setRenaming(row.id)}
            onSaveName={(name) => saveName(row.id as string, name)}
            onCloseRename={() => setRenaming(null)}
            onRemove={() => void remove(row.id as string)}
          />
        ))}
        {adding && <AddFunderRow demo={demo} onAdd={add} onClose={() => setAdding(false)} />}
      </ul>
      {!adding && (
        <div className={styles.addRow} ref={addButton}>
          <Btn
            variant="quiet"
            small
            onClick={() => {
              setRenaming(null);
              setAdding(true);
            }}
          >
            Add a funder
          </Btn>
        </div>
      )}
      {hasBookings && (
        <p className={styles.note}>
          Together that’s <b className="num">{sums.paid}</b> paid and{" "}
          <b className="num">{sums.left}</b> still to pay, the same totals as the
          budget. Still to pay is always the price minus what’s been paid.
        </p>
      )}
    </>
  );
}
