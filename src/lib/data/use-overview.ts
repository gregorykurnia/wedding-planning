"use client";

import { useMemo } from "react";
import { useGuests } from "@/lib/collections/guests";
import { useMasterListItems } from "@/lib/collections/master-list";
import { useScheduleEvents } from "@/lib/collections/schedule-events";
import { useTodos } from "@/lib/collections/todos";
import { venueFromDoc, vendorFromDoc, type VendorDoc, type VenueDoc } from "@/lib/data/adapters/bookings";
import { bookingsFrom, type Booking } from "@/lib/model/bookings";
import type { EventRecord } from "@/lib/model/agenda";
import type { GuestRecord } from "@/lib/model/guests";
import { OTHER_CATEGORY } from "@/lib/model/categories";
import type { ItemRecord } from "@/lib/model/items";
import type { TaskRecord } from "@/lib/model/tasks";
import { useCollection } from "@/lib/use-collection";
import type { WeddingSettings } from "@/lib/types";
import { mergeStatus, readOf } from "./read";
import { useSession } from "./session";
import { useSettings, type Loaded } from "./settings";
import { useFunders } from "./use-funders";

export interface OverviewData {
  settings: WeddingSettings;
  events: EventRecord[];
  bookings: Booking[];
  tasks: TaskRecord[];
  guests: GuestRecord[];
  items: ItemRecord[];
  /** Funder names by id, for the "paid by" line of a payment. */
  funderNames: ReadonlyMap<string, string>;
  /** The vendor or venue an event is about, by id. */
  related: ReadonlyMap<string, { name: string; kind: "vendor" | "venue" }>;
}

/**
 * Everything the overview reads (plan §4): the settings, and the sources of
 * "coming up" and the four doors. Each is a live listener, so a change from
 * the partner arrives in place. The status is the worst of them all.
 */
export function useOverview(): Loaded<OverviewData> {
  const { connection } = useSession();
  const settings = useSettings();
  const funders = useFunders();
  const events = useScheduleEvents();
  const todos = useTodos();
  const guests = useGuests();
  const masterList = useMasterListItems();
  // No ordering is asked of Firestore, so a record without `createdAt` still arrives.
  const vendors = useCollection<VendorDoc>("vendors", vendorFromDoc, []);
  const venues = useCollection<VenueDoc>("venues", venueFromDoc, []);

  const data = useMemo<OverviewData | null>(() => {
    if (!settings.data || !funders.data) return null;
    const related = new Map<string, { name: string; kind: "vendor" | "venue" }>();
    for (const v of vendors.data) related.set(v.id, { name: v.name, kind: "vendor" });
    for (const v of venues.data) related.set(v.id, { name: v.name, kind: "venue" });
    return {
      settings: settings.data,
      events: events.data,
      bookings: bookingsFrom(vendors.data, venues.data),
      tasks: todos.data,
      guests: guests.data,
      items: masterList.data.map((i) => ({ ...i, category: i.category || OTHER_CATEGORY })),
      funderNames: new Map(funders.data.funders.map((f) => [f.id, f.name])),
      related,
    };
  }, [settings.data, funders.data, events.data, todos.data, guests.data, masterList.data, vendors.data, venues.data]);

  const rest = readOf(connection, [events, todos, guests, masterList, vendors, venues], data);
  const status = mergeStatus(settings, funders, rest);
  return { status, data: status === "demo" ? null : data };
}
