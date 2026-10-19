import type { Metadata } from "next";
import { GuestsScreen } from "@/veil/screens/guests/guests-screen";

export const metadata: Metadata = { title: "Guests" };

export default function GuestsPage() {
  return <GuestsScreen />;
}
