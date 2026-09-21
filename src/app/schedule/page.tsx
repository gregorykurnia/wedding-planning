"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  CalendarDays,
  Check,
  CircleAlert,
  Clock3,
  ExternalLink,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  XCircle,
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
import { buildConfirmedPaymentReminders, formatScheduleDate, localDateKey, parseScheduleDate } from "@/lib/schedule";
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

const TYPE_FILTERS: { value: DisplayFilter; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "payment", label: "Payments" },
  { value: "vendor_call", label: "Calls" },
  { value: "appointment", label: "Appointments" },
  { value: "deadline", label: "Deadlines" },
  { value: "task", label: "To Do" },
  { value: "other", label: "Other" },
];

const REMINDER_OPTIONS = [
  { value: "0", label: "No reminder" },
  { value: "15", label: "15 minutes before" },
  { value: "60", label: "1 hour before" },
  { value: "1440", label: "1 day before" },
];

type DisplayFilter = "all" | ScheduleEventType | "task";
type DisplaySource = "manual" | "payment" | "todo";
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

function getAgendaGroup(item: DisplayItem): AgendaGroup {
  if (item.status === "completed" || item.status === "cancelled") return "Completed";

  const itemDate = parseScheduleDate(item.startAt);
  const today = new Date();
  const todayKey = localDateKey(today);
  const itemKey = localDateKey(itemDate);
  if (itemKey < todayKey) return "Overdue";
  if (itemKey === todayKey) return "Today";

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (itemKey === localDateKey(tomorrow)) return "Tomorrow";

  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);
  if (itemDate <= nextWeek) return "Next 7 days";
  return "Upcoming";
}

function formatTimeRange(item: DisplayItem) {
  if (item.allDay) return "All day";
  const start = parseScheduleDate(item.startAt);
  if (Number.isNaN(start.getTime())) return "Time not set";
  const startLabel = new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(start);
  if (!item.endAt) return startLabel;
  const end = parseScheduleDate(item.endAt);
  if (Number.isNaN(end.getTime())) return startLabel;
  return `${startLabel}–${new Intl.DateTimeFormat("en-GB", {
    hour: "numeric",
    minute: "2-digit",
  }).format(end)}`;
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

  async function handleSubmit(formEvent: React.FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    if (!draft.title.trim()) {
      setError("Add a title so this item is easy to find in the agenda.");
      return;
    }
    if (!draft.startAt) {
      setError("Choose a date for this item.");
      return;
    }

    try {
      const payload = {
        ...draft,
        title: draft.title.trim(),
        startAt: draft.allDay ? draft.startAt.slice(0, 10) : draft.startAt,
        endAt: draft.allDay || !draft.endAt ? null : draft.endAt,
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
              <Label>Type</Label>
              <Select value={draft.type} onValueChange={(value) => setField("type", value as ScheduleEventType)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
              <Label>Status</Label>
              <Select value={draft.status} onValueChange={(value) => setField("status", value as ScheduleEventStatus)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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
            <Label>All day</Label>
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
              <Label>Related to</Label>
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
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No linked booking</SelectItem>
                  {venues.map((venue) => <SelectItem key={`venue:${venue.id}`} value={`venue:${venue.id}`}>Venue · {venue.name}</SelectItem>)}
                  {vendors.map((vendor) => <SelectItem key={`vendor:${vendor.id}`} value={`vendor:${vendor.id}`}>Vendor · {vendor.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Reminder</Label>
              <Select
                value={String(draft.reminderMinutes[0] ?? 0)}
                onValueChange={(value) => setField("reminderMinutes", value === "0" ? [] : [Number(value)])}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
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

          {error && <p className="text-sm text-destructive">{error}</p>}

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
  onEdit,
  onDelete,
  onToggleComplete,
}: {
  item: DisplayItem;
  onEdit: (event: ScheduleEvent) => void;
  onDelete: (event: ScheduleEvent) => void;
  onToggleComplete: (event: ScheduleEvent) => void;
}) {
  const group = getAgendaGroup(item);
  const isFinished = item.status === "completed" || item.status === "cancelled";

  return (
    <div className={cn("flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between", isFinished && "opacity-60")}>
      <div className="flex min-w-0 gap-3">
        <div className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full",
          group === "Overdue" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
        )}>
          {itemIcon(item)}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("font-medium text-foreground", isFinished && "line-through")}>{item.title}</p>
            <Badge variant="outline">{TYPE_LABELS[item.type]}</Badge>
            {group === "Overdue" && <Badge variant="destructive">Overdue</Badge>}
            {item.status === "completed" && <Badge variant="secondary">Completed</Badge>}
            {item.status === "cancelled" && <Badge variant="outline">Cancelled</Badge>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <span>{formatScheduleDate(item.startAt, item.allDay)}</span>
            <span>{formatTimeRange(item)}</span>
            {item.relatedLabel && <span>{item.relatedLabel}</span>}
            {item.location && <span className="inline-flex items-center gap-1"><MapPin className="size-3" />{item.location}</span>}
          </div>
          {item.notes && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{item.notes}</p>}
          {item.amount != null && <p className="mt-2 font-heading text-sm font-semibold text-foreground">Remaining {formatIDR(item.amount)}</p>}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 self-end sm:self-start">
        {item.href && (
          <Button variant="ghost" size="sm" render={<Link href={item.href} />}>
            Open <ExternalLink className="size-3.5" />
          </Button>
        )}
        {item.event && (
          <>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={item.status === "completed" ? "Mark as scheduled" : "Mark as completed"}
              title={item.status === "completed" ? "Mark as scheduled" : "Mark as completed"}
              onClick={() => onToggleComplete(item.event!)}
            >
              {item.status === "completed" ? <XCircle className="size-3.5" /> : <CalendarCheck className="size-3.5" />}
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Edit schedule item" title="Edit" onClick={() => onEdit(item.event!)}>
              <Pencil className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" aria-label="Delete schedule item" title="Delete" className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(item.event!)}>
              <Trash2 className="size-3.5" />
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const { data: events, loading: eventsLoading } = useScheduleEvents();
  const { data: todos, loading: todosLoading } = useTodos();
  const { data: vendors, loading: vendorsLoading } = useVendors();
  const { data: venues, loading: venuesLoading } = useVenues();
  const [filter, setFilter] = useState<DisplayFilter>("all");
  const [showCompleted, setShowCompleted] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<ScheduleEvent | null>(null);

  const loading = eventsLoading || todosLoading || vendorsLoading || venuesLoading;
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
      relatedLabel: reminder.detail,
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
        amount: null,
        href: "/todo",
        event: null,
      }));

    return [...manualItems, ...paymentItems, ...todoItems].sort((a, b) => a.startAt.localeCompare(b.startAt));
  }, [events, todos, venues, vendors, vendorNames, venueNames]);

  const visibleItems = useMemo(() => items.filter((item) => {
    if (!showCompleted && (item.status === "completed" || item.status === "cancelled")) return false;
    if (filter !== "all" && item.type !== filter) return false;
    return true;
  }), [filter, items, showCompleted]);

  const groupedItems = useMemo(() => {
    const groups: Record<AgendaGroup, DisplayItem[]> = {
      Overdue: [],
      Today: [],
      Tomorrow: [],
      "Next 7 days": [],
      Upcoming: [],
      Completed: [],
    };
    for (const item of visibleItems) groups[getAgendaGroup(item)].push(item);
    return groups;
  }, [visibleItems]);

  const openNew = () => {
    setEditingEvent(null);
    setDialogOpen(true);
  };

  const openEdit = (event: ScheduleEvent) => {
    setEditingEvent(event);
    setDialogOpen(true);
  };

  const handleDelete = async (event: ScheduleEvent) => {
    if (window.confirm(`Delete “${event.title}” from the schedule?`)) {
      await deleteScheduleEvent(event.id);
    }
  };

  const handleToggleComplete = async (event: ScheduleEvent) => {
    await updateScheduleEvent(event.id, {
      status: event.status === "completed" ? "scheduled" : "completed",
    });
  };

  const groupOrder: AgendaGroup[] = ["Overdue", "Today", "Tomorrow", "Next 7 days", "Upcoming", "Completed"];
  const itemCount = visibleItems.length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-wide text-primary">Stay ahead</p>
          <h1 className="font-heading text-3xl font-semibold text-foreground sm:text-4xl">Schedule</h1>
          <p className="mt-1 text-sm text-muted-foreground">
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
              <p className="mt-1 font-heading text-2xl font-semibold text-foreground">{loading ? "—" : groupedItems[group].length}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="gap-4 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
          <CardTitle className="flex items-center gap-2 font-heading text-xl font-semibold">
            <CalendarDays className="size-5 text-primary" />
            Agenda
            <span className="text-sm font-normal text-muted-foreground">{itemCount} item{itemCount === 1 ? "" : "s"}</span>
          </CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filter} onValueChange={(value) => setFilter(value as DisplayFilter)}>
              <SelectTrigger size="sm" className="w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                {TYPE_FILTERS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant={showCompleted ? "secondary" : "outline"} size="sm" onClick={() => setShowCompleted((value) => !value)}>
              {showCompleted ? "Hide completed" : "Show completed"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full rounded-lg" />)}
            </div>
          ) : itemCount === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 px-4 py-10 text-center">
              <CalendarDays className="mx-auto size-8 text-muted-foreground/60" />
              <p className="mt-3 font-medium text-foreground">Nothing scheduled yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Add a vendor call or deadline, and payment reminders will appear here automatically.</p>
              <Button className="mt-4 gap-1" onClick={openNew}><Plus className="size-4" />Add your first item</Button>
            </div>
          ) : (
            <div className="divide-y divide-border/70">
              {groupOrder.map((group) => groupedItems[group].length > 0 && (
                <section key={group}>
                  <div className="flex items-center gap-2 pt-4 first:pt-0">
                    <h2 className={cn("text-sm font-semibold", group === "Overdue" ? "text-destructive" : "text-foreground")}>{group}</h2>
                    <span className="text-xs text-muted-foreground">{groupedItems[group].length}</span>
                  </div>
                  {groupedItems[group].map((item) => (
                    <AgendaRow key={item.id} item={item} onEdit={openEdit} onDelete={handleDelete} onToggleComplete={handleToggleComplete} />
                  ))}
                </section>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Payment reminders come from Confirmed balances and target dates. To Do items appear here when they have a due date.
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
