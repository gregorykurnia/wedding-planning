import type { ReactNode } from "react";
import { ActionDemos } from "./actions-demos";
import { AgendaDemos } from "./agenda-demos";
import { DeviceDemos } from "./device-demos";
import { FieldsDemo } from "./fields-demos";
import { HeroDemos } from "./hero-demos";
import { IconsDemo } from "./icons-demo";
import { LedgerDemos } from "./ledger-demos";
import { NextDemos } from "./next-demos";
import { PartsDemos } from "./parts-demos";
import { RowsDemos } from "./rows-demos";
import { PaymentDemos } from "./payment-demos";
import { SheetsDemos } from "./sheets-demos";
import { StageDemos } from "./stage-demos";
import { ToolsDemos } from "./tools-demos";
import { UploadDemo } from "./upload-demos";

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
  { task: "3.1", title: "Hero, kicker, figure, context, thread", demo: <HeroDemos /> },
  { task: "3.2", title: "Next card, after line, doors", demo: <NextDemos /> },
  { task: "3.3", title: "Buttons, links, chips and focus chips", demo: <ActionDemos /> },
  { task: "3.4", title: "Fields and save-as-you-go", demo: <FieldsDemo /> },
  { task: "3.5", title: "Ledger rows and row states", demo: <LedgerDemos /> },
  { task: "3.6", title: "Parts, menu cards, tally", demo: <PartsDemos /> },
  { task: "3.7", title: "Search, ordering, filters, count line and paging", demo: <ToolsDemos /> },
  { task: "3.8", title: "Sheet patterns, confirm variants, banners and problem boxes", demo: <SheetsDemos /> },
  {
    task: "3.9",
    title: "Stage thread, keen heart, WhatsApp, install card, notification state",
    demo: (
      <>
        <StageDemos />
        <DeviceDemos />
      </>
    ),
  },
  { task: "3.10", title: "File tiles, upload sheet and upload pipeline", demo: <UploadDemo /> },
  { task: "3.11", title: "Agenda rows and month calendar", demo: <AgendaDemos /> },
  { task: "3.12", title: "Task, item and guest rows", demo: <RowsDemos /> },
  { task: "4.4", title: "Record a payment", demo: <PaymentDemos /> },
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
