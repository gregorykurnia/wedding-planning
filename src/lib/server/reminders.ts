import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { str, strOrNull } from "@/lib/data/adapters/common";
import type { EventRecord, EventStatus } from "@/lib/model/agenda";
import { PUSH_SUBSCRIPTIONS } from "@/lib/model/push";
import { plannerClock, reminderPush, remindersDue, type DueReminder } from "@/lib/model/reminders";
import { veilHref } from "@/veil/href";
import type { SendPush, StoredSubscription } from "./push";

/**
 * The daily reminder run (S10, N11; plan §2.9, Task 6.2). Vercel Cron calls it
 * once a morning; it can also be called again by hand. Order, per reminder:
 *
 * 1. Claim it: in a transaction, check the event still holds that reminder for
 *    the same day and it isn't in `remindersSent`, then add it there. A second
 *    run at the same time, or a repeat, finds it claimed and sends nothing.
 * 2. Send it to every saved device. A device the push service has forgotten
 *    (404 or 410) loses its subscription.
 * 3. If no device took it and at least one failed for another reason, give the
 *    claim back, so the next morning's run tries again (while the event is
 *    still to come). Nothing is sent twice to a device that did take it.
 *
 * With no devices saved at all, nothing is claimed.
 */
const EVENTS = "scheduleEvents";
const STATUSES: readonly EventStatus[] = ["scheduled", "completed", "cancelled"];

const numbers = (v: unknown): number[] => (Array.isArray(v) ? v.filter((n): n is number => typeof n === "number") : []);

/** A stored event as the model reads it. */
export function eventFromData(id: string, data: Record<string, unknown>): EventRecord {
  return {
    id,
    title: str(data.title),
    type: str(data.type, "other"),
    startAt: str(data.startAt),
    endAt: strOrNull(data.endAt),
    allDay: data.allDay === true,
    notes: str(data.notes),
    location: str(data.location),
    status: STATUSES.includes(data.status as EventStatus) ? (data.status as EventStatus) : "scheduled",
    relatedVendorId: strOrNull(data.relatedVendorId),
    relatedVenueId: strOrNull(data.relatedVenueId),
    reminderMinutes: numbers(data.reminderMinutes),
    remindersSent: numbers(data.remindersSent),
  };
}

export interface RunSummary {
  today: string;
  due: number;
  /** Reminders that reached at least one device. */
  sent: number;
  /** Reminders given back for the next run. */
  retry: number;
  devices: number;
  removedDevices: number;
}

/** The address a reminder opens: the event's sheet in the schedule. */
const eventHref = (id: string) => `${veilHref("/schedule")}?event=${encodeURIComponent(id)}`;

function subscriptionOf(data: Record<string, unknown>): StoredSubscription | null {
  const keys = data.keys as Record<string, unknown> | undefined;
  if (typeof data.endpoint !== "string" || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") return null;
  return { endpoint: data.endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } };
}

/** Claims a reminder for sending; `false` when it's no longer due or another run has it. */
async function claim(db: Firestore, r: DueReminder, today: string, now: string): Promise<boolean> {
  const ref = db.collection(EVENTS).doc(r.event.id);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;
    const current = eventFromData(snap.id, snap.data() ?? {});
    const still = remindersDue([current], today as DueReminder["date"], now).some((d) => d.minutes === r.minutes);
    if (!still) return false;
    tx.update(ref, { remindersSent: FieldValue.arrayUnion(r.minutes) });
    return true;
  });
}

export async function runReminders(db: Firestore, send: SendPush, at: Date = new Date()): Promise<RunSummary> {
  const { today, now } = plannerClock(at);
  const [eventsSnap, subsSnap] = await Promise.all([
    db.collection(EVENTS).where("status", "==", "scheduled").get(),
    db.collection(PUSH_SUBSCRIPTIONS).get(),
  ]);
  const due = remindersDue(
    eventsSnap.docs.map((d) => eventFromData(d.id, d.data())),
    today,
    now,
  );
  const devices = subsSnap.docs.flatMap((d) => {
    const sub = subscriptionOf(d.data());
    return sub ? [{ ref: d.ref, sub }] : [];
  });
  const summary: RunSummary = { today, due: due.length, sent: 0, retry: 0, devices: devices.length, removedDevices: 0 };
  if (!due.length || !devices.length) return summary;

  const gone = new Set<string>();
  for (const r of due) {
    const live = devices.filter((d) => !gone.has(d.ref.path));
    // Every device turned out forgotten: leave the rest unclaimed, so a device
    // saved again before the next morning's run still gets them.
    if (!live.length) break;
    if (!(await claim(db, r, today, now))) continue;
    const payload = JSON.stringify(reminderPush(r, today, eventHref));
    const results = await Promise.all(live.map((d) => send(d.sub, payload)));
    results.forEach((result, i) => result === "gone" && gone.add(live[i].ref.path));
    if (results.includes("sent")) summary.sent++;
    else {
      // No device took it (failed, or every one forgotten): give it back.
      await db
        .collection(EVENTS)
        .doc(r.event.id)
        .update({ remindersSent: FieldValue.arrayRemove(r.minutes) });
      summary.retry++;
    }
  }
  const removals = devices.filter((d) => gone.has(d.ref.path));
  await Promise.all(removals.map((d) => d.ref.delete()));
  summary.removedDevices = removals.length;
  return summary;
}
