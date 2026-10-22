import type { Metadata } from "next";
import { ScheduleScreen } from "@/veil/screens/schedule/schedule-screen";

export const metadata: Metadata = { title: "Schedule" };

export default function ScheduleMonthPage() {
  return <ScheduleScreen view="month" />;
}
