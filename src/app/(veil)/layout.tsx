import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "@/veil/styles/tokens.css";
import "@/veil/styles/base.css";
import { cormorant, jost } from "@/veil/styles/fonts";
import { Providers } from "@/veil/shell/providers";
import { APP_IDENTITY, APP_NAME } from "@/lib/model/app-identity";

export const metadata: Metadata = {
  // "Sign in · Our wedding planner": each screen names itself, then the app (guide §3). Signed in,
  // the top bar swaps the app's name for the couple's (`useTabTitle`, guide §4.31).
  title: { default: APP_NAME, template: `%s · ${APP_NAME}` },
  description: APP_IDENTITY.description,
  // Added to an iPhone's home screen, it opens as an app under the short name (guide §4.31).
  appleWebApp: { capable: true, title: APP_IDENTITY.shortName, statusBarStyle: "default" },
};

// The browser bar on every new-UI screen (guide §4.31).
export const viewport: Viewport = {
  themeColor: APP_IDENTITY.themeColor,
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
