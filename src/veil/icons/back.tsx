import type { IconProps } from "./icon-props";

/** A chevron pointing left, for back links (prototype `ICON.back`). */
export function Back(props: IconProps) {
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
      <path d="M10 3L5 8l5 5" />
    </svg>
  );
}
