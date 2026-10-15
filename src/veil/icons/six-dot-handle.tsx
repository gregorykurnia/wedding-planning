import type { IconProps } from "./icon-props";

/** Six dots in two columns, the handle for moving a row (prototype `ICO.handle` in `items.html`). */
export function SixDotHandle(props: IconProps) {
  return (
    <svg viewBox="0 0 12 18" fill="currentColor" {...props} aria-hidden="true">
      <circle cx="3" cy="3" r="1.3" />
      <circle cx="9" cy="3" r="1.3" />
      <circle cx="3" cy="9" r="1.3" />
      <circle cx="9" cy="9" r="1.3" />
      <circle cx="3" cy="15" r="1.3" />
      <circle cx="9" cy="15" r="1.3" />
    </svg>
  );
}
