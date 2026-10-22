import type { Metadata } from "next";
import { Bookings } from "@/veil/screens/bookings/bookings";

export const metadata: Metadata = { title: "Bookings" };

export default function BookingsPage() {
  return <Bookings />;
}
