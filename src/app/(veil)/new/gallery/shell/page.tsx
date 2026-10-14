import { notFound } from "next/navigation";
import { ShellDemos } from "@/veil/gallery/shell-demos";

// Dev-only: the sheet, confirm and toast demos of Task 2.6. Task 3.0's gallery
// lists it. Absent unless the gallery switch is on.
export default function ShellGalleryPage() {
  if (process.env.NEXT_PUBLIC_VEIL_GALLERY !== "1") notFound();
  return <ShellDemos />;
}
