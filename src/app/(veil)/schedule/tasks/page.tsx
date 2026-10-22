import type { Metadata } from "next";
import { connection } from "next/server";
import { TasksScreen } from "@/veil/screens/tasks/tasks-screen";

export const metadata: Metadata = { title: "Tasks" };

export default async function TasksPage() {
  // Rendered per request: the screen reads its query (see `replaceAddress`).
  await connection();
  return <TasksScreen />;
}
