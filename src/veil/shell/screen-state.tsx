"use client";

import type { ReactNode } from "react";
import type { Loaded } from "@/lib/data/settings";
import { Btn } from "@/veil/parts/actions/btn";
import { Message } from "@/veil/parts/message/message";
import { Shimmer } from "@/veil/parts/shimmer/shimmer";
import { useBusyClaim } from "./busy";
import styles from "./screen-state.module.css";

type ScreenStateProps<T> = {
  /** What a read hook returned, such as `useSettings()`. */
  read: Loaded<T>;
  /** The screen's content as a phrase for the copy: "the budget". */
  what: string;
  /** Called by Try again, to read again. */
  onRetry: () => void;
  /**
   * The screen, given its data. It is called only when there's something to
   * show: with cached data (even offline), and with null in demonstration mode,
   * where the screen shows its empty set.
   */
  children: (data: T | null) => ReactNode;
};

/**
 * What a screen shows while its read is loading, has failed, is offline, or is
 * in demonstration mode (guide §5 and §6.4 to §6.6). A whole-screen message
 * only appears when no data has arrived; data already on screen stays there.
 * The demonstration banner isn't here: the shell draws it above `main`.
 */
export function ScreenState<T>({ read, what, onRetry, children }: ScreenStateProps<T>) {
  const { status, data } = read;
  useBusyClaim(status === "loading");

  if (status === "loading") {
    return (
      <>
        <p className="sr">Loading {what}</p>
        <Shimmer />
      </>
    );
  }
  if (data === null && status === "error") {
    return (
      <Message
        kind="failure"
        title={`${capitalise(what)} didn’t load`}
        actions={<Btn onClick={onRetry}>Try again</Btn>}
      >
        The planner couldn’t reach its database. Your data is safe; it just isn’t here yet.
      </Message>
    );
  }
  if (data === null && status === "offline") {
    return (
      <Message
        kind="offline"
        title="You’re offline"
        actions={
          <Btn variant="quiet" onClick={onRetry}>
            Try again
          </Btn>
        }
      >
        The planner needs a connection to show {what}. It will load again as soon as this{" "}
        <span className={styles.phone}>phone</span>
        <span className={styles.computer}>computer</span> is back online.
      </Message>
    );
  }
  return <>{children(data)}</>;
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
