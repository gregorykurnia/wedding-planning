"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BadgeCheck,
  CalendarHeart,
  ChevronDown,
  Heart,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  Settings,
  StickyNote,
  Users,
  Warehouse,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const PLANNING_ITEMS = [
  { href: "/venues", label: "Venues", icon: Warehouse },
  { href: "/vendors", label: "Vendors", icon: Heart },
  { href: "/confirmed", label: "Confirmed", icon: BadgeCheck },
];

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  ...PLANNING_ITEMS,
  { href: "/guests", label: "Guests", icon: Users },
  { href: "/todo", label: "To Do", icon: ListTodo },
  { href: "/notes", label: "Notes", icon: StickyNote },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, isFirebaseConfigured, signOut } = useAuth();

  const isLoginPage = pathname === "/login";
  const needsAuth = isFirebaseConfigured && !loading && !user && !isLoginPage;

  useEffect(() => {
    if (needsAuth) {
      router.replace("/login");
    }
  }, [needsAuth, router]);

  if (isLoginPage) {
    return <main className="flex min-h-screen flex-1 flex-col">{children}</main>;
  }

  if (!isFirebaseConfigured) {
    // No Firebase project configured — fall through to the demo/empty view
    // below rather than gating on auth that can't work anyway.
  } else if (loading || needsAuth) {
    return (
      <main className="flex min-h-screen flex-1 items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading…</span>
      </main>
    );
  }

  return (
    <div className="flex min-h-screen flex-1 flex-col">
      <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-4 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <CalendarHeart className="size-6 text-primary" />
            <span className="font-heading text-lg font-semibold tracking-tight text-foreground">
              Our Wedding
            </span>
          </Link>

          <nav className="hidden flex-1 items-center gap-1 md:flex">
            <Link
              href="/"
              className={cn(
                "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                pathname === "/"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              <LayoutDashboard className="size-4" />
              Dashboard
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className={cn(
                      "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                      PLANNING_ITEMS.some((item) => pathname?.startsWith(item.href))
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                    )}
                  />
                }
              >
                Planning
                <ChevronDown className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {PLANNING_ITEMS.map((item) => (
                  <DropdownMenuItem
                    key={item.href}
                    render={<Link href={item.href} className="flex items-center gap-2" />}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {NAV_ITEMS.filter(
              (item) => item.href !== "/" && !PLANNING_ITEMS.some((p) => p.href === item.href),
            ).map((item) => {
              const active = pathname?.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  <item.icon className="size-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={<Button variant="outline" size="icon" className="md:hidden" />}
              >
                <Menu className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {NAV_ITEMS.map((item) => (
                  <DropdownMenuItem
                    key={item.href}
                    render={<Link href={item.href} className="flex items-center gap-2" />}
                  >
                    <item.icon className="size-4" />
                    {item.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {isFirebaseConfigured && user && (
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full"
                      aria-label="Account menu"
                    />
                  }
                >
                  {user.photoURL ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.photoURL}
                      alt=""
                      className="size-8 rounded-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <span className="flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">
                      {(user.displayName ?? user.email ?? "?").charAt(0).toUpperCase()}
                    </span>
                  )}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel className="flex flex-col gap-0.5 py-1.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {user.displayName ?? "Signed in"}
                      </span>
                      {user.email && (
                        <span className="truncate text-xs text-muted-foreground">
                          {user.email}
                        </span>
                      )}
                    </DropdownMenuLabel>
                  </DropdownMenuGroup>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem render={<Link href="/settings" className="flex items-center gap-2" />}>
                    <Settings className="size-4" />
                    Settings
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => signOut()} variant="destructive">
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
        {!isFirebaseConfigured && (
          <Alert className="mb-6 border-accent bg-accent/40">
            <AlertTitle className="font-heading">Firebase isn&apos;t connected yet</AlertTitle>
            <AlertDescription>
              You&apos;re viewing demo layouts with empty data. Fill in the Firebase
              env vars in <code>.env.local</code> to save real data.
            </AlertDescription>
          </Alert>
        )}
        {children}
      </main>
    </div>
  );
}
