import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/veil/styles/tokens.css";
import "@/veil/styles/base.css";
import { cormorant, jost } from "@/veil/styles/fonts";
import { Providers } from "@/veil/shell/providers";

export const metadata: Metadata = {
  // "Sign in · Our wedding planner": each screen names itself, then the app (guide §3).
  title: { default: "Our wedding planner", template: "%s · Our wedding planner" },
};

// Root layout of the new UI. Nothing from the old UI is imported here, so no
// styles or providers leak across (a separate root layout means a full page
// load between the two).
export default function NewUiLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${jost.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
