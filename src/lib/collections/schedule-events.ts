"use client";

import type { DocumentData } from "firebase/firestore";
import { orderBy } from "firebase/firestore";
import {
  addDocument,
  deleteDocument,
  timestampToMillis,
  updateDocument,
  useCollection,
} from "@/lib/use-collection";
import type {
  ScheduleEvent,
  ScheduleEventStatus,
  ScheduleEventType,
} from "@/lib/types";

const COLLECTION = "scheduleEvents";

const EVENT_TYPES: ScheduleEventType[] = [
  "vendor_call",
  "appointment",
  "payment",
  "deadline",
  "other",
];

const EVENT_STATUSES: ScheduleEventStatus[] = ["scheduled", "completed", "cancelled"];

function fromDoc(id: string, data: DocumentData): ScheduleEvent {
  return {
    id,
    title: data.title ?? "",
    type: EVENT_TYPES.includes(data.type) ? data.type : "other",
    startAt: typeof data.startAt === "string" ? data.startAt : "",
    endAt: typeof data.endAt === "string" ? data.endAt : null,
    allDay: data.allDay === true,
    notes: data.notes ?? "",
    location: data.location ?? "",
    status: EVENT_STATUSES.includes(data.status) ? data.status : "scheduled",
    relatedVendorId: typeof data.relatedVendorId === "string" ? data.relatedVendorId : null,
    relatedVenueId: typeof data.relatedVenueId === "string" ? data.relatedVenueId : null,
    reminderMinutes: Array.isArray(data.reminderMinutes)
      ? data.reminderMinutes.filter((value: unknown): value is number => typeof value === "number")
      : [],
    createdAt: timestampToMillis(data.createdAt),
    updatedAt: timestampToMillis(data.updatedAt),
  };
}

export type ScheduleEventDraft = Omit<ScheduleEvent, "id" | "createdAt" | "updatedAt">;

export function useScheduleEvents() {
  return useCollection<ScheduleEvent>(COLLECTION, fromDoc, [orderBy("startAt", "asc")]);
}

export function createScheduleEvent(data: ScheduleEventDraft) {
  return addDocument(COLLECTION, data as unknown as Record<string, unknown>);
}

export function updateScheduleEvent(id: string, data: Partial<ScheduleEvent>) {
  const { id: _id, ...rest } = data as ScheduleEvent;
  void _id;
  return updateDocument(COLLECTION, id, rest);
}

export function deleteScheduleEvent(id: string) {
  return deleteDocument(COLLECTION, id);
}
