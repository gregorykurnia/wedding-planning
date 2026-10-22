import type { Metadata } from "next";
import { BookingScreen } from "@/veil/screens/booking/booking-screen";

export const metadata: Metadata = { title: "Booking" };

export default async function BookingPage({ params }: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await params;
  return <BookingScreen bookingId={decodeURIComponent(bookingId)} />;
}
