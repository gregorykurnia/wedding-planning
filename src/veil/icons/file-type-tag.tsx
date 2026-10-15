import type { HTMLAttributes } from "react";

/**
 * A file's extension as text, such as `pdf` (prototype `.ext` in `app.js`). The
 * prototype writes it as text rather than drawing it, so this is a span. The
 * file's name is already read out, so it's hidden. The screen styles it.
 */
export function FileTypeTag({
  ext,
  ...props
}: { ext: string } & Omit<HTMLAttributes<HTMLSpanElement>, "children">) {
  return (
    <span {...props} aria-hidden="true">
      {ext}
    </span>
  );
}
