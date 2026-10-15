import type { ReactNode } from "react";
import { AgendaDemos } from "./agenda-demos";
import { FieldsDemo } from "./fields-demos";
import { IconsDemo } from "./icons-demo";

export type GallerySection = {
  /** The task that builds the section's components, such as "3.1". */
  task: string;
  title: string;
  /**
   * Set by the task that builds the components, in this file. Until then the
   * section says it isn't built yet.
   */
  demo?: ReactNode;
};

/** One section per task, in plan order. The icon set (2.2) waited for this page. */
export const GALLERY_SECTIONS: GallerySection[] = [
  { task: "2.2", title: "Icon set", demo: <IconsDemo /> },
  { task: "3.1", title: "Hero, kicker, figure, context, thread" },
  { task: "3.2", title: "Next card, after line, doors" },
  { task: "3.3", title: "Buttons, links, chips and focus chips" },
  { task: "3.4", title: "Fields and save-as-you-go", demo: <FieldsDemo /> },
  { task: "3.5", title: "Ledger rows and row states" },
  { task: "3.6", title: "Parts, menu cards, tally" },
  { task: "3.7", title: "Search, ordering, filters, count line and paging" },
  { task: "3.8", title: "Sheet patterns, confirm variants, banners and problem boxes" },
  { task: "3.9", title: "Stage thread, keen heart, WhatsApp, install card, notification state" },
  { task: "3.10", title: "File tiles, upload sheet and upload pipeline" },
  { task: "3.11", title: "Agenda rows and month calendar", demo: <AgendaDemos /> },
  { task: "3.12", title: "Task, item and guest rows" },
];

/**
 * The Phase 2 demos keep their own pages and e2e tests, so the gallery links to
 * them rather than embedding them.
 */
export const EARLIER_DEMOS: { href: string; title: string; task: string }[] = [
  { href: "/new/gallery/nav", title: "Shell pieces", task: "2.4" },
  { href: "/new/gallery/states", title: "Screen states, messages and banners", task: "2.5" },
  { href: "/new/gallery/shell", title: "Sheets, confirm and toasts", task: "2.6" },
  { href: "/new/gallery/partner", title: "Partner changes and presence", task: "2.7" },
];
