import type { Metadata } from "next";
import { connection } from "next/server";
import { VenuesScreen } from "@/veil/screens/venues/venues-screen";

export const metadata: Metadata = { title: "Venues" };

export default async function VenuesPage() {
  // Rendered per request: the screen reads its query (see `replaceAddress`).
  await connection();
  return <VenuesScreen />;
}
