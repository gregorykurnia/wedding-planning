/**
 * Live partner changes (guide §6.3, A2): the words of the partner toast, which
 * removals mean "this is gone", and who counts as being in a document. Pure:
 * `activity` entries only carry `kind` and `params` (src/lib/data/activity.ts),
 * and the sentence is built here.
 */

import type { IsoDate } from "./bookings";
import { dateLong, daysUntil, isIsoDate } from "./dates";
import { rp } from "./format";

/** The heartbeat while a document is open (guide §6.3, plan Task 2.7). */
export const PRESENCE_HEARTBEAT_MS = 20_000;
/** A heartbeat younger than this means "also here"; a closed laptop drops out. */
export const PRESENCE_FRESH_MS = 45_000;

export type EntryParams = Record<string, string | number | boolean | null>;

const text = (params: EntryParams, key: string): string | null => {
  const value = params[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
};

const quoted = (name: string | null) => (name ? `“${name}”` : "something");

/** "today" · "tomorrow" · "Friday 30 October", then " at 10:00" when there is a time. */
function whenText(params: EntryParams, today: IsoDate): string {
  const date = text(params, "date");
  const time = text(params, "time");
  let day = "";
  if (date && isIsoDate(date)) {
    const n = daysUntil(date, today);
    day = n === 0 ? "today" : n === 1 ? "tomorrow" : dateLong(date, today);
  }
  return [day, time ? `at ${time}` : ""].filter(Boolean).join(" ");
}

const REPLIES: Record<string, string> = { yes: "attending", no: "not attending", pending: "waiting" };

/**
 * The partner toast, as one sentence that starts with the partner's name, or
 * `null` for a kind with no toast (removals, and kinds this version doesn't
 * know: better silent than wrong).
 */
export function partnerToast(
  partner: string,
  kind: string,
  params: EntryParams,
  today: IsoDate,
): string | null {
  const name = text(params, "name");
  const plain = name ?? "something";
  switch (kind) {
    case "payment.recorded": {
      const amount = typeof params.amount === "number" ? rp(params.amount) : "a payment";
      return `${partner} recorded ${amount}${name ? ` for ${name}` : ""}`;
    }
    case "booking.added":
    case "vendor.added":
    case "venue.added":
      return `${partner} added ${plain}`;
    case "vendor.booked":
    case "venue.booked":
    case "finalist.booked":
      return `${partner} booked ${plain}`;
    case "booking.split":
      return `${partner} split ${plain} into parts`;
    case "finalist.added":
      return `${partner} added ${plain} to the shortlist`;
    case "whatif.added":
      return `${partner} added ${quoted(name)}`;
    case "document.added":
      return `${partner} started ${quoted(name)}`;
    case "file.uploaded":
      return `${partner} uploaded ${plain}`;
    case "event.added": {
      const when = whenText(params, today);
      return `${partner} added ${quoted(name)}${when ? ` ${when}` : ""}`;
    }
    case "task.finished":
      return `${partner} finished ${quoted(name)}`;
    case "guest.replied": {
      const reply = REPLIES[text(params, "reply") ?? ""] ?? "waiting";
      return `${partner} marked ${plain} as ${reply}`;
    }
    case "item.confirmed":
      return `${partner} confirmed ${plain}`;
    default:
      return null;
  }
}

/** The kind of device a change was made on, which the toast names ("your other phone"). */
export type DeviceKind = "phone" | "computer";

/**
 * The toast for a change you made on your other phone or computer (N3): "You
 * recorded Rp 55.500.000 for Dapur Lestari Catering on your other phone".
 * `null` for the kinds with no toast, as for the partner's.
 */
export function ownToast(kind: string, params: EntryParams, today: IsoDate, device: DeviceKind): string | null {
  const sentence = partnerToast("You", kind, params, today);
  return sentence && `${sentence} on your other ${device}`;
}

/** Removals are not toasts: they only matter to someone looking at the record. */
export const isRemoval = (kind: string) => /\.(removed|deleted)$/.test(kind);

export interface EntryTarget {
  kind: string;
  id: string;
  partId?: string;
}

/**
 * What to flash for an entry: a part flashes with the booking it belongs to,
 * so the part's row and the booking's card both light up.
 */
export function flashTargets(target: EntryTarget | null): EntryTarget[] {
  if (!target) return [];
  return target.partId ? [target, { kind: target.kind, id: target.id }] : [target];
}

/** Whether a removal entry is about the record someone is looking at. */
export const removes = (
  entry: { kind: string; target: EntryTarget | null },
  record: EntryTarget,
): boolean =>
  isRemoval(entry.kind) &&
  entry.target !== null &&
  entry.target.kind === record.kind &&
  entry.target.id === record.id;

export interface PresenceEntry {
  uid: string;
  at: number | null;
}

/**
 * "Bella is also in this document": another account with a fresh heartbeat.
 * Fresh is measured against this account's own latest heartbeat in the same
 * entries, a server time like theirs, so a device clock that runs fast or slow
 * doesn't matter. `now` (the device clock) stands in only until this account's
 * first heartbeat has landed.
 */
export function partnerIsHere(entries: PresenceEntry[], myUid: string | null, now: number): boolean {
  const mine = entries
    .filter((e) => e.uid === myUid && e.at !== null)
    .reduce<number | null>((latest, e) => Math.max(latest ?? -Infinity, e.at!), null);
  const reference = mine ?? now;
  return entries.some(
    (e) => e.uid !== "" && e.uid !== myUid && e.at !== null && reference - e.at < PRESENCE_FRESH_MS,
  );
}

/** One snapshot of the latest activity entries, as the news tracker reads it. */
export interface ActivitySnapshot {
  /** From the local cache, before the server has answered. */
  fromCache: boolean;
  /** Entries this snapshot added, by id. */
  added: string[];
}

/**
 * Which activity entries are news (Phase 2 review S3). Everything in the first
 * snapshot from the server was there before this device was looking, so it is
 * taken as seen; after that, each entry the server adds is news, once. No
 * device clock is compared with the server's times, so a clock that runs fast
 * or slow neither replays old changes nor drops new ones.
 */
export function activityNews(): (snapshot: ActivitySnapshot) => string[] {
  let settled = false;
  const seen = new Set<string>();
  return ({ fromCache, added }) => {
    if (!settled) {
      added.forEach((id) => seen.add(id));
      if (!fromCache) settled = true;
      return [];
    }
    const fresh = added.filter((id) => !seen.has(id));
    fresh.forEach((id) => seen.add(id));
    return fresh;
  };
}

/** More partner toasts than this at once (a long offline spell, a tab left asleep) become one (P5-S26). */
export const NEWS_BURST = 3;

/**
 * "Bella made 12 changes. Everything here is up to date." in place of 12 toasts at once, and
 * "You made 4 changes on another device. …" for your own (N3). Not in the guide; provisional (G41/N41).
 */
export function burstToast(who: string, count: number, own: boolean): string {
  return own
    ? `You made ${count} changes on another device. Everything here is up to date.`
    : `${who} made ${count} changes. Everything here is up to date.`;
}

/**
 * Toasts arriving together, merged: when more than `NEWS_BURST` of the partner's (or of your other
 * device's) have words, those lose them and one summary takes the place of the first. Flashes stay
 * on every item; the order is kept.
 */
export function mergeNewsBurst<T extends { id: string; name: string; own: boolean; text: string | null; flash: unknown[] }>(
  news: readonly T[],
  summary: (first: T, count: number) => string,
): T[] {
  let out = [...news];
  for (const own of [false, true]) {
    const worded = out.filter((n) => n.own === own && n.text);
    if (worded.length <= NEWS_BURST) continue;
    const first = worded[0];
    out = out.flatMap((n) => {
      if (n.own !== own || !n.text) return [n];
      const quiet = { ...n, text: null };
      return n === first ? [{ ...n, id: `${n.id}-burst`, text: summary(first, worded.length), flash: [] }, quiet] : [quiet];
    });
  }
  return out;
}
