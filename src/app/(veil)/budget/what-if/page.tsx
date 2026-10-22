import type { Metadata } from "next";
import { WhatIfScreen } from "@/veil/screens/what-if/what-if-screen";

export const metadata: Metadata = { title: "What-if items" };

export default function WhatIfPage() {
  return <WhatIfScreen />;
}
