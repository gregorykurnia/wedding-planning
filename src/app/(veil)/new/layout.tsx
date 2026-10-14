import type { ReactNode } from "react";

// Root layout of the new UI. Bare on purpose: no styles, fonts or providers
// until Phase 2, so nothing from the old UI can leak in.
export default function NewUiLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
