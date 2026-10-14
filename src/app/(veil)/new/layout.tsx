import type { ReactNode } from "react";
import "@/veil/styles/tokens.css";
import "@/veil/styles/base.css";
import { cormorant, jost } from "@/veil/styles/fonts";

// Root layout of the new UI: tokens, base styles and fonts. Providers come in
// Task 2.3, so nothing from the old UI can leak in.
export default function NewUiLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jost.variable}`}>
      <body>{children}</body>
    </html>
  );
}
