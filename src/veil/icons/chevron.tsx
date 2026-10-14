import type { IconProps } from "./icon-props";

/** A chevron pointing right (prototype `ICON.chev`). */
export function Chevron(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.4}
      strokeLinecap="round"
      {...props}
      aria-hidden="true"
    >
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}
