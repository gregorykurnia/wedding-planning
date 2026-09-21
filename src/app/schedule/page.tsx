"use client";

import Link from "next/link";
import { useMemo, useState, type FormEvent } from "react";
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  ExternalLink,
  Grid2X2,
  List,
  MapPin,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  createScheduleEvent,
  deleteScheduleEvent,
  updateScheduleEvent,
  useScheduleEvents,
  type ScheduleEventDraft,
} from "@/lib/collections/schedule-events";
import { useTodos } from "@/lib/collections/todos";
import { useVendors } from "@/lib/collections/vendors";
import { useVenues } from "@/lib/collections/venues";
import {
  buildConfirmedPaymentReminders,
  formatScheduleDate,
  isValidScheduleInput,
  localDateKey,
  parseScheduleDate,
  parseScheduleInput,
} from "@/lib/schedule";
import type { ScheduleEvent, ScheduleEventStatus, ScheduleEventType } from "@/lib/types";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<ScheduleEventType | "task", string> = {
  vendor_call: "Vendor / WO call",
  appointment: "Appointment",
  payment: "Payment",
  deadline: "Deadline",
  task: "To Do",
  other: "Other",
};

type DisplayFilter = "all" | "manual" | ScheduleEventType | "task";

const TYPE_FILTERS: { value: DisplayFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "payment", label: "Payments" },
  { value: "task", label: "To Do" },
  { value: "vendor_call", label: "Vendor calls" },
  { value: "appointment", label: "Appointments" },
  { value: "deadline", label: "Deadlines" },
  { value: "manual", label: "Manual events" },
  { value: "other", label: "Other" },
];

const REMINDER_OPTIONS = [
  { value: "0", label: "No reminder" },
  { value: "15", label: "15 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
];

type DisplaySource = "manual" | "payment" | "todo";
type ViewMode = "agenda" | "month";
type AgendaGroup = "Overdue" | "Today" | "Tomorrow" | "Next 7 days" | "Upcoming" | "Completed";

interface DisplayItem {
  id: string;
  title: string;
  type: ScheduleEventType | "task";
  startAt: string;
  endAt: string | null;
  allDay: boolean;
  notes: string;
  location: string;
  status: ScheduleEventStatus;
  source: DisplaySource;
  relatedLabel: string | null;
  relatedHref: string | null;
  amount: number | null;
  href: string | null;
  event: ScheduleEvent | null;
}

function localDateTimeValue(date = new Date()) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function emptyDraft(): ScheduleEventDraft {
  const start = new Date();
  start.setMinutes(start.getMinutes() + 60);
  return {
    title: "",
    type: "vendor_call",
    startAt: localDateTimeValue(start),
    endAt: null,
    allDay: false,
    notes: "",
    location: "",
    status: "scheduled",
    relatedVendorId: null,
    relatedVenueId: null,
    reminderMinutes: [60],
  };
}

function draftFromEvent(event: ScheduleEvent): ScheduleEventDraft {
  return {
    title: event.title,
    type: event.type,
    startAt: event.startAt,
    endAt: event.endAt,
    allDay: event.allDay,
    notes: event.notes,
    location: event.location,
    status: event.status,
    relatedVendorId: event.relatedVendorId,
    relatedVenueId: event.relatedVenueId,
    reminderMinutes: event.reminderMinutes,
  };
}

function relatedValue(draft: ScheduleEventDraft) {
  if (draft.relatedVendorId) return `vendor:${draft.relatedVendorId}`;
  if (draft.relatedVenueId) return `venue:${draft.relatedVenueId}`;
  return "none";
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function shiftDays(date: Date, amount: number) {
  const shifted = new Date(date);
  shifted.setDate(shifted.getDate() + amount);
  return startOfDay(shifted);
}

function shiftMonth(date: Date, amount: number) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function getAgendaGroup(item: DisplayItem, anchorDate: Date): AgendaGroup {
  if (item.status === "completed" || item.status === "cancelled") return "Completed";

  const itemDate = parseScheduleDate(item.startAt);
  if (Number.isNaN(itemDate.getTime())) return "Upcoming";

  const anchorKey = localDateKey(anchorDate);
  const itemKey = localDateKey(itemDate);
  if (itemKey < anchorKey) return "Overdue";
  if (itemKey === anchorKey) return "Today";

  const tomorrowKey = localDateKey(shiftDays(anchorDate, 1));
  if (itemKey === tomorrowKey) return "Tomorrow";

  if (itemKey <= localDateKey(shiftDays(anchorDate, 7))) return "Next 7 days";
  return "Upcoming";
}

function formatTimeRange(item: DisplayItem) {
  if (item.allDay) return "All day";
  const start = parseScheduleDate(item.startAt);
  if (Number.isNaN(start.getTime())) return "Time not set";
  const timeFormatter = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  });
  const startLabel = timeFormatter.format(start);
  if (!item.endAt) return startLabel;
  const end = parseScheduleDate(item.endAt);
  if (Number.isNaN(end.getTime())) return startLabel;
  return `${startLabel}–${timeFormatter.format(end)}`;
}

function formatDayHeading(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatMonthHeading(date: Date) {
  return new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function itemIcon(item: DisplayItem) {
  if (item.type === "payment") return <CalendarClock className="size-4" />;
  if (item.type === "task") return <Check className="size-4" />;
  if (item.type === "vendor_call") return <Clock3 className="size-4" />;
  if (item.type === "deadline") return <CircleAlert className="size-4" />;
  return <CalendarDays className="size-4" />;
}

function EventDialog({
  open,
  onOpenChange,
  event,
  vendors,
  venues,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: ScheduleEvent | null;
  vendors: { id: string; name: string }[];
  venues: { id: string; name: string }[];
}) {
  const [draft, setDraft] = useState<ScheduleEventDraft>(() =>
    event ? draftFromEvent(event) : emptyDraft(),
  );
  const [error, setError] = useState<string | null>(null);

  const setField = <K extends keyof ScheduleEventDraft>(field: K, value: ScheduleEventDraft[K]) => {
    setDraft((current) => ({ ...current, [field]: value }));
  };

  async function handleSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    setError(null);

    if (!draft.title.trim()) {
      setError("Add a title so this item is easy to find in the agenda.");
      return;
    }
    if (!draft.startAt) {
      setError("Choose a date for this item.");
      return;
    }

    const startAt = draft.allDay ? draft.startAt.slice(0, 10) : draft.startAt;
    if (!isValidScheduleInput(startAt, draft.allDay)) {
      setError(draft.allDay ? "Enter a valid date." : "Enter a valid start date and time.");
      return;
    }

    const endAt = draft.allDay || !draft.endAt ? null : draft.endAt;
    if (endAt && !isValidScheduleInput(endAt)) {
      setError("Enter a valid end date and time.");
      return;
    }
    if (endAt && parseScheduleInput(endAt).getTime() <= parseScheduleInput(startAt).getTime()) {
      setError("The end time must be after the start time.");
      return;
    }

    try {
      const payload = {
        ...draft,
        title: draft.title.trim(),
        startAt,
        endAt,
      };
      if (event) {
        await updateScheduleEvent(event.id, payload);
      } else {
        await createScheduleEvent(payload);
      }
      onOpenChange(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save this schedule item.");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{event ? "Edit schedule item" : "Add to schedule"}</DialogTitle>
          <DialogDescription>
            Add a call, appointment, deadline, or any other date you want to keep visible.
          </DialogDescription>
        </DialogHeader>

        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-title">Title</Label>
            <Input
              id="schedule-title"
              autoFocus
              value={draft.title}
              onChange={(inputEvent) => setField("title", inputEvent.target.value)}
              placeholder="Call the wedding organizer"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-type">Type</Label>
              <Select value={draft.type} onValueChange={(value) => setField("type", value as ScheduleEventType)}>
                <SelectTrigger id="schedule-type" className="w-full" aria-label="Schedule item type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_LABELS)
                    .filter(([value]) => value !== "task")
                    .map(([value, label]) => (
                      <SelectItem key={value} value={value}>{label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-status">Status</Label>
              <Select value={draft.status} onValueChange={(value) => setField("status", value as ScheduleEventStatus)}>
                <SelectTrigger id="schedule-status" className="w-full" aria-label="Schedule item status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="schedule-all-day"
              checked={draft.allDay}
              onCheckedChange={(checked) => {
                const allDay = Boolean(checked);
                setDraft((current) => ({
                  ...current,
                  allDay,
                  startAt: allDay
                    ? current.startAt.slice(0, 10)
                    : current.startAt.length === 10
                      ? `${current.startAt}T09:00`
                      : current.startAt,
                  endAt: allDay ? null : current.endAt,
                }));
              }}
            />
            <Label htmlFor="schedule-all-day">All day</Label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-start">{draft.allDay ? "Date" : "Starts"}</Label>
              <Input
                id="schedule-start"
                type={draft.allDay ? "date" : "datetime-local"}
                value={draft.startAt}
                onChange={(inputEvent) => setField("startAt", inputEvent.target.value)}
              />
            </div>
            {!draft.allDay && (
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="schedule-end">Ends <span className="font-normal text-muted-foreground">(optional)</span></Label>
                <Input
                  id="schedule-end"
                  type="datetime-local"
                  value={draft.endAt ?? ""}
                  onChange={(inputEvent) => setField("endAt", inputEvent.target.value || null)}
                />
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-related">Related booking</Label>
              <Select
                value={relatedValue(draft)}
                onValueChange={(value) => {
                  if (!value) return;
                  setDraft((current) => ({
                    ...current,
                    relatedVendorId: value.startsWith("vendor:") ? value.slice(7) : null,
                    relatedVenueId: value.startsWith("venue:") ? value.slice(6) : null,
                  }));
                }}
              >
                <SelectTrigger id="schedule-related" className="w-full" aria-label="Related vendor or venue"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked booking</SelectItem>
                  {venues.map((venue) => <SelectItem key={`venue:${venue.id}`} value={`venue:${venue.id}`}>Venue · {venue.name}</SelectItem>)}
                  {vendors.map((vendor) => <SelectItem key={`vendor:${vendor.id}`} value={`vendor:${vendor.id}`}>Vendor · {vendor.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="schedule-reminder">Reminder</Label>
              <Select
                value={String(draft.reminderMinutes[0] ?? 0)}
                onValueChange={(value) => setField("reminderMinutes", value === "0" ? [] : [Number(value)])}
              >
                <SelectTrigger id="schedule-reminder" className="w-full" aria-label="Reminder preference"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Saved for future calendar or notification integrations.</p>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-location">Location or call link <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Input
              id="schedule-location"
              value={draft.location}
              onChange={(inputEvent) => setField("location", inputEvent.target.value)}
              placeholder="Zoom link, cafe, or venue address"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="schedule-notes">Notes <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea
              id="schedule-notes"
              value={draft.notes}
              onChange={(inputEvent) => setField("notes", inputEvent.target.value)}
              placeholder="Questions to ask, documents to bring, or follow-up details"
            />
          </div>

          {error && <p className="text-sm text-destructive" role="alert">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit">{event ? "Save changes" : "Add to schedule"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AgendaRow({
  item,
  anchorDate,
  onEdit,
  onDelete,
  onToggleComplete,
}: {
  item: DisplayItem;
  anchorDate: Date;
  onEdit: (event: ScheduleEvent) => void;
  onDelete: (event: ScheduleEvent) => void;
  onToggleComplete: (event: ScheduleEvent) => void;
}) {
  const group = getAgendaGroup(item, anchorDate);
  const isFinished = item.status === "completed" || item.status === "cancelled";
  const openLabel = item.source === "payment" ? "Open Confirmed" : item.source === "todo" ? "Open To Do" : "Open related booking";

  return (
    <article className={cn("flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between", isFinished && "opacity-60")}>
      <div className="flex min-w-0 gap-3">
        <div className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          group === "Overdue" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
        )}>
          {itemIcon(item)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("break-words font-medium text-foreground", isFinished && "line-through")}>{item.title}</p>
            <Badge variant="outline">{TYPE_LABELS[item.type]}</Badge>
            {group === "Overdue" && <Badge variant="destructive">Overdue</Badge>}
            {item.status === "completed" && <Badge variant="secondary">Completed</Badge>}
            {item.status === "cancelled" && <Badge variant="outline">Cancelled</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{formatScheduleDate(item.startAt, item.allDay)}</span>
            <span>{formatTimeRange(item)}</span>
            {item.relatedLabel && item.relatedHref ? (
              <Link href={item.relatedHref} className="max-w-full break-words text-primary underline-offset-2 hover:underline">
                {item.relatedLabel}
              </Link>
            ) : item.relatedLabel ? (
              <span>{item.relatedLabel}</span>
            ) : null}
            {item.location && (
              <span className="inline-flex max-w-full items-start gap-1 break-words">
                <MapPin className="mt-0.5 size-3 shrink-0" />
                <span>{item.location}</span>
              </span>
            )}
          </div>
          {item.notes && <p className="mt-2 line-clamp-3 break-words text-sm text-muted-foreground">{item.notes}</p>}
          {item.amount != null && <p className="mt-2 font-heading text-sm font-semibold text-foreground">Remaining {formatIDR(item.amount)}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
        {item.href && (
          <Button variant="ghost" size="sm" render={<Link href={item.href} />} aria-label={openLabel}>
            <span className="hidden sm:inline">{item.source === "payment" ? "Confirmed" : "To Do"}</span>
            <ExternalLink className="size-3.5" />
          </Button>
        )}
        {item.event && (
          <>
            {item.status !== "cancelled" && (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={item.status === "completed" ? "Mark as scheduled" : "Mark as completed"}
                title={item.status === "completed" ? "Mark as scheduled" : "Mark as completed"}
                onClick={() => onToggleComplete(item.event!)}
              >
                {item.status === "completed" ? <RotateCcw className="size-3.5" /> : <CalendarCheck className="size-3.5" />}
              </Button>
            )}
            <Button variant="ghost" size="icon-sm" aria-label="Edit schedule item" title="Edit" onClick={() => onEdit(item.event!)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Delete schedule item" title="Delete" className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(item.event!)}>
              <Trash2 className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </article>
  );
}

function CalendarItem({ item, onEdit }: { item: DisplayItem; onEdit: (event: ScheduleEvent) => void }) {
  const content = (
    <>
      <span className="mr-1 font-medium">{item.allDay ? "" : formatTimeRange(item)}</span>
      <span>{item.title}</span>
    </>
  );
  const className = cn(
    "block w-full truncate rounded-md px-1.5 py-1 text-left text-[0.68rem] leading-tight transition-colors",
    item.status === "completed" || item.status === "cancelled"
      ? "bg-muted text-muted-foreground line-through"
      : item.type === "payment"
        ? "bg-accent/70 text-accent-foreground hover:bg-accent"
        : item.type === "task"
          ? "bg-secondary text-secondary-foreground hover:bg-secondary/80"
          : "bg-primary/10 text-primary hover:bg-primary/20",
  );

  if (item.event) {
    return (
      <button type="button" className={className} title={`Edit ${item.title}`} aria-label={`Edit ${item.title}`} onClick={() => onEdit(item.event!)}>
        {content}
      </button>
    );
  }
  if (item.href) {
    return <Link href={item.href} className={className} title={`Open ${item.title}`} aria-label={`Open ${item.title}`}>{content}</Link>;
  }
  return <div className={className} title={item.title}>{content}</div>;
}

function MonthCalendar({
  month,
  items,
  onEdit,
}: {
  month: Date;
  items: DisplayItem[];
  onEdit: (event: ScheduleEvent) => void;
}) {
  const cells = useMemo(() => {
    const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
    const firstCell = new Date(month.getFullYear(), month.getMonth(), 1 - firstDay.getDay());
    return Array.from({ length: 42 }, (_, index) => shiftDays(firstCell, index));
  }, [month]);
  const todayKey = localDateKey(new Date());

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[35rem]">
        <div className="grid grid-cols-7 border-b border-border/70">
          {(["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const).map((day) => (
            <div key={day} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{day}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((day) => {
            const dayKey = localDateKey(day);
            const dayItems = items.filter((item) => localDateKey(parseScheduleDate(item.startAt)) === dayKey);
            const isToday = dayKey === todayKey;
            const isCurrentMonth = day.getMonth() === month.getMonth();
            return (
              <div
                key={dayKey}
                className={cn(
                  "min-h-24 border-b border-r border-border/60 p-1.5 sm:min-h-32 sm:p-2",
                  !isCurrentMonth && "bg-muted/25",
                  isToday && "bg-primary/5 ring-2 ring-inset ring-primary/35",
                )}
              >
                <div className={cn("mb-1 flex size-6 items-center justify-center rounded-full text-xs", isToday && "bg-primary font-semibold text-primary-foreground", !isCurrentMonth && "text-muted-foreground/60")}>
                  {day.getDate()}
                </div>
                <div className="flex flex-col gap-1">
                  {dayItems.slice(0, 4).map((item) => <CalendarItem key={item.id} item={item} onEdit={onEdit} />)}
                  {dayItems.length > 4 && <p className="px-1 text-[0.68rem] text-muted-foreground">+{dayItems.length - 4} more</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const { data: events, loading: eventsLoading, error: eventsError } = useScheduleEvents();
  const { data: todos, loading: todosLoading, error: todosError } = useTodos();
  const { data: vendors, loading: vendorsLoading, error: vendorsError } = useVendors();
  const { data: venues, loading: venuesLoading, error: venuesError } = useVenues();
  const [filter, setFilter] = useState<DisplayFilter>("all");
  const [search, setSearch] = useState("");
  const [showCompleted, setShowCompleted] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("agenda");
  const [anchorDate, setAnchorDate] = useState(() => startOfDay(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loading = eventsLoading || todosLoading || vendorsLoading || venuesLoading;
  const dataError = eventsError || todosError || vendorsError || venuesError;
  const vendorNames = useMemo(() => new Map(vendors.map((vendor) => [vendor.id, vendor.name])), [vendors]);
  const venueNames = useMemo(() => new Map(venues.map((venue) => [venue.id, venue.name])), [venues]);

  const items = useMemo<DisplayItem[]>(() => {
    const manualItems: DisplayItem[] = events.map((event) => ({
      id: `event-${event.id}`,
      title: event.title,
      type: event.type,
      startAt: event.startAt,
      endAt: event.endAt,
      allDay: event.allDay,
      notes: event.notes,
      location: event.location,
      status: event.status,
      source: "manual",
      relatedLabel: event.relatedVendorId
        ? `Vendor · ${vendorNames.get(event.relatedVendorId) ?? "Unknown vendor"}`
        : event.relatedVenueId
          ? `Venue · ${venueNames.get(event.relatedVenueId) ?? "Unknown venue"}`
          : null,
      relatedHref: event.relatedVendorId ? "/vendors" : event.relatedVenueId ? "/venues" : null,
      amount: null,
      href: null,
      event,
    }));

    const paymentItems: DisplayItem[] = buildConfirmedPaymentReminders(venues, vendors).map((reminder) => ({
      id: `payment-${reminder.id}`,
      title: reminder.title,
      type: "payment",
      startAt: reminder.date,
      endAt: null,
      allDay: true,
      notes: reminder.detail,
      location: "",
      status: "scheduled",
      source: "payment",
      relatedLabel: `Booking · ${reminder.detail}`,
      relatedHref: reminder.href,
      amount: reminder.amount,
      href: reminder.href,
      event: null,
    }));

    const todoItems: DisplayItem[] = todos
      .filter((todo) => !todo.done && todo.dueDate)
      .map((todo) => ({
        id: `todo-${todo.id}`,
        title: todo.title,
        type: "task",
        startAt: todo.dueDate!,
        endAt: null,
        allDay: true,
        notes: todo.notes,
        location: "",
        status: "scheduled",
        source: "todo",
        relatedLabel: "To Do",
        relatedHref: "/todo",
        amount: null,
        href: "/todo",
        event: null,
      }));

    return [...manualItems, ...paymentItems, ...todoItems].sort((a, b) => {
      const first = parseScheduleDate(a.startAt).getTime();
      const second = parseScheduleDate(b.startAt).getTime();
      if (Number.isNaN(first) && Number.isNaN(second)) return a.title.localeCompare(b.title);
      if (Number.isNaN(first)) return 1;
      if (Number.isNaN(second)) return -1;
      return first - second || a.title.localeCompare(b.title);
    });
  }, [events, todos, venues, vendors, vendorNames, venueNames]);

  const visibleItems = useMemo(() => {
    const normalizedSearch = search.trim().toLocaleLowerCase();
    return items.filter((item) => {
      if (!showCompleted && (item.status === "completed" || item.status === "cancelled")) return false;
      if (filter === "manual" && item.source !== "manual") return false;
      if (filter === "task" && item.type !== "task") return false;
      if (filter !== "all" && filter !== "manual" && filter !== "task" && item.type !== filter) return false;
      if (!normalizedSearch) return true;
      const haystack = [item.title, item.notes, item.location, item.relatedLabel, TYPE_LABELS[item.type]]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase();
      return haystack.includes(normalizedSearch);
    });
  }, [filter, items, search, showCompleted]);

  const groupedItems = useMemo(() => {
    const groups: Record<AgendaGroup, DisplayItem[]> = {
      Overdue: [],
      Today: [],
      Tomorrow: [],
      "Next 7 days": [],
      Upcoming: [],
      Completed: [],
    };
    for (const item of visibleItems) groups[getAgendaGroup(item, anchorDate)].push(item);
    return groups;
  }, [anchorDate, visibleItems]);

  const openNew = () => {
    setActionError(null);
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const openEdit = (event: ScheduleEvent) => {
    setActionError(null);
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const handleDelete = async (event: ScheduleEvent) => {
    if (!window.confirm(`Delete “${event.title}” from the schedule?`)) return;
    try {
      setActionError(null);
      await deleteScheduleEvent(event.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not delete this schedule item.");
    }
  };

  const handleToggleComplete = async (event: ScheduleEvent) => {
    try {
      setActionError(null);
      await updateScheduleEvent(event.id, {
        status: event.status === "completed" ? "scheduled" : "completed",
      });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not update this schedule item.");
    }
  };

  const navigatePeriod = (direction: number) => {
    setAnchorDate((current) => viewMode === "agenda" ? shiftDays(current, direction) : shiftMonth(current, direction));
  };

  const goToToday = () => setAnchorDate(startOfDay(new Date()));
  const groupOrder: AgendaGroup[] = ["Overdue", "Today", "Tomorrow", "Next 7 days", "Upcoming", "Completed"];
  const itemCount = visibleItems.length;
  const todayKey = localDateKey(new Date());
  const isToday = localDateKey(anchorDate) === todayKey;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">Stay ahead</p>
          <h1 className="font-heading text-3xl font-semibold text-foreground sm:text-4xl">Schedule</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Calls, payment deadlines, appointments, and dated tasks in one place.
          </p>
        </div>
        <Button className="gap-1 self-start sm:self-auto" onClick={openNew}>
          <Plus className="size-4" />
          Add to schedule
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["Overdue", "Today", "Next 7 days"] as AgendaGroup[]).map((group) => (
          <Card key={group} className={cn("border-border/70 shadow-sm", group === "Overdue" && groupedItems.Overdue.length > 0 && "border-destructive/30 bg-destructive/5")}>
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{group}</p>
              <p className={cn("mt-1 font-heading text-2xl font-semibold", group === "Overdue" && groupedItems.Overdue.length > 0 ? "text-destructive" : "text-foreground")}>{loading ? "—" : groupedItems[group].length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardContent className="flex flex-col gap-4 pt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" aria-label="Previous period" title="Previous period" onClick={() => navigatePeriod(-1)}>
                <ChevronLeft className="size-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={goToToday} disabled={isToday} aria-label="Go to today">Today</Button>
              <Button variant="outline" size="icon-sm" aria-label="Next period" title="Next period" onClick={() => navigatePeriod(1)}>
                <ChevronRight className="size-4" />
              </Button>
              <p className="ml-2 text-sm font-semibold text-foreground sm:text-base">
                {viewMode === "agenda" ? formatDayHeading(anchorDate) : formatMonthHeading(anchorDate)}
              </p>
            </div>
            <div className="flex items-center gap-1 rounded-lg border border-border/70 p-1" aria-label="Schedule view">
              <Button variant={viewMode === "agenda" ? "secondary" : "ghost"} size="sm" aria-pressed={viewMode === "agenda"} onClick={() => setViewMode("agenda")}>
                <List className="size-3.5" /> Agenda
              </Button>
              <Button variant={viewMode === "month" ? "secondary" : "ghost"} size="sm" aria-pressed={viewMode === "month"} onClick={() => setViewMode("month")}>
                <Grid2X2 className="size-3.5" /> Month
              </Button>
            </div>
          </div>

          <div className="flex flex-col gap-2 md:flex-row">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search title, notes, vendor, venue, or location"
                aria-label="Search schedule"
                className="pl-9"
              />
            </div>
            <Select value={filter} onValueChange={(value) => setFilter(value as DisplayFilter)}>
              <SelectTrigger className="w-full md:w-44" aria-label="Filter schedule items"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_FILTERS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={showCompleted ? "secondary" : "outline"} onClick={() => setShowCompleted((value) => !value)}>
              {showCompleted ? "Hide completed & cancelled" : "Show completed & cancelled"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            {viewMode === "agenda" ? "Use the arrows to move the planning day. Overdue items stay highlighted." : "Today is highlighted. Select a manual event to edit it, or open a linked item to continue planning."}
          </p>
        </CardContent>
      </Card>

      {dataError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          <p className="font-medium">Schedule data could not be loaded.</p>
          <p className="mt-1 text-destructive/80">{dataError} Refresh the page or check your connection and try again.</p>
        </div>
      )}
      {actionError && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive" role="alert">
          {actionError}
        </div>
      )}

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="gap-1 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="flex items-center gap-2 font-heading text-xl font-semibold">
            {viewMode === "agenda" ? <CalendarDays className="size-5 text-primary" /> : <Grid2X2 className="size-5 text-primary" />}
            {viewMode === "agenda" ? "Agenda" : "Month"}
            <span className="text-sm font-normal text-muted-foreground" aria-live="polite">{itemCount} item{itemCount === 1 ? "" : "s"}</span>
          </CardTitle>
          {search && <p className="text-xs text-muted-foreground">Showing matches for “{search}”</p>}
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3" aria-label="Loading schedule" role="status">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : itemCount === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-10 text-center">
              <CalendarDays className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-3 font-medium text-foreground">{search || filter !== "all" ? "No matching schedule items" : "Nothing scheduled yet"}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {search || filter !== "all" ? "Try a different search or filter, or show completed and cancelled items." : "Add a vendor call or deadline, and payment reminders will appear here automatically."}
              </p>
              {!search && filter === "all" && <Button className="mt-4 gap-1" onClick={openNew}><Plus className="size-4" />Add your first item</Button>}
            </div>
          ) : viewMode === "month" ? (
            <MonthCalendar month={anchorDate} items={visibleItems} onEdit={openEdit} />
          ) : (
            <div className="divide-y divide-border/70">
              {groupOrder.map((group) => groupedItems[group].length > 0 && (
                <section key={group} aria-labelledby={`schedule-group-${group.toLowerCase().replaceAll(" ", "-")}`}>
                  <div className="flex items-center gap-2 pt-4 first:pt-0">
                    <h2 id={`schedule-group-${group.toLowerCase().replaceAll(" ", "-")}`} className={cn("text-sm font-semibold", group === "Overdue" ? "text-destructive" : "text-foreground")}>{group}</h2>
                    <span className="text-xs text-muted-foreground">{groupedItems[group].length}</span>
                  </div>
                  {groupedItems[group].map((item) => (
                    <AgendaRow key={item.id} item={item} anchorDate={anchorDate} onEdit={openEdit} onDelete={handleDelete} onToggleComplete={handleToggleComplete} />
                  ))}
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Payment reminders come from Confirmed balances and target dates. To Do items appear here when they have a due date; their completion state remains owned by To Do.
      </p>

      <EventDialog
        key={`${editingEvent?.id ?? "new"}-${dialogOpen ? "open" : "closed"}`}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        event={editingEvent}
        vendors={vendors.map((vendor) => ({ id: vendor.id, name: vendor.name }))}
        venues={venues.map((venue) => ({ id: venue.id, name: venue.name }))}
      />
    </div>
  );
}
