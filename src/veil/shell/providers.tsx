"use client";

import { Suspense, useEffect, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { SessionContext, useSession, useSessionSource } from "@/lib/data/session";
import { registerServiceWorker } from "@/lib/register-sw";
import { Shimmer } from "@/veil/parts/shimmer/shimmer";
import { safeNext, veilHref } from "../href";
import { BusyProvider, useBusy } from "./busy";
import { FlashProvider } from "./flash";
import { PartnerNewsListener } from "./partner-news";
import { SheetHost } from "./sheet";
import { ToastHost } from "./toasts";

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
  return (
    <main id="main" tabIndex={-1} aria-busy={busy || undefined}>
      {children}
    </main>
  );
}

/** The skeleton, not a blank page (guide §6.6), while the session is checked. */
function Busy() {
  return (
    <main id="main" aria-busy="true">
      <p className="sr">Checking who’s signed in</p>
      <Shimmer column />
    </main>
  );
}
