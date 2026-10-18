/** The words of the Shortlist screen (guide §5.13, §6.7), pure so the tests read them. */

export const NAME_MISSING = "Give the finalist a name.";
export const ADD_FAILED =
  "The finalist wasn’t added: the planner lost its connection. Everything you entered is still here.";

export const addedToast = (name: string) => `Added ${name} to the shortlist`;

/** The flag on a finalist that became a booking. */
export const BOOKED_FLAG = "Now a booking";

export const addSheet = {
  title: "Add a finalist",
  sub: "Straight onto the shortlist, without adding a vendor first.",
  namePlaceholder: "For example, Arka Visual",
  packagePlaceholder: "For example, Signature",
};
