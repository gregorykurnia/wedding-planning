"use client";

import { Unexpected } from "@/veil/shell/unexpected";

// A screen threw while drawing (guide §5.25, N2). This boundary sits inside the
// new UI's layout, so the top bar and menu stay above the message. An error in
// that layout itself isn't caught here.
export default function ErrorPage({
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  return <Unexpected onRetry={unstable_retry} />;
}
