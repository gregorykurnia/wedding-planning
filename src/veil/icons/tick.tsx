import type { IconProps } from "./icon-props";

/** A tick inside a ring (prototype `ICO.conf` in `items.html`). */
export function Tick(props: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      {...props}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7.5" />
      <path d="M6.6 10.2l2.3 2.3 4.6-4.8" />
    </svg>
  );
}
