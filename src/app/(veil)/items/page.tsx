import type { Metadata } from "next";
import { ItemsScreen } from "@/veil/screens/items/items-screen";

export const metadata: Metadata = { title: "Wedding items" };

export default function ItemsPage() {
  return <ItemsScreen />;
}
