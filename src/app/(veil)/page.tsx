import type { Metadata } from "next";
import { Overview } from "@/veil/screens/overview/overview";

export const metadata: Metadata = { title: "Overview" };

export default function OverviewPage() {
  return <Overview />;
}
