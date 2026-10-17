import type { Metadata } from "next";
import { VendorsScreen } from "@/veil/screens/vendors/vendors-screen";

export const metadata: Metadata = { title: "Vendors" };

export default function VendorsPage() {
  return <VendorsScreen />;
}
