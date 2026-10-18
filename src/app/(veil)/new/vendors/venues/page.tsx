import type { Metadata } from "next";
import { VenuesScreen } from "@/veil/screens/venues/venues-screen";

export const metadata: Metadata = { title: "Venues" };

export default function VenuesPage() {
  return <VenuesScreen />;
}
