import type { IconProps } from "./icon-props";

/** A five-point star outline (prototype `ICO.star` in `items.html`). */
export function Star(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinejoin="round"
      {...props}
      aria-hidden="true"
    >
      <path d="M10 2.8l2.2 4.6 5 .6-3.7 3.4 1 5-4.5-2.5-4.5 2.5 1-5L2.8 8l5-.6z" />
    </svg>
  );
}
