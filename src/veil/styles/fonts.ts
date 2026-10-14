import { Cormorant_Garamond, Jost } from "next/font/google";

// Veil's two faces (design guide §2). Both are Google variable fonts. next/font
// rejects a weight range for them, so no weight is given and the whole weight
// axis loads (the design uses 300–700 of Cormorant and 300–600 of Jost).
// base.css maps the two variables onto --font-display and --font-text. The
// layout puts both classes on <html>, where :root reads them.
export const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  style: ["normal", "italic"],
  variable: "--font-cormorant",
  display: "swap",
});

export const jost = Jost({
  subsets: ["latin"],
  variable: "--font-jost",
  display: "swap",
});
