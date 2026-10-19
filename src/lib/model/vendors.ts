/**
 * The Vendors list (guide §5.11; F6, F9, F11, F12, F15): a vendor as a row needs
 * it, the list in view (filter, then order, then a page), the category headings
 * and the spreadsheet of the vendors in view.
 *
 * Pure: the data hook reads the documents and hands plain values in.
 */
import { localIso } from "./dates";
import { toCsv, type CsvColumn } from "./csv";
import { focusCategories } from "./categories";
import { rp } from "./format";
import { vendorStageLabel } from "./labels";
import { orderVendors, paging, type Direction, type VendorOrderKey } from "./order";
import { filterVendors, type VendorFilter } from "./search";
import { waHref } from "./whatsapp";

/** What the list reads from a stored vendor (the data layer's `VendorDoc` has all of it). */
export interface VendorSource {
  id: string;
  name: string;
  category: string;
  contractStatus: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  keen: boolean;
  rating: number | null;
  reviewers: number | null;
  priceOptions: readonly { description: string; price: number; selected: boolean; includes?: string }[];
  createdAt: number | null;
}

/** A vendor as the list, the filters, the order and the spreadsheet use it. */
export interface VendorListItem {
  id: string;
  name: string;
  category: string;
  contactName: string;
  contactPhone: string;
  notes: string;
  contractStatus: string;
  /** Keen on it. The model's filters and orders call it `starred`. */
  starred: boolean;
  /** Out of five; a rating of 0 was cleared, so it is `null` here. */
  bridestoryRating: number | null;
  bridestoryReviewCount: number | null;
  createdAt: number | null;
  /** Every price option, in the order they were added. */
  options: { description: string; price: number; leaning: boolean; includes: string }[];
  /** The option we're leaning towards, if one is chosen. */
  leaning: { description: string; price: number } | null;
  /** The row's price: the option we lean towards, else the first one; `null` when there is none or it is 0. */
  price: number | null;
  optionCount: number;
  /** A booking was made from it (the Booked column). */
  booked: boolean;
  fileCount: number;
  /** The finalist that is this vendor on the shortlist, if there is one. */
  finalistId: string | null;
}

export interface VendorExtras {
  booked: boolean;
  fileCount: number;
  finalistId: string | null;
}

export function vendorListItem(v: VendorSource, extras: VendorExtras): VendorListItem {
  const options = v.priceOptions.map((o) => ({
    description: o.description,
    price: o.price,
    leaning: o.selected,
    includes: o.includes ?? "",
  }));
  const leaning = options.find((o) => o.leaning) ?? null;
  const shown = leaning ?? options[0] ?? null;
  return {
    id: v.id,
    name: v.name,
    category: v.category,
    contactName: v.contactName,
    contactPhone: v.contactPhone,
    notes: v.notes,
    contractStatus: v.contractStatus,
    starred: v.keen,
    bridestoryRating: v.rating != null && v.rating > 0 ? v.rating : null,
    bridestoryReviewCount: v.reviewers,
    createdAt: v.createdAt,
    options,
    leaning: leaning ? { description: leaning.description, price: leaning.price } : null,
    price: shown && shown.price > 0 ? shown.price : null,
    optionCount: options.length,
    ...extras,
  };
}

/** How many vendors we're keen on, for the line under the title. */
export const keenCount = (vendors: readonly { starred: boolean }[]) => vendors.filter((v) => v.starred).length;

export interface VendorView {
  /** The vendors that match, in order. */
  rows: VendorListItem[];
  /** How many of them the page shows. */
  shown: number;
  /** How many more the next page adds. */
  more: number;
}

/** The list in view: the filter, then the order (blanks last), then the first `shown` rows. */
export function vendorView(
  vendors: readonly VendorListItem[],
  filter: VendorFilter,
  order: { key: VendorOrderKey; direction: Direction },
  categories: readonly string[],
  shown: number,
  step: number,
): VendorView {
  const rows = orderVendors(filterVendors(vendors, filter), order.key, order.direction, categories);
  const page = paging(rows.length, shown, step);
  return { rows, shown: page.visible, more: page.more };
}

export interface CategoryGroup {
  category: string;
  /** Every vendor in this category among the matches, not only the ones on the page. */
  count: number;
  rows: VendorListItem[];
}

/**
 * The page's rows under their category headings, in the order the rows run.
 * Each heading's count is the whole category in the matches, so "Catering, 12
 * vendors" stays true while only the first page of it shows.
 */
export function groupByCategory(matches: readonly VendorListItem[], page: readonly VendorListItem[]): CategoryGroup[] {
  const totals = new Map<string, number>();
  for (const v of matches) totals.set(v.category, (totals.get(v.category) ?? 0) + 1);
  const groups: CategoryGroup[] = [];
  for (const v of page) {
    const last = groups[groups.length - 1];
    if (last && last.category === v.category) last.rows.push(v);
    else groups.push({ category: v.category, count: totals.get(v.category) ?? 0, rows: [v] });
  }
  return groups;
}

/** The focus chips: every category that holds a vendor, with its count. */
export const vendorFocus = (categories: readonly string[], vendors: readonly VendorListItem[]) =>
  focusCategories(categories, vendors);

// ---------- the spreadsheet (N5, guide §5.11) ----------

/** Plain whole rupiah, no "Rp" and no dots, so a spreadsheet sums it. */
const plainAmount = (n: number) => String(Math.round(n));

const yesNo = (value: boolean) => (value ? "Yes" : "No");

/** "Gold, 400 guests: Rp 161.000.000 (Buffet, 7 dishes)", what it includes left out when nothing's written. */
const optionCell = (o: VendorListItem["options"][number]) =>
  `${o.description}: ${rp(o.price)}${o.includes.trim() ? ` (${o.includes.trim()})` : ""}`;

/**
 * The columns, named the way the planner names them and in the order of the vendor
 * screen. Empty fields are empty cells, never "No rating yet"; ratings use a
 * decimal point and dates are year-month-day.
 */
export const VENDOR_COLUMNS: readonly CsvColumn<VendorListItem>[] = [
  { header: "Name", value: (v) => v.name },
  { header: "Category", value: (v) => v.category },
  { header: "Stage", value: (v) => vendorStageLabel(v.contractStatus) },
  { header: "Keen on", value: (v) => yesNo(v.starred) },
  { header: "Contact person", value: (v) => v.contactName },
  { header: "Phone", value: (v) => v.contactPhone },
  { header: "WhatsApp", value: (v) => waHref(v.contactPhone) ?? "" },
  { header: "Rating (out of 5)", value: (v) => v.bridestoryRating ?? "" },
  { header: "Number of reviewers", value: (v) => v.bridestoryReviewCount ?? "" },
  { header: "Leaning towards", value: (v) => v.leaning?.description ?? "" },
  { header: "Its price (Rp)", value: (v) => (v.leaning ? plainAmount(v.leaning.price) : "") },
  { header: "Price options", value: (v) => v.optionCount },
  { header: "All price options", value: (v) => v.options.map(optionCell).join("; ") },
  { header: "On the shortlist", value: (v) => yesNo(v.finalistId !== null) },
  { header: "Booked", value: (v) => yesNo(v.booked) },
  { header: "Files", value: (v) => v.fileCount },
  { header: "Notes", value: (v) => v.notes },
  { header: "Date added", value: (v) => (v.createdAt === null ? "" : localIso(new Date(v.createdAt))) },
];

/** UTF-8 with a byte-order mark, every cell quoted, Windows line endings. */
export const vendorsCsv = (rows: readonly VendorListItem[]) => toCsv(VENDOR_COLUMNS, rows, { quoteAll: true });
