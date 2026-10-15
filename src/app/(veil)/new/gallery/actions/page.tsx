import { notFound } from "next/navigation";
import { ActionDemos } from "@/veil/gallery/actions-demos";

// Dev-only: the buttons, links and chips of Task 3.3. Task 3.0's gallery lists
// this page. Absent unless the gallery switch is on.
export default function ActionsGalleryPage() {
  if (process.env.NEXT_PUBLIC_VEIL_GALLERY !== "1") notFound();
  return <ActionDemos />;
}
