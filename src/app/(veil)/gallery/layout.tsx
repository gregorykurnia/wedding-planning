import { notFound } from "next/navigation";
import type { ReactNode } from "react";

// Every page under /gallery is dev-only, so this layout is the one in-app gate.
// The status code is set in next.config.ts: with the switch off, the addresses are
// rewritten to /gallery-off, whose own route answers 404 before anything streams.
export default function GalleryLayout({ children }: { children: ReactNode }) {
  if (process.env.NEXT_PUBLIC_VEIL_GALLERY !== "1") notFound();
  return children;
}
