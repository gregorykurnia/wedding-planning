"use client";

import { useRef, useState } from "react";
import { useOnline } from "@/lib/data/session";
import { offlineOr } from "@/lib/model/save-state";
import { bookFinalist, moveFinalistToVendors } from "@/lib/data/shortlist";
import { useToday } from "@/lib/data/use-today";
import { newId } from "@/lib/data/write";
import {
  BOOK_CARRIES,
  BOOK_FAILED,
  BOOK_NO_PACKAGES,
  BOOK_SUB,
  MOVE_FAILED,
  MOVE_SUB,
  bookTitle,
  bookedToast,
  movedToast,
  moveTitle,
  packageChip,
  packageName,
  type PackageView,
} from "@/lib/model/finalist-detail";
import { ChipGroup } from "@/veil/parts/chips/chip";
import { Banner } from "@/veil/shell/banner";
import { CreateSheetActions, Sheet, useSheet } from "@/veil/shell/sheet";
import { useToast } from "@/veil/shell/toasts";
import styles from "./finalist-screen.module.css";

/**
 * "Book Kebun Bunga Atelier" (guide §5.14, F24): the package chosen becomes the
 * booking's price, and everything else comes along. The vendor id is made when
 * the sheet opens and kept, so Try again after a lost connection books the same
 * record and never a second.
 */
export function BookSheet({
  finalistId,
  name,
  packages,
  leaningId,
  onBooked,
}: {
  finalistId: string;
  name: string;
  packages: PackageView[];
  leaningId: string | null;
  /** Opens the booking from the toast. */
  onBooked: (bookingId: string) => void;
}) {
  const sheet = useSheet();
  const toast = useToast();
  const today = useToday();
  const offline = !useOnline();
  const vendorId = useRef<string | null>(null);
  const [chosen, setChosen] = useState<string>(leaningId ?? packages[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function book() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    vendorId.current ??= newId("vendors");
    try {
      const done = await bookFinalist(finalistId, packages.length ? chosen : null, today, { vendorId: vendorId.current });
      toast.next(bookedToast(name), "Open", () => onBooked(done.bookingId));
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    sheet.close();
  }

  return (
    <Sheet title={bookTitle(name)} sub={BOOK_SUB}>
      {packages.length ? (
        <ChipGroup
          label="Package"
          className={styles.chosen}
          options={packages.map((p) => ({ value: p.id, label: packageChip(packageName(p), p.price) }))}
          value={chosen}
          onChange={setChosen}
        />
      ) : (
        <p className={styles.sheetNote}>{BOOK_NO_PACKAGES}</p>
      )}
      <p className={styles.sheetNote}>{BOOK_CARRIES}</p>
      {failed && (
        <Banner tone="rose" inline>
          {offlineOr(BOOK_FAILED, offline)}
        </Banner>
      )}
      <CreateSheetActions
        action={failed ? "Try again" : "Book it"}
        busy={busy}
        busyLabel="Booking"
        demoLine="Demonstration mode: booking is turned off."
        onAction={() => void book()}
      />
    </Sheet>
  );
}

/**
 * "Move Arka Visual into Vendors?" (guide §5.14, F24; finalists added straight
 * to the shortlist only): its packages become price options at Considering,
 * and it stays on the shortlist, now copied from that vendor. Undo removes the vendor.
 */
export function MoveSheet({ finalistId, name }: { finalistId: string; name: string }) {
  const offline = !useOnline();
  const sheet = useSheet();
  const toast = useToast();
  const vendorId = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function move() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    vendorId.current ??= newId("vendors");
    try {
      const { undo } = await moveFinalistToVendors(finalistId, { vendorId: vendorId.current });
      toast.undoable(movedToast(name), undo);
    } catch {
      setBusy(false);
      setFailed(true);
      return;
    }
    sheet.close();
  }

  return (
    <Sheet title={moveTitle(name)} sub={MOVE_SUB}>
      {failed && (
        <Banner tone="rose" inline>
          {offlineOr(MOVE_FAILED, offline)}
        </Banner>
      )}
      <CreateSheetActions
        action={failed ? "Try again" : "Move into Vendors"}
        busy={busy}
        busyLabel="Moving"
        demoLine="Demonstration mode: moving is turned off."
        onAction={() => void move()}
      />
    </Sheet>
  );
}
