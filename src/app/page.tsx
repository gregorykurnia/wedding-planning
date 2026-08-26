"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  CalendarHeart,
  Heart,
  ListTodo,
  StickyNote,
  Users,
  Warehouse,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useVenues } from "@/lib/collections/venues";
import { useVendors } from "@/lib/collections/vendors";
import { useTodos } from "@/lib/collections/todos";
import { useGuests } from "@/lib/collections/guests";
import { useWeddingSettings } from "@/lib/collections/settings";
import { formatIDR } from "@/lib/format";
import { cn } from "@/lib/utils";

// Fallback used until a wedding date is saved in Settings.
const DEFAULT_WEDDING_DATE = new Date("2027-06-12T09:00:00");
// Countdown progress ring assumes planning started roughly a year out when
// no better reference point exists.
const PLANNING_WINDOW_DAYS = 365;

function useCountdown(target: Date) {
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function entryTotals(entries: { totalPrice: number; budgetSpent: number }[]) {
  return {
    totalPrice: entries.reduce((s, e) => s + e.totalPrice, 0),
    budgetSpent: entries.reduce((s, e) => s + e.budgetSpent, 0),
  };
}

export default function DashboardPage() {
  const { data: venues, loading: venuesLoading } = useVenues();
  const { data: vendors, loading: vendorsLoading } = useVendors();
  const { data: todos, loading: todosLoading } = useTodos();
  const { data: guests, loading: guestsLoading } = useGuests();
  const { data: settings } = useWeddingSettings();

  const spendLoading = venuesLoading || vendorsLoading;

  const WEDDING_DATE = settings?.weddingDate
    ? new Date(`${settings.weddingDate}T09:00:00`)
    : DEFAULT_WEDDING_DATE;
  const daysLeft = useCountdown(WEDDING_DATE);
  const countdownProgress = Math.min(
    100,
    Math.max(0, 100 - (daysLeft / PLANNING_WINDOW_DAYS) * 100),
  );

  // Mirrors the Confirmed page's rollup: booked venue + Chosen/Done vendors,
  // preferring sub-entry totals over the parent's own fields when present.
  const bookedVenue = venues.find((v) => v.status === "Booked");
  const confirmedVendors = vendors.filter(
    (v) => v.contractStatus === "Chosen" || v.contractStatus === "Done",
  );

  let confirmedTotalPrice = 0;
  let confirmedTotalSpent = 0;
  if (bookedVenue) {
    const t =
      bookedVenue.subEntries.length > 0
        ? entryTotals(bookedVenue.subEntries)
        : { totalPrice: bookedVenue.budgetEstimate, budgetSpent: bookedVenue.budgetSpent };
    confirmedTotalPrice += t.totalPrice;
    confirmedTotalSpent += t.budgetSpent;
  }
  for (const vendor of confirmedVendors) {
    const t =
      vendor.subEntries.length > 0
        ? entryTotals(vendor.subEntries)
        : { totalPrice: vendor.totalPrice, budgetSpent: vendor.budgetSpent };
    confirmedTotalPrice += t.totalPrice;
    confirmedTotalSpent += t.budgetSpent;
  }

  const openTodos = todos.filter((t) => !t.done);
  const doneTodos = todos.length - openTodos.length;
  const todoProgress = todos.length > 0 ? Math.round((doneTodos / todos.length) * 100) : 0;
  const upcomingTodos = [...openTodos]
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 5);

  const confirmedGuests = guests.filter((g) => g.rsvpStatus === "yes");
  const pendingGuests = guests.filter((g) => g.rsvpStatus === "pending");
  const declinedGuests = guests.filter((g) => g.rsvpStatus === "no");
  const headcount = confirmedGuests.reduce((sum, g) => sum + 1 + g.plusOnes, 0);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="text-sm font-medium uppercase tracking-wide text-primary">
          Welcome back
        </p>
        <h1 className="font-heading text-3xl font-semibold text-foreground sm:text-4xl">
          Let&apos;s plan your day
        </h1>
      </div>

      <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-blush via-blush/50 to-card shadow-sm">
        <CardContent className="flex flex-col items-center gap-6 py-8 sm:flex-row sm:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarHeart className="size-4" />
              Wedding countdown
            </p>
            <p className="mt-2 font-heading text-5xl font-semibold text-foreground sm:text-6xl">
              {daysLeft > 0 ? daysLeft : 0}
              <span className="ml-2 text-lg font-normal text-muted-foreground">
                days to go
              </span>
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {WEDDING_DATE.toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
          <div
            className="relative flex size-28 shrink-0 items-center justify-center rounded-full"
            style={{
              background: `conic-gradient(var(--primary) ${countdownProgress}%, color-mix(in srgb, var(--primary) 15%, transparent) 0)`,
            }}
          >
            <div className="flex size-22 items-center justify-center rounded-full bg-card text-sm font-semibold text-foreground">
              {Math.round(countdownProgress)}%
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <BadgeCheck className="size-5" />
            </div>
            <CardTitle className="font-heading text-base font-semibold">
              Confirmed spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            {spendLoading ? (
              <Skeleton className="h-10 w-40" />
            ) : (
              <>
                <p className="font-heading text-2xl font-semibold text-foreground">
                  {formatIDR(confirmedTotalSpent)}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    spent
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  of {formatIDR(confirmedTotalPrice)} booked
                </p>
              </>
            )}
            <Button
              variant="link"
              render={<Link href="/confirmed" />}
              className="mt-1 h-auto px-0"
            >
              View confirmed <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <ListTodo className="size-5" />
            </div>
            <CardTitle className="font-heading text-base font-semibold">
              To do
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todosLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : todos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No tasks yet — add some on the to do page.
              </p>
            ) : (
              <>
                <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${todoProgress}%` }}
                  />
                </div>
                <p className="mb-2 text-xs text-muted-foreground">
                  {doneTodos} of {todos.length} done
                </p>
                <ul className="flex flex-col gap-2">
                  {upcomingTodos.map((task) => (
                    <li
                      key={task.id}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="truncate text-foreground">{task.title}</span>
                      {task.dueDate && (
                        <Badge variant="outline" className="shrink-0 text-xs">
                          {task.dueDate}
                        </Badge>
                      )}
                    </li>
                  ))}
                  {upcomingTodos.length === 0 && (
                    <li className="text-sm text-muted-foreground">All caught up!</li>
                  )}
                </ul>
              </>
            )}
            <Button
              variant="link"
              render={<Link href="/todo" />}
              className="mt-2 h-auto px-0"
            >
              View to do <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Users className="size-5" />
            </div>
            <CardTitle className="font-heading text-base font-semibold">
              Guests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {guestsLoading ? (
              <Skeleton className="h-10 w-40" />
            ) : guests.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No guests yet — add some on the guests page.
              </p>
            ) : (
              <>
                <p className="font-heading text-2xl font-semibold text-foreground">
                  {headcount}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    attending
                  </span>
                </p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge className="bg-primary/15 text-primary hover:bg-primary/15">
                    {confirmedGuests.length} yes
                  </Badge>
                  <Badge variant="outline">{pendingGuests.length} pending</Badge>
                  <Badge variant="outline" className="text-muted-foreground">
                    {declinedGuests.length} declined
                  </Badge>
                </div>
              </>
            )}
            <Button
              variant="link"
              render={<Link href="/guests" />}
              className="mt-2 h-auto px-0"
            >
              View guests <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            href: "/venues",
            title: "Venues",
            desc: "Compare & book your venue",
            icon: Warehouse,
          },
          {
            href: "/vendors",
            title: "Vendors",
            desc: "Caterers, florists & more",
            icon: Heart,
          },
          {
            href: "/guests",
            title: "Guests",
            desc: "Track RSVPs & seating",
            icon: Users,
          },
          {
            href: "/notes",
            title: "Notes",
            desc: "Jot down ideas & reminders",
            icon: StickyNote,
          },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card
              className={cn(
                "h-full border-border/70 shadow-sm transition-shadow hover:shadow-md",
              )}
            >
              <CardContent className="flex flex-col gap-2 pt-6">
                <item.icon className="size-5 text-primary" />
                <p className="font-heading text-lg font-semibold text-foreground">
                  {item.title}
                </p>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
