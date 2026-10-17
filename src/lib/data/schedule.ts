"use client";

import { useMemo } from "react";
import { useScheduleEvents } from "@/lib/collections/schedule-events";
import { useTodos } from "@/lib/collections/todos";
import { vendorFromDoc, venueFromDoc, type VendorDoc, type VenueDoc } from "@/lib/data/adapters/bookings";
import type { EventRecord, EventStatus } from "@/lib/model/agenda";
import { bookingsFrom, type Booking } from "@/lib/model/bookings";
import { VENDOR_RULED_OUT, VENUE_RULED_OUT } from "@/lib/model/labels";
import { isListedVendor } from "@/lib/model/search";
import type { TaskRecord } from "@/lib/model/tasks";
import { useCollection } from "@/lib/use-collection";
import { logActivity } from "./activity";
import { mergeStatus, readOf } from "./read";
import { useSession } from "./session";
import type { Loaded } from "./settings";
import { removeWithUndo, updateWithUndo, type Undoable } from "./undo";
import { useFunders } from "./use-funders";
import { create, newId, update, type WriteOptions } from "./write";
import { WriteError } from "./write-error";

const COLLECTION = "scheduleEvents";

export interface ScheduleData {
  events: EventRecord[];
  bookings: Booking[];
  tasks: TaskRecord[];
  /** Funder names by id, for the "paid by" line of a payment. */
  funderNames: ReadonlyMap<string, string>;
  /** The vendor or venue an event is about, by id. */
  related: ReadonlyMap<string, { name: string; kind: "vendor" | "venue" }>;
  /** What "With" offers: vendors and venues we haven't ruled out, as "vendor:<id>" and "venue:<id>". */
  withChoices: { value: string; label: string }[];
}

/**
 * The Schedule's reads (guide §5.19): our own events, the payments due on
 * bookings, tasks with a due date, and the names that go with them. Each is a
 * live listener, so a change from the partner arrives in place. The status is
 * the worst of them.
 */
export function useSchedule(): Loaded<ScheduleData> {
  const { connection } = useSession();
  const events = useScheduleEvents();
  const todos = useTodos();
  const funders = useFunders();
  // No ordering is asked of Firestore, so a record without `createdAt` still arrives.
  const vendors = useCollection<VendorDoc>("vendors", vendorFromDoc, []);
  const venues = useCollection<VenueDoc>("venues", venueFromDoc, []);

  const data = useMemo<ScheduleData | null>(() => {
    if (!funders.data) return null;
    const related = new Map<string, { name: string; kind: "vendor" | "venue" }>();
    for (const v of vendors.data) related.set(v.id, { name: v.name, kind: "vendor" });
    for (const v of venues.data) related.set(v.id, { name: v.name, kind: "venue" });
    const byName = (a: { label: string }, z: { label: string }) => a.label.localeCompare(z.label);
    const withChoices = [
      ...vendors.data
        .filter((v) => isListedVendor(v) && v.contractStatus !== VENDOR_RULED_OUT)
        .map((v) => ({ value: `vendor:${v.id}`, label: v.name }))
        .sort(byName),
      ...venues.data
        .filter((v) => v.status !== VENUE_RULED_OUT)
        .map((v) => ({ value: `venue:${v.id}`, label: `${v.name}, venue` }))
        .sort(byName),
    ];
    return {
      events: events.data,
      bookings: bookingsFrom(vendors.data, venues.data),
      tasks: todos.data,
      funderNames: new Map(funders.data.funders.map((f) => [f.id, f.name])),
      related,
      withChoices,
    };
  }, [events.data, todos.data, funders.data, vendors.data, venues.data]);

  const rest = readOf(connection, [events, todos, vendors, venues], data);
  const status = mergeStatus(funders, rest);
  return { status, data: status === "demo" ? null : data };
}

/** A new event's id, made once per form so Try again never adds two. */
export const newEventId = (opts: WriteOptions = {}) => newId(COLLECTION, opts);

/** The fields an event is stored with; the sheet builds them with `storedEvent`. */
export interface NewEvent {
  title: string;
  type: string;
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  notes: string;
  location: string;
  relatedVendorId: string | null;
  relatedVenueId: string | null;
  reminderMinutes: number[];
}

/**
 * Adds an event (S1) and tells the partner. The fields are the ones the old
 * screens read, so both UIs show it. Undo takes it off again, unless it has been
 * changed since (the partner edited it).
 */
export async function addEvent(id: string, fields: NewEvent, opts: WriteOptions = {}): Promise<Undoable> {
  const date = fields.startAt.slice(0, 10);
  const time = fields.allDay ? null : (fields.startAt.slice(11, 16) || null);
  await create(COLLECTION, { ...fields, status: "scheduled", remindersSent: [] }, { ...opts, id });
  void logActivity("event.added", { name: fields.title, date, time }, { kind: "event", id }, opts);
  return {
    undo: async () => {
      await removeWithUndo(COLLECTION, id, { ...opts, guard: untouchedSince(fields) });
    },
  };
}

/** Undoing an add refuses once the event has been changed, so a partner's edit isn't erased with it. */
function untouchedSince(fields: NewEvent) {
  const written: Record<string, unknown> = { ...fields, status: "scheduled" };
  return (data: Record<string, unknown>) => {
    const keys = ["title", "type", "startAt", "endAt", "allDay", "notes", "location", "status", "relatedVendorId", "relatedVenueId"];
    if (keys.some((key) => data[key] !== written[key])) {
      throw new WriteError("changed", "That event has changed since it was added");
    }
  };
}

/**
 * Saves some of an event's fields (the sheet saves as you go). Changing when it
 * happens, or its reminder, clears what was already sent, so the new reminder
 * can still come.
 */
export function saveEvent(id: string, patch: Record<string, unknown>, opts: WriteOptions = {}): Promise<void> {
  const resets = "startAt" in patch || "reminderMinutes" in patch;
  return update(COLLECTION, id, resets ? { ...patch, remindersSent: [] } : patch, opts);
}

/** Mark completed, Cancel it, Back to scheduled (S2): acts at once, with an undo that puts the status back. */
export function setEventStatus(id: string, status: EventStatus, opts: WriteOptions = {}): Promise<Undoable> {
  return updateWithUndo(COLLECTION, id, { status }, opts);
}

/** Delete (S2): the event goes, with an undo that puts it back exactly. */
export async function deleteEvent(id: string, opts: WriteOptions = {}): Promise<Undoable> {
  return removeWithUndo(COLLECTION, id, opts);
}
