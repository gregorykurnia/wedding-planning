import type { Metadata } from "next";
import { connection } from "next/server";
import { Bookings } from "@/veil/screens/bookings/bookings";

export const metadata: Metadata = { title: "Bookings" };

export default async function BookingsPage() {
  // Rendered per request: the screen reads its query (see `replaceAddress`).
  await connection();
  return <Bookings />;
}
