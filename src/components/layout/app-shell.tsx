"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BadgeCheck,
  CalendarHeart,
  CheckSquare,
  Heart,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Menu,
  PiggyBank,
  StickyNote,
  Users,
  Warehouse,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useWorkspace } from "@/lib/workspace-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/venues", label: "Venues", icon: Warehouse },
  { href: "/vendors", label: "Vendors", icon: Heart },
  { href: "/confirmed", label: "Confirmed", icon: BadgeCheck },
  { href: "/guests", label: "Guests", icon: Users },
  { href: "/budget", label: "Budget", icon: PiggyBank },
  { href: "/checklist", label: "Checklist", icon: CheckSquare },
  { href: "/todo", label: "To Do", icon: ListTodo },
  { href: "/notes", label: "Notes", icon: StickyNote },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading: authLoading, isFirebaseConfigured, signOut } = useAuth();
  const { workspace, loading: workspaceLoading } = useWorkspace();

  const isLoginPage = pathname === "/login";
  const isOnboardingPage = pathname === "/onboarding";

  useEffect(() => {
    if (!isFirebaseConfigured || authLoading) return;
    if (!user && !isLoginPage) {
      router.replace("/login");
      return;
    }
    if (user && !workspaceLoading && !workspace && !isOnboardingPage) {
      router.replace("/onboarding");
      return;
    }
    if (user && workspace && (isLoginPage || isOnboardingPage)) {
      router.replace("/");
    }
  }, [
    isFirebaseConfigured,
    authLoading,
    user,
    workspaceLoading,
    workspace,
    isLoginPage,
    isOnboardingPage,
    router,
  ]);

  if (isLoginPage || isOnboardingPage) {
    return <main className="flex min-h-screen flex-1 flex-col">{children}</main>;
  }

  if (isFirebaseConfigured && (authLoading || !user || workspaceLoading || !workspace)) {
    return <main className="flex min-h-screen flex-1 flex-col" />;
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
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === "/" ? pathname === "/" : pathname?.startsWith(item.href);
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
            {workspace && (
              <span className="hidden text-xs text-muted-foreground sm:inline">
                Invite code: <span className="font-mono font-medium">{workspace.inviteCode}</span>
              </span>
            )}
            {isFirebaseConfigured && user && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => signOut()}
                className="hidden sm:inline-flex"
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            )}
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
                {workspace && (
                  <DropdownMenuItem disabled className="opacity-100">
                    Invite code: {workspace.inviteCode}
                  </DropdownMenuItem>
                )}
                {isFirebaseConfigured && user && (
                  <DropdownMenuItem onClick={() => signOut()}>
                    <LogOut className="size-4" />
                    Sign out
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
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
