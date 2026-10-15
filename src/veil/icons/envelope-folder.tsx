import type { IconProps } from "./icon-props";

/** A folder drawn as an envelope (prototype `FOLDER` in `files.html`). */
export function EnvelopeFolder(props: IconProps) {
  return (
    <svg
      viewBox="0 0 26 26"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      {...props}
      aria-hidden="true"
    >
      <rect x="3" y="7" width="20" height="14" rx="2" />
      <path d="M3 9l10 7 10-7" />
    </svg>
  );
}
