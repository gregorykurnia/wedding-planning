import type { IconProps } from "./icon-props";

/**
 * A cloud with a line through it, for the offline message (prototype
 * `ICON.cloud`). The caller sets its size.
 */
export function StruckCloud(props: IconProps) {
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
      <path d="M22 50h30a10 10 0 0 0 0-20 14 14 0 0 0-27-3 11 11 0 0 0-3 23z" />
      <path d="M14 14l44 44" />
    </svg>
  );
}
