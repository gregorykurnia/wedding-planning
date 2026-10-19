"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SessionContext, useSession, useSessionSource } from "@/lib/data/session";
import { useWho } from "@/lib/data/who";
import { registerServiceWorker } from "@/lib/register-sw";
import { WhoScreen } from "@/veil/screens/who/who-screen";
import { Shimmer } from "@/veil/parts/shimmer/shimmer";
// Listens for the browser's install offer from the first screen on (see use-can-install).
import "@/veil/parts/device/use-can-install";
import { safeNext, sectionOf, showsTopBar, veilHref } from "../href";
import { DemoBanner } from "./banner";
import { BusyProvider, useBusy } from "./busy";
import { FlashProvider } from "./flash";
import { PageColumn } from "./page-column";
import { PartnerNewsListener } from "./partner-news";
import { SheetHost } from "./sheet";
import { ToastHost } from "./toasts";
import { TopBar } from "./top-bar";

const HOME = veilHref("/");
const SIGN_IN = veilHref("/sign-in");

/**
 * Everything the new UI's screens share: the session (who is signed in, demo
 * mode, online or offline), the gate, the toast and sheet hosts, and the
 * partner's live changes (a toast and a flash). Sheets sit inside the toasts,
 * so a sheet can raise a toast.
 */
export function Providers({ children }: { children: ReactNode }) {
  const session = useSessionSource();
  useServiceWorker();
  return (
    <SessionContext.Provider value={session}>
      {/* useSearchParams needs a Suspense boundary, or the build fails. */}
      <ToastHost>
        <FlashProvider>
          <Suspense fallback={<Busy />}>
            <SheetHost>
              <BusyProvider>
                <Gate>{children}</Gate>
              </BusyProvider>
              <PartnerNewsListener />
            </SheetHost>
          </Suspense>
        </FlashProvider>
      </ToastHost>
    </SessionContext.Provider>
  );
}

/** The same worker serves both UIs. */
function useServiceWorker() {
  useEffect(registerServiceWorker, []);
}

/**
 * Signed-out visitors (and, in demo mode, anyone who hasn't chosen Look
 * around) go to sign-in, with the address they wanted kept in `next`. Signed-in
 * visitors on sign-in go on to it. Nothing behind the gate renders until the
 * session is known, and `main` stays `aria-busy` meanwhile.
 *
 * Once admitted, the top bar and (in demonstration mode) the gold banner come
 * first, outside `main`, as the prototype has them: the top bar is the page's
 * banner landmark, and a loading screen's `aria-busy` doesn't cover the menu.
 */
function Gate({ children }: { children: ReactNode }) {
  const session = useSession();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const busy = useBusy();

  const onSignIn = pathname === SIGN_IN;
  const resolving = session.status === "loading" || session.status === "checking";
  const admitted =
    session.status === "signed-in" || (session.status === "demo" && session.lookingAround);

  let target: string | null = null;
  if (!resolving) {
    if (onSignIn && admitted) {
      target = safeNext(searchParams.get("next"));
    } else if (!onSignIn && !admitted) {
      const query = searchParams.toString();
      const here = query ? `${pathname}?${query}` : pathname;
      target = here === HOME ? SIGN_IN : `${SIGN_IN}?next=${encodeURIComponent(here)}`;
    }
  }

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (resolving || target !== null) return <Busy />;
  const framed = showsTopBar(pathname);
  const screen = (
    <>
      {framed && <TopBar section={sectionOf(pathname)} />}
      {framed && session.status === "demo" && <DemoBanner />}
      <main id="main" tabIndex={-1} aria-busy={busy || undefined}>
        {children}
      </main>
    </>
  );
  return framed && session.status === "signed-in" ? <AskWho email={session.user?.email ?? ""}>{screen}</AskWho> : screen;
}

/**
 * An account that hasn't been paired with one of the two names is asked once,
 * "Which of you is this?" (guide §5.1, N3), before any screen: the question
 * replaces the screen it came for, which shows as soon as it is answered. The
 * screen isn't held back while the settings load, so a slow read never blanks it.
 */
function AskWho({ email, children }: { email: string; children: ReactNode }) {
  const who = useWho();
  if (who.ready && who.ask !== "none") {
    return (
      <main id="main" tabIndex={-1}>
        <WhoScreen ask={who.ask} email={email} names={who.names} />
      </main>
    );
  }
  return <>{children}</>;
}

/** The skeleton, not a blank page (guide §6.6), while the session is checked. */
function Busy() {
  return (
    <main id="main" aria-busy="true">
      <p className="sr">Checking who’s signed in</p>
      <PageColumn>
        <Shimmer />
      </PageColumn>
    </main>
  );
}
