"use client";

import Link from "next/link";
import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { useSession } from "@/lib/data/session";
import { veilHref } from "../href";
import styles from "./menu-index.module.css";

/** The sections the menu lists, in order (guide §4.2). */
export type Section = "overview" | "budget" | "vendors" | "items" | "schedule" | "documents" | "guests";

const SECTIONS: { key: Section; title: string; subtitle: string; path: string }[] = [
  { key: "overview", title: "Overview", subtitle: "Days to go and what's next", path: "/" },
  { key: "budget", title: "Budget", subtitle: "Bookings, payments and who pays", path: "/budget" },
  {
    key: "vendors",
    title: "Vendors",
    subtitle: "Everyone we're considering, the shortlist and venues",
    path: "/vendors",
  },
  { key: "items", title: "Wedding items", subtitle: "Every piece and who provides it", path: "/items" },
  { key: "schedule", title: "Schedule", subtitle: "Appointments, tasks and deadlines", path: "/schedule" },
  { key: "documents", title: "Documents", subtitle: "Notes, plans and files", path: "/documents" },
  { key: "guests", title: "Guests", subtitle: "Who's coming to what", path: "/guests" },
];

const FOCUSABLE = "a[href], button:not([disabled])";

/**
 * The full-page menu (guide §4.2), a modal dialog. Focus goes to its first
 * control, Close; Tab stays inside it; Escape closes it. `children` is the top
 * row with Close, which the top bar supplies so the names stay where they were.
 */
export function MenuIndex({
  id,
  section,
  onClose,
  children,
}: {
  id: string;
  section?: Section;
  onClose: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);

  useEffect(() => {
    dialog.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus();
  }, []);

  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab" || !dialog.current) return;
    const items = dialog.current.querySelectorAll<HTMLElement>(FOCUSABLE);
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      ref={dialog}
      id={id}
      className={styles.index}
      role="dialog"
      aria-modal="true"
      aria-label="Menu"
      onKeyDown={keepFocusInside}
    >
      {children}
      <nav className={styles.nav}>
        <ol className={styles.list}>
          {SECTIONS.map((item) => (
            <li key={item.key}>
              <Link
                href={veilHref(item.path)}
                className={styles.link}
                aria-current={item.key === section ? "page" : undefined}
              >
                {item.title}
                <small className={styles.sub}>{item.subtitle}</small>
              </Link>
            </li>
          ))}
        </ol>
        <Account />
      </nav>
    </div>
  );
}

/** The foot of the menu: who is signed in, or that nobody is. */
function Account() {
  const { status, user, signOut, leaveDemo } = useSession();
  return (
    <div className={styles.account}>
      {status === "demo" ? (
        <>
          <span>Demonstration mode: nobody is signed in</span>
          <span>
            <Link href={veilHref("/settings")} className={styles.action}>
              Wedding settings
            </Link>
            &emsp;
            <button type="button" className={styles.action} onClick={leaveDemo}>
              Back to sign-in
            </button>
          </span>
        </>
      ) : (
        <>
          <span>Signed in as {user?.email}</span>
          <span>
            <Link href={veilHref("/settings")} className={styles.action}>
              Wedding settings
            </Link>
            &emsp;
            <button type="button" className={styles.action} onClick={() => void signOut()}>
              Sign out
            </button>
          </span>
        </>
      )}
    </div>
  );
}
