import type { IconProps } from "./icon-props";

/** A heart outline (prototype `HEART`). */
export function Heart(props: IconProps) {
  return (
    <svg viewBox="0 0 20 20" {...props} aria-hidden="true">
      <path
        d="M10 17s-6.5-3.9-6.5-8.6A3.6 3.6 0 0 1 10 6a3.6 3.6 0 0 1 6.5 2.4C16.5 13.1 10 17 10 17z"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.3}
        strokeLinejoin="round"
      />
    </svg>
  );
}
