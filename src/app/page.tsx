"use client";

import Link from "next/link";
import { ArrowRight, CalendarHeart, CheckSquare, PiggyBank } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useBudgetItems } from "@/lib/collections/budget-items";
import { useChecklistItems } from "@/lib/collections/checklist-items";
import { formatIDR } from "@/lib/format";
import { useWorkspace } from "@/lib/workspace-context";

// Set your wedding date here once you know it.
const WEDDING_DATE = new Date("2027-06-12T09:00:00");

function useCountdown(target: Date) {
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

export default function DashboardPage() {
  const { workspace } = useWorkspace();
  const { data: budgetItems, loading: budgetLoading } = useBudgetItems(workspace?.id ?? null);
  const { data: checklistItems, loading: checklistLoading } = useChecklistItems(
    workspace?.id ?? null,
  );
  const daysLeft = useCountdown(WEDDING_DATE);

  const totalEstimated = budgetItems.reduce((sum, b) => sum + b.estimatedAmount, 0);
  const totalActual = budgetItems.reduce((sum, b) => sum + b.actualAmount, 0);

  const upcomingTasks = [...checklistItems]
    .filter((t) => !t.done)
    .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999"))
    .slice(0, 5);

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

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        <Card className="overflow-hidden border-border/70 bg-gradient-to-br from-blush/60 to-card shadow-sm">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
              <CalendarHeart className="size-5" />
            </div>
            <CardTitle className="font-heading text-base font-semibold">
              Wedding countdown
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-heading text-4xl font-semibold text-foreground">
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
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground">
              <PiggyBank className="size-5" />
            </div>
            <CardTitle className="font-heading text-base font-semibold">
              Budget snapshot
            </CardTitle>
          </CardHeader>
          <CardContent>
            {budgetLoading ? (
              <Skeleton className="h-10 w-40" />
            ) : (
              <>
                <p className="font-heading text-2xl font-semibold text-foreground">
                  {formatIDR(totalActual)}{" "}
                  <span className="text-base font-normal text-muted-foreground">
                    spent
                  </span>
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  of {formatIDR(totalEstimated)} estimated
                </p>
              </>
            )}
            <Button
              variant="link"
              render={<Link href="/budget" />}
              className="mt-1 h-auto px-0"
            >
              View budget <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/70 shadow-sm">
          <CardHeader className="flex-row items-center gap-3 space-y-0">
            <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
              <CheckSquare className="size-5" />
            </div>
            <CardTitle className="font-heading text-base font-semibold">
              Upcoming tasks
            </CardTitle>
          </CardHeader>
          <CardContent>
            {checklistLoading ? (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : upcomingTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No open tasks yet — add some on the checklist page.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {upcomingTasks.map((task) => (
                  <li key={task.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="truncate text-foreground">{task.title}</span>
                    <Badge variant="outline" className="shrink-0 text-xs">
                      {task.phase}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
            <Button
              variant="link"
              render={<Link href="/checklist" />}
              className="mt-2 h-auto px-0"
            >
              View checklist <ArrowRight className="size-3.5" />
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/venues", title: "Venues", desc: "Compare & book your venue" },
          { href: "/vendors", title: "Vendors", desc: "Caterers, florists & more" },
          { href: "/guests", title: "Guests", desc: "Track RSVPs & seating" },
          { href: "/checklist", title: "Checklist", desc: "Stay on top of every task" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <Card className="h-full border-border/70 shadow-sm transition-shadow hover:shadow-md">
              <CardContent className="flex flex-col gap-1 pt-6">
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
