import { Btn } from "@/veil/parts/actions/btn";
import { Message } from "@/veil/parts/message/message";
import { veilHref } from "../href";

/**
 * The "Something went wrong" message (guide §5.25, N2) for a screen that threw
 * while drawing. The top bar stays above it, so there's always a way somewhere
 * familiar, and Try again draws the screen again.
 */
export function Unexpected({ onRetry }: { onRetry: () => void }) {
  return (
    <Message
      kind="failure"
      title="Something went wrong"
      actions={
        <>
          <Btn variant="quiet" href={veilHref("/")}>
            Go to the overview
          </Btn>
          <Btn onClick={onRetry}>Try again</Btn>
        </>
      }
    >
      The planner ran into a problem it didn’t expect. Everything you’ve saved is safe; only this
      screen didn’t open.
    </Message>
  );
}
