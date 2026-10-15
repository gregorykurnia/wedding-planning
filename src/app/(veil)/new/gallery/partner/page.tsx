import { notFound } from "next/navigation";
import { PartnerDemos } from "@/veil/gallery/partner-demos";

// Dev-only: the partner toast, flash, removed-by-partner and presence demos of
// Task 2.7. Task 3.0's gallery lists it. Absent unless the gallery switch is on.
export default function PartnerGalleryPage() {
  if (process.env.NEXT_PUBLIC_VEIL_GALLERY !== "1") notFound();
  return <PartnerDemos />;
}
