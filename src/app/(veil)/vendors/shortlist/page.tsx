import type { Metadata } from "next";
import { ShortlistScreen } from "@/veil/screens/shortlist/shortlist-screen";

export const metadata: Metadata = { title: "Shortlist" };

export default function ShortlistPage() {
  return <ShortlistScreen />;
}
