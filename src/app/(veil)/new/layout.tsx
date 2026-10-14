import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Providers } from "@/veil/shell/providers";

export const metadata: Metadata = {
  title: "Our wedding planner",
};

// Root layout of the new UI. Nothing from the old UI is imported here, so no
// styles or providers leak across (a separate root layout means a full page
// load between the two).
export default function NewUiLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
