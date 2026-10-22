import type { Metadata } from "next";
import { connection } from "next/server";
import { FilesScreen } from "@/veil/screens/files/files-screen";

export const metadata: Metadata = { title: "Files" };

export default async function FilesPage() {
  // Rendered per request: the screen reads its query (see `replaceAddress`).
  await connection();
  return <FilesScreen />;
}
