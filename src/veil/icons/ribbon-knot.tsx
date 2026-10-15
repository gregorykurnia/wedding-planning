import type { IconProps } from "./icon-props";

/**
 * The ribbon knot, the mark for empty and quiet moments (prototype `ICON.knot`,
 * the same drawing as in `signin.html`). The caller sets its size.
 */
export function RibbonKnot(props: IconProps) {
  return (
    <svg
      viewBox="0 0 72 72"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      {...props}
      aria-hidden="true"
    >
      <path d="M36 36c-8-10-22-14-24-6s14 10 24 6zM36 36c8-10 22-14 24-6s-14 10-24 6z" />
      <path d="M36 36c-4 8-10 18-14 24M36 36c4 8 10 18 14 24" />
      <circle cx="36" cy="36" r="3" />
    </svg>
  );
}
