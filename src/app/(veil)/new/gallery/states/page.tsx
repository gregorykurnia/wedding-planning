import { notFound } from "next/navigation";
import { StatesDemos } from "@/veil/gallery/states-demos";

// Dev-only: the whole-screen states, messages, banners and skeleton of Task 2.5.
// Task 3.0's gallery lists it. Absent unless the gallery switch is on.
export default function StatesGalleryPage() {
  if (process.env.NEXT_PUBLIC_VEIL_GALLERY !== "1") notFound();
  return <StatesDemos />;
}
