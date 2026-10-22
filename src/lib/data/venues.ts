"use client";

import { useMemo } from "react";
import { useCollection } from "@/lib/use-collection";
import { fileFromDoc, filesForRecord, type FileDoc } from "@/lib/data/adapters/files";
import { venueFromDoc, type VenueDoc } from "@/lib/data/adapters/bookings";
import { isVenueBooked, type IsoDate } from "@/lib/model/bookings";
import { isListedVenue } from "@/lib/model/search";
import { venueListItem, type VenueDetail, type VenueFile, type VenueListItem } from "@/lib/model/venues";
import { logActivity } from "./activity";
import { bookingIdOf, markBooked, removeVenue, setVenueEstimate } from "./bookings";
import { patchWithUndo, removeWithUndo, updateWithUndo, type Undoable } from "./undo";
import { readOf } from "./read";
import { useSession } from "./session";
import type { Loaded } from "./settings";
import { create, update, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

function useVenueDocs() {
  // No ordering: a document without `createdAt` must not drop out of the list.
  const venues = useCollection<VenueDoc>("venues", venueFromDoc, []);
  const files = useCollection<FileDoc>("weddingFiles", fileFromDoc, []);
  return { venues, files };
}

/** A venue's files: Files first, then legacy ones on the record not imported yet. */
function filesOf(doc: VenueDoc, all: readonly FileDoc[]): VenueFile[] {
  const byId = new Map(all.map((f) => [f.id, f]));
  return filesForRecord([{ kind: "venue", id: doc.id }], all, doc.files).map((f) => {
    const stored = f.id ? byId.get(f.id) : undefined;
    return { id: f.id, name: f.name, url: f.url, size: stored?.fileSize || null, mime: stored?.fileType ?? "" };
  });
}

/**
 * The venues (guide §5.15): every venue that hasn't been taken out of the list,
 * as a row needs it, with whether it is booked and how many files it has (Files
 * first, then legacy ones not imported yet).
 */
export function useVenues(): Loaded<VenueListItem[]> {
  const { connection } = useSession();
  const { venues, files } = useVenueDocs();

  const items = useMemo(() => {
    return venues.data.filter(isListedVenue).map((v) =>
      venueListItem(v, {
        booked: isVenueBooked(v),
        // Files first; a legacy file on the record not in Files yet counts too.
        fileCount: filesForRecord([{ kind: "venue", id: v.id }], files.data, v.files).length,
      }),
    );
  }, [venues.data, files.data]);

  return readOf(connection, [venues, files], items, 1);
}

/**
 * One venue with its files, for its sheet. `null` when there is no such venue here
 * (an old link, or the partner removed it), which closes the sheet.
 */
export function useVenue(id: string): Loaded<{ venue: VenueDetail | null; filesHeld: boolean }> {
  const { connection } = useSession();
  const { venues, files } = useVenueDocs();

  const page = useMemo(() => {
    const doc = venues.data.find((v) => v.id === id && isListedVenue(v));
    if (!doc) return { venue: null, filesHeld: files.loading };
    return {
      filesHeld: files.loading,
      venue: {
        ...venueListItem(doc, { booked: isVenueBooked(doc), fileCount: 0 }),
        files: filesOf(doc, files.data),
      },
    };
  }, [venues.data, files.data, files.loading, id]);

  // Offline, the venue shows as soon as it is here and its files say they're waiting (`filesHeld`):
  // without a stored cache an app opened offline may never hear the files, and the list shows the
  // venue meanwhile (Phase 8 review S2; this replaces P6-S15's wait for the files).
  return readOf(connection, [venues, files], page, 1);
}

export interface NewVenue {
  /** Made when the sheet's form began, so Try again writes the same record. */
  id: string;
  name: string;
  location: string;
  /** The estimated cost; `null` when left empty. */
  cost: number | null;
  /** The most guests; `null` when left empty. */
  guests: number | null;
  notes: string;
  /** A stored venue stage (`Booked` makes it a booking). */
  stage: string;
}

/** Stops an undo of an add from deleting a venue that has grown since (a file, parts, a payment). */
function untouched(data: Record<string, unknown>) {
  const filled = (v: unknown) => Array.isArray(v) && v.length > 0;
  const paid = typeof data.budgetSpent === "number" && data.budgetSpent > 0;
  if (filled(data.files) || filled(data.subEntries) || filled(data.payments) || paid) {
    throw new WriteError("changed", "That venue has changed since it was added");
  }
}

/**
 * Adds a venue (guide §5.15, F1). The fields are the ones the old screens read, so
 * both UIs show the new venue. A venue added as Booked is a booking from the start
 * (B1): the stage and `booking` are written together, once, and the estimate is
 * kept apart from the agreed price (B12). Undo removes the venue again, unless it
 * has grown meanwhile.
 */
export async function addVenue(
  input: NewVenue,
  today: IsoDate,
  opts: WriteOptions = {},
): Promise<Undoable & { becameBooking: boolean }> {
  const { id } = input;
  const name = input.name.trim();
  const booked = input.stage === "Booked";
  const estimate = input.cost ?? 0;
  await create(
    "venues",
    {
      name,
      location: input.location.trim(),
      budgetEstimate: estimate,
      guestMax: input.guests ?? 0,
      status: input.stage,
      notes: input.notes,
      images: [],
      coverImage: null,
      files: [],
      confirmedType: "Venue",
      funder: null,
      budgetSpent: 0,
      nextTargetDate: null,
      nextAction: "",
      subEntries: [],
      ...(booked ? { booking: { on: today, from: "venue", removed: false }, agreedPrice: estimate } : {}),
    },
    { ...opts, id },
  );
  void logActivity("venue.added", { name }, { kind: "venue", id }, opts);
  if (booked) void logActivity("venue.booked", { name }, { kind: "booking", id: bookingIdOf({ kind: "venue", id }) }, opts);
  return {
    becameBooking: booked,
    undo: async () => {
      await removeWithUndo("venues", id, { ...opts, guard: untouched });
      void logActivity("venue.removed", { name }, { kind: "venue", id }, opts);
    },
  };
}

/** The fields the venue sheet saves as you go (guide §5.15). */
export interface VenueFields {
  name: string;
  location: string;
  cost: number | null;
  guests: number | null;
  notes: string;
}

const STORED: { [K in keyof VenueFields]: (value: VenueFields[K]) => Record<string, unknown> } = {
  name: (value) => ({ name: value }),
  location: (value) => ({ location: value }),
  // A cleared cost or capacity is saved as 0 (the model reads 0 as unknown).
  // The cost is saved by `setVenueEstimate`, which keeps a booked venue's price.
  cost: (value) => ({ budgetEstimate: value ?? 0 }),
  guests: (value) => ({ guestMax: value ?? 0 }),
  notes: (value) => ({ notes: value }),
};

/** Saves one field of the venue, by the stored names the old screens read. */
export function setVenueField<K extends keyof VenueFields>(
  id: string,
  field: K,
  value: VenueFields[K],
  opts: WriteOptions = {},
): Promise<void> {
  if (field === "cost") return setVenueEstimate(id, value as number | null, opts);
  return update("venues", id, STORED[field](value), opts);
}

/**
 * Sets the stage (guide §5.15, F3). Booked makes the venue a booking, once (B1,
 * `markBooked`); `becameBooking` says whether it just did, for the toast with
 * Open. Choosing Booked for a venue that already is one only moves the stage.
 */
export async function setVenueStage(
  id: string,
  stage: string,
  today: IsoDate,
  opts: WriteOptions = {},
): Promise<Undoable & { becameBooking: boolean }> {
  if (stage === "Booked") {
    const done = await markBooked({ kind: "venue", id }, today, opts);
    if (done.changed) return { undo: done.undo, becameBooking: true };
  }
  const done = await updateWithUndo("venues", id, { status: stage }, opts);
  return { undo: done.undo, becameBooking: false };
}

/**
 * Removes a venue from Venues (guide §5.15, N10). Its files stay in Files. A venue
 * that is a live booking can't be deleted, because the record is the booking and
 * its payments (plan §2.7): it is made a direct booking instead, which leaves the
 * list and stays in the budget. Undo puts the venue back as it was.
 */
export async function removeVenueFromList(id: string, opts: WriteOptions = {}): Promise<Undoable> {
  let name = "";
  const left = await patchWithUndo(
    "venues",
    id,
    (data) => {
      name = String(data.name ?? "");
      const venue = venueFromDoc(id, data);
      if (!isVenueBooked(venue)) return null;
      const mark = venue.booking;
      return { patch: { booking: { on: mark?.on ?? null, from: "direct", removed: false } } };
    },
    opts,
  );
  const done = left.changed ? left : await removeVenue(id, opts);
  void logActivity("venue.removed", { name }, { kind: "venue", id }, opts);
  return { undo: done.undo };
}
