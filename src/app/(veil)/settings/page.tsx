import type { Metadata } from "next";
import { SettingsScreen } from "@/veil/screens/settings/settings-screen";

export const metadata: Metadata = { title: "Wedding settings" };

export default function SettingsPage() {
  return <SettingsScreen />;
}
