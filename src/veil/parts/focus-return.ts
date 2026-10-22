import type { MouseEvent } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

/**
 * Waits for the pressed control to leave the page (the screen's write may take a few frames to show), then,
 * if focus has fallen to the page, runs `then`. A control that stays keeps its focus, and nothing happens.
 */
function whenFocusLost(from: Element, then: () => void) {
  const until = performance.now() + 2000;
  const look = () => {
    if (from.isConnected) {
      if (performance.now() < until) requestAnimationFrame(look);
      return;
    }
    // One more frame, so the places `then` looks at are drawn.
    requestAnimationFrame(() => {
      const now = document.activeElement;
      if (!now || now === document.body || !now.isConnected) then();
    });
  };
  requestAnimationFrame(look);
}

/**
 * Guide §8, "Focus". A press that removes the control (Show everything, Back to our order, the last Show
 * more) would drop keyboard focus to the page; this moves it to the screen's search field, or to its first
 * button or link when there is none. A press that leaves the control in place keeps focus where it is.
 */
export function focusSearchAfter(event: MouseEvent<HTMLElement>) {
  const from = event.currentTarget;
  const scope = from.closest("main") ?? document.body;
  whenFocusLost(from, () => {
    const target =
      scope.querySelector<HTMLElement>('input[type="search"]') ??
      scope.querySelector<HTMLElement>(FOCUSABLE);
    target?.focus();
  });
}

/**
 * Guide §8, "Focus". The last Show more removes itself; focus goes to the first button, link or field
 * the press added (the first new row), found by comparing what could take focus before and after.
 */
export function focusFirstNewAfter(event: MouseEvent<HTMLElement>) {
  const from = event.currentTarget;
  const scope = from.closest("main") ?? document.body;
  const before = new Set(scope.querySelectorAll(FOCUSABLE));
  whenFocusLost(from, () => {
    const fresh = [...scope.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
      (el) => !before.has(el),
    );
    (
      fresh ?? scope.querySelector<HTMLElement>('input[type="search"]')
    )?.focus();
  });
}

const shown = (el: HTMLElement | null | undefined): el is HTMLElement => Boolean(el?.isConnected && el.getClientRects().length > 0);

/**
 * Guide §8, "Focus". A one-tap action that takes the focused control off the page (finishing a task moves it
 * into a closed list, removing a step removes its ×); `from` is the control pressed. Each `where` names a place to try, in order, read after
 * the screen has redrawn; the first one that is on the page and visible takes focus. Nothing moves if focus
 * is still on something real.
 */
export function focusNextAvailable(from: Element, ...where: (() => HTMLElement | null | undefined)[]) {
  whenFocusLost(from, () => {
    for (const place of where) {
      const el = place();
      if (shown(el)) return el.focus();
    }
  });
}
