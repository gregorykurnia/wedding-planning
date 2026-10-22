"use client";

import { usePathname } from "next/navigation";
import { Btn } from "@/veil/parts/actions/btn";
import { type DoorItem, Doors } from "@/veil/parts/doors/doors";
import { Message } from "@/veil/parts/message/message";
import { veilHref } from "@/veil/href";
import { PageColumn } from "@/veil/shell/page-column";
import { openMenu } from "@/veil/shell/top-bar";
import styles from "./not-here.module.css";

/** The three places a visitor who lands here is pointed to (guide §5.25). */
const DOORS: DoorItem[] = [
  {
    id: "budget",
    name: "Budget",
    href: veilHref("/budget"),
    summary: [{ text: "Bookings, payments and who pays" }],
  },
  {
    id: "schedule",
    name: "Schedule",
    href: veilHref("/schedule"),
    summary: [{ text: "What’s coming up" }],
  },
  {
    id: "guests",
    name: "Guests",
    href: veilHref("/guests"),
    summary: [{ text: "Who’s coming to what" }],
  },
];

/**
 * The page for an address that leads nowhere in the planner (guide §5.25, N2):
 * the knot, the address as it was typed, two ways back and three doors. The top
 * bar stays above it, drawn by the shell.
 */
export function NotHere() {
  const address = usePathname();
  return (
    <PageColumn>
      <Message
        kind="gone"
        title="This page isn’t here"
        actions={
          <>
            <Btn variant="quiet" onClick={openMenu}>
              Open the menu
            </Btn>
            <Btn href={veilHref("/")}>Go to the overview</Btn>
          </>
        }
      >
        The address may be mistyped, or it points to something that has moved. Nothing has changed
        in the planner.
        <span className={styles.address} dir="auto">
          {address}
        </span>
      </Message>
      <nav className={styles.places} aria-label="Places you know">
        <Doors doors={DOORS} />
      </nav>
    </PageColumn>
  );
}
