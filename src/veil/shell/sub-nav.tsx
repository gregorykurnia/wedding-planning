import Link from "next/link";
import { veilHref } from "../href";
import styles from "./sub-nav.module.css";

/** The sets of sibling screens that get a sub-navigation, with their items as [path, word]. */
const SETS = {
  vendors: {
    label: "Vendors, shortlist and venues",
    items: [
      ["/vendors", "Vendors"],
      ["/vendors/shortlist", "Shortlist"],
      ["/vendors/venues", "Venues"],
    ],
  },
  records: {
    label: "Documents and files",
    items: [
      ["/documents", "Documents"],
      ["/documents/files", "Files"],
    ],
  },
  schedule: {
    label: "Agenda, month and tasks",
    items: [
      ["/schedule", "Agenda"],
      ["/schedule/month", "Month"],
      ["/schedule/tasks", "Tasks"],
    ],
  },
} as const;

export type SubNavSet = keyof typeof SETS;

/**
 * The quiet serif words under a section's title (guide §4.3). `current` is the
 * path of the screen being shown; that word is marked. Not used in a folder or
 * on a detail screen.
 */
export function SubNav({ set, current }: { set: SubNavSet; current: string }) {
  const { label, items } = SETS[set];
  return (
    <nav className={styles.subnav} aria-label={label}>
      {items.map(([path, word]) => (
        <Link
          key={path}
          href={veilHref(path)}
          className={styles.link}
          aria-current={path === current ? "page" : undefined}
        >
          {word}
        </Link>
      ))}
    </nav>
  );
}
