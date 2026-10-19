import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

/**
 * The prototype's own data sets (`redesign/design/prototype/assets/data*.js`),
 * so the fixtures hold exactly what the prototype's screens show and a preview
 * can be set beside them. Each file is a browser script that adds to
 * `window.VEIL_DATA`, so they are run in order in a sandbox with a fake
 * `window`. Money is whole rupiah, dates are `YYYY-MM-DD`, and the prototype's
 * "today" is `TODAY` (14 October 2026).
 */

export interface ProtoFile {
  name: string;
  size: string;
  type: string;
  src?: string;
  fromVendor?: boolean;
}

export interface ProtoPart {
  id: string;
  name: string;
  price: number;
  paid: number;
  funder: string | null;
  due: string | null;
  step: string;
}

export interface ProtoBooking {
  id: string;
  name: string;
  category: string;
  origin: { from: "vendor" | "venue" | "direct"; on: string | null };
  estimate: number | null;
  files: ProtoFile[];
  /** A booking in parts has `parts`; one without has its own money. */
  parts?: ProtoPart[];
  price?: number;
  paid?: number;
  funder?: string | null;
  due?: string | null;
  step?: string;
}

export interface ProtoWhatIf {
  id: string;
  name: string;
  category: string;
  price?: number;
  funder?: string | null;
  parts?: { id: string; name: string; price: number; funder: string | null }[];
}

export interface ProtoVendor {
  id: string;
  name: string;
  category: string;
  contact: string;
  phone: string;
  stage: "noted" | "asking" | "considering" | "chosen" | "done" | "out";
  rating: number | null;
  reviewers: number | null;
  keen: boolean;
  added: string;
  prices: { id: string; name: string; price: number; includes: string; preferred: boolean }[];
  notes: string;
  files: ProtoFile[];
}

export interface ProtoPackage {
  id: string;
  name: string;
  price: number;
  includes: string;
  reviews: number | null;
  step: string;
  notes: string;
  files: ProtoFile[];
  preferred?: boolean;
}

export interface ProtoFinalist {
  id: string;
  vendor: string | null;
  name: string;
  category: string;
  contact: string;
  phone: string;
  reviews: number | null;
  followers: number | null;
  step: string;
  notes: string;
  moved?: string;
  packages: ProtoPackage[];
  files: ProtoFile[];
}

export interface ProtoVenue {
  id: string;
  name: string;
  location: string;
  cost: number | null;
  capacity: number | null;
  stage: "noted" | "contacted" | "visited" | "booked" | "out";
  notes: string;
  files: ProtoFile[];
}

export interface ProtoEvent {
  id: string;
  title: string;
  kind: string;
  date: string;
  start: string | null;
  end: string | null;
  allDay: boolean;
  related: string | null;
  where: string;
  notes: string;
  remind: string;
  status: "scheduled" | "completed" | "cancelled";
}

export interface ProtoTask {
  id: string;
  title: string;
  due: string | null;
  notes: string;
  done: boolean;
  doneOn?: string | null;
  steps: { id: string; title: string; due: string | null; done: boolean }[];
}

export interface ProtoGuest {
  no: number;
  name: string;
  country: string;
  conn: string;
  invite: "both" | "ceremony" | "reception" | "maybe" | "unsure";
  sent: boolean;
  rsvp: "waiting" | "yes" | "no";
  plus: number;
  food: string;
}

export interface ProtoItem {
  id: string;
  name: string;
  vendor: string | null;
  events: string[];
  people: string[];
  confirmed: boolean;
  next: boolean;
}

export interface ProtoDoc {
  id: string;
  title: string;
  /** Local date and time, `YYYY-MM-DDTHH:mm`. */
  updated: string;
  by: string;
  html: string;
}

export interface ProtoFolder {
  id: string;
  name: string;
  parent: string | null;
}

export interface ProtoStoredFile {
  id: string;
  name: string;
  folder: string | null;
  /** Megabytes. */
  size: number;
  date: string;
  category: string;
  desc: string;
  type: string;
  src?: string;
}

export interface ProtoSet {
  couple: [string, string];
  me: { name: string; email: string };
  partner: string;
  wedding: string;
  since: string;
  partnerEmail: string;
  funders: { id: string; name: string }[];
  categories: string[];
  bookings: ProtoBooking[];
  whatifs: ProtoWhatIf[];
  vendorCats: { name: string; own: boolean; catchall?: boolean }[];
  vendors: ProtoVendor[];
  finalists: ProtoFinalist[];
  venues: ProtoVenue[];
  events: ProtoEvent[];
  tasks: ProtoTask[];
  guests: ProtoGuest[];
  items: ProtoItem[];
  docs: ProtoDoc[];
  folders: ProtoFolder[];
  files: ProtoStoredFile[];
}

export interface PrototypeSets {
  NORMAL: ProtoSet;
  STRESS: ProtoSet;
  EMPTY: ProtoSet;
  TODAY: string;
}

const SCRIPTS = ["data.js", "data-vendors.js", "data-schedule.js", "data-guests.js", "data-items.js", "data-docs.js", "data-files.js"];

let loaded: PrototypeSets | undefined;

export function prototypeSets(): PrototypeSets {
  if (loaded) return loaded;
  const dir = join(process.cwd(), "redesign", "design", "prototype", "assets");
  const window: { VEIL_DATA?: unknown } = {};
  const sandbox = vm.createContext({ window, encodeURIComponent });
  for (const name of SCRIPTS) {
    let source: string;
    try {
      source = readFileSync(join(dir, name), "utf8");
    } catch (err) {
      throw new Error(`The fixtures are built from the prototype's data sets, and ${join(dir, name)} can't be read. Run from the repo root.`, { cause: err });
    }
    vm.runInContext(source, sandbox, { filename: name });
  }
  // The sets were made in the sandbox's realm; a JSON round trip brings them into this one
  // (and drops the prototype's helper functions), so the Admin SDK sees plain objects.
  loaded = JSON.parse(JSON.stringify(window.VEIL_DATA)) as PrototypeSets;
  return loaded;
}
