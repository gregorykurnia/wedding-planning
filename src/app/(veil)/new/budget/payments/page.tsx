import type { Metadata } from "next";
import { Payments } from "@/veil/screens/payments/payments";

export const metadata: Metadata = { title: "Payments due" };

export default function PaymentsPage() {
  return <Payments />;
}
