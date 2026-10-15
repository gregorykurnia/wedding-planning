import type { IconProps } from "./icon-props";

/** WhatsApp's bubble mark, for the WhatsApp link (prototype `WA_ICON`). */
export function WhatsApp(props: IconProps) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      {...props}
      aria-hidden="true"
    >
      <path d="M2.5 13.5l.9-2.8A5.6 5.6 0 1 1 5.6 13z" />
      <path
        d="M6 5.5c0 2.5 2 4.5 4.5 4.5l.7-1.2-1.4-.7-.6.6c-.8-.3-1.5-1-1.8-1.8l.6-.6-.7-1.4z"
        fill="currentColor"
        stroke="none"
      />
    </svg>
  );
}
