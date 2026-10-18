import { titleOrUntitled } from "@/lib/model/documents";

/** The words of a document's own screen (guide §5.17, §6.3, N2). */

export const NOT_HERE = {
  title: "This document isn’t here",
  body: "The link may be out of date, or the document was removed a while ago. Everything else is just where you left it.",
};

export const DEMO_NONE = {
  title: "No documents in demonstration mode",
  body: "The planner isn’t connected to its database yet.",
};

export const DELETED_HERE = { title: "Document deleted", body: "It’s gone for both of you." };

/** Deleted while it was open: by the partner, or on your own other device. */
export function deletedElsewhere(by: string | null) {
  return {
    title: "This document was deleted",
    body: by
      ? `${by} deleted it on another device. It can’t be brought back.`
      : "It was deleted on another device. It can’t be brought back.",
  };
}

export const partnerHere = (partner: string) =>
  `${partner} is also in this document. Their changes appear as they type.`;

/**
 * The screen went away (a browser Back) and the last change then didn't save.
 * Provisional (G23/N23): the guide words leaving through the planner's own
 * links (N18), not a change lost after the page has gone.
 */
export const lostOnLeave = (title: string) => `Your last changes to “${titleOrUntitled(title)}” didn’t save.`;
