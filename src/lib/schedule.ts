import type { Vendor, Venue } from "@/lib/types";

export interface ConfirmedPaymentReminder {
  id: string;
  title: string;
  detail: string;
  date: string;
  amount: number;
  href: string;
}

function entryTotals(entries: { totalPrice: number; budgetSpent: number }[]) {
  return {
    totalPrice: entries.reduce((sum, entry) => sum + entry.totalPrice, 0),
    budgetSpent: entries.reduce((sum, entry) => sum + entry.budgetSpent, 0),
  };
}

/** Builds the same real payment reminders shown on Confirmed, for reuse on Schedule and Dashboard. */
export function buildConfirmedPaymentReminders(
  venues: Venue[],
  vendors: Vendor[],
): ConfirmedPaymentReminder[] {
  const bookedVenue = venues.find((venue) => venue.status === "Booked");
  const confirmedVendors = vendors.filter(
    (vendor) => vendor.contractStatus === "Chosen" || vendor.contractStatus === "Done",
  );

  const rows = [
    ...(bookedVenue
      ? [
          {
            kind: "venue" as const,
            id: bookedVenue.id,
            name: bookedVenue.name,
            detail: "Venue",
            nextTargetDate: bookedVenue.nextTargetDate,
            subEntries: bookedVenue.subEntries,
            totals:
              bookedVenue.subEntries.length > 0
                ? entryTotals(bookedVenue.subEntries)
                : { totalPrice: bookedVenue.budgetEstimate, budgetSpent: bookedVenue.budgetSpent },
          },
        ]
      : []),
    ...confirmedVendors.map((vendor) => ({
      kind: "vendor" as const,
      id: vendor.id,
      name: vendor.name,
      detail: vendor.confirmedType,
      nextTargetDate: vendor.nextTargetDate,
      subEntries: vendor.subEntries,
      totals:
        vendor.subEntries.length > 0
          ? entryTotals(vendor.subEntries)
          : { totalPrice: vendor.totalPrice, budgetSpent: vendor.budgetSpent },
    })),
  ];

  return rows
    .flatMap((row) => {
      if (row.subEntries.length > 0) {
        return row.subEntries.map((entry) => ({
          id: `${row.kind}-${row.id}-${entry.id}`,
          title: entry.name,
          detail: row.name,
          date: entry.nextTargetDate,
          amount: Math.max(entry.totalPrice - entry.budgetSpent, 0),
        }));
      }

      return [
        {
          id: `${row.kind}-${row.id}`,
          title: row.name,
          detail: row.detail,
          date: row.nextTargetDate,
          amount: Math.max(row.totals.totalPrice - row.totals.budgetSpent, 0),
        },
      ];
    })
    .filter(
      (reminder): reminder is typeof reminder & { date: string } =>
        typeof reminder.date === "string" && reminder.date.length > 0 && reminder.amount > 0,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((reminder) => ({ ...reminder, href: "/confirmed" }));
}

export function parseScheduleDate(value: string) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

export function localDateKey(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatScheduleDate(value: string, allDay = false) {
  const date = parseScheduleDate(value);
  if (Number.isNaN(date.getTime())) return "Date not set";

  const dateLabel = new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);

  if (allDay || /^\d{4}-\d{2}-\d{2}$/.test(value)) return dateLabel;

  return `${dateLabel} · ${new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date)}`;
}
