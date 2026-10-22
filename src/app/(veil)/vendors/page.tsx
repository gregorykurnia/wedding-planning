import type { Metadata } from "next";
import { connection } from "next/server";
import { VendorsScreen } from "@/veil/screens/vendors/vendors-screen";

export const metadata: Metadata = { title: "Vendors" };

export default async function VendorsPage() {
  // Rendered per request: the screen reads its query (see `replaceAddress`).
  await connection();
  return <VendorsScreen />;
}
