import type { Metadata } from "next";
import { BookingNewScreen } from "@/veil/screens/booking-new/booking-new-screen";

export const metadata: Metadata = { title: "Add a booking" };

export default function BookingNewPage() {
  return <BookingNewScreen />;
}
