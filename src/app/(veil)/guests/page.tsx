import type { Metadata } from "next";
import { connection } from "next/server";
import { GuestsScreen } from "@/veil/screens/guests/guests-screen";

export const metadata: Metadata = { title: "Guests" };

export default async function GuestsPage() {
  // Rendered per request: the screen reads its query (see `replaceAddress`).
  await connection();
  return <GuestsScreen />;
}
