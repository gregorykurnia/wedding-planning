import type { Metadata } from "next";
import { Budget } from "@/veil/screens/budget/budget";

export const metadata: Metadata = { title: "Budget" };

export default function BudgetPage() {
  return <Budget />;
}
