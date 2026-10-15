import { notFound } from "next/navigation";
import { NavDemos } from "@/veil/gallery/nav-demos";

// Dev-only: the shell pieces of Task 2.4. Task 3.0's gallery lists it. Absent
// unless the gallery switch is on.
export default function NavGalleryPage() {
  if (process.env.NEXT_PUBLIC_VEIL_GALLERY !== "1") notFound();
  return <NavDemos />;
}
