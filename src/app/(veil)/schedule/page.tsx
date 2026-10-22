import type { Metadata } from "next";
import { connection } from "next/server";
import { ScheduleScreen } from "@/veil/screens/schedule/schedule-screen";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  // Rendered per request: the screen reads its query (see `replaceAddress`).
  await connection();
  return <ScheduleScreen />;
}
