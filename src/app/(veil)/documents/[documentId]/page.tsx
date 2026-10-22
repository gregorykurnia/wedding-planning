import type { Metadata, Viewport } from "next";
import { DocumentScreen } from "@/veil/screens/document/document-screen";

export const metadata: Metadata = { title: "Document" };

// On a phone the keyboard shrinks the page (where the browser allows it), so the
// docked toolbar stays above it (guide §4.24); use-keyboard-dock covers iOS.
export const viewport: Viewport = { interactiveWidget: "resizes-content" };

/**
 * A document (guide §5.17). `/documents/new?start=meeting` or `?start=blank`
 * starts one; it is made on its first save, and the address then becomes the
 * document's own.
 */
export default async function DocumentPage({
  params,
  searchParams,
}: {
  params: Promise<{ documentId: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { documentId } = await params;
  const { start } = await searchParams;
  return <DocumentScreen id={documentId} start={start === "meeting" ? "meeting" : "blank"} />;
}
