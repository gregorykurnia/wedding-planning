import type { SVGProps } from "react";

/**
 * Props for every SVG icon here. `aria-hidden` is fixed: the control around an
 * icon carries its label (design guide §8), so an icon is never read on its own.
 */
export type IconProps = Omit<SVGProps<SVGSVGElement>, "aria-hidden">;
