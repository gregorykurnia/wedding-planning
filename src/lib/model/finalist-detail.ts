/**
 * A finalist's own screen (guide §5.14; F17, F18, F20, F24, B1, N10): the hero's
 * figure and origin, the packages and their lines, and the words of the Book it
 * and Move into Vendors sheets and of the removals.
 *
 * Pure: the data hook reads the documents and hands plain values in.
 */
import { group, plural, rp } from "./format";
import { isPackage } from "./shortlist";
import { readReviewers, type CountProblem } from "./vendor-detail";

/** The finalist's own top-level price is the package with this id (the data layer's `MAIN_PACKAGE_ID`). */
const MAIN = "main";

/** One package as the screen shows it. */
export interface PackageView {
  id: string;
  /** What was typed; "" when the package was added without a name. */
  name: string;
  price: number;
  /** What's included, under the name. */
  includes: string;
  reviewers: number | null;
  step: string;
  notes: string;
  /** The package we're leaning towards. */
  leaning: boolean;
  /** The finalist's own price: it has no reviews, step, notes or files of its own, the finalist does. */
  main: boolean;
  /** Files attached to this package; always 0 for the finalist's own price. */
  fileCount: number;
}

/** What the screen reads from a stored finalist (the data layer's `FinalistDoc` has all of it). */
export interface FinalistDetailSource {
  id: string;
  name: string;
  category: string;
  contactName: string;
  contactPhone: string;
  reviewers: number | null;
  igFollowers: number | null;
  step: string;
  notes: string;
  packages: readonly {
    id: string;
    name: string;
    price: number;
    includes: string;
    reviewers: number | null;
    step: string;
    notes: string;
  }[];
  preferredPackageId: string;
  sourceVendorId: string | null;
  /** The booking it is, while that booking stands (the data layer reads the vendor). */
  bookingId: string | null;
}

export interface FinalistFile {
  /** The `weddingFiles` id; null for a legacy file only on the record. */
  id: string | null;
  name: string;
  url: string;
  size: number | null;
  mime: string;
  /** Came with the vendor it was copied from, not uploaded on the finalist. */
  fromVendor: boolean;
}

export interface FinalistExtras {
  /** The vendor it was copied from, when that vendor is still in Vendors. */
  sourceVendor: { id: string; name: string; booked: boolean } | null;
  files: FinalistFile[];
  /** The files on each package, by the package's id. */
  packageFiles: Record<string, FinalistFile[]>;
}

export interface FinalistDetail {
  id: string;
  name: string;
  category: string;
  contactName: string;
  contactPhone: string;
  reviewers: number | null;
  followers: number | null;
  step: string;
  notes: string;
  packages: PackageView[];
  /** The package we're leaning towards, if there is one. */
  leaningId: string | null;
  sourceVendor: FinalistExtras["sourceVendor"];
  /** Copied from a vendor, which isn't in Vendors any more. */
  sourceGone: boolean;
  /** Made a booking from here: the flag and the way to it. */
  booked: boolean;
  bookingId: string | null;
  /** The finalist or the vendor it came from is a booking, so removing it leaves that behind. */
  hasBooking: boolean;
  files: FinalistFile[];
  packageFiles: Record<string, FinalistFile[]>;
}

export function finalistDetail(f: FinalistDetailSource, extras: FinalistExtras): FinalistDetail {
  const real = f.packages.filter(isPackage);
  // As on the shortlist card: when the chosen package is empty or gone, the first one shown is the one.
  const leaning = real.find((p) => p.id === f.preferredPackageId) ?? real[0];
  const packages = real.map<PackageView>((p) => {
    const main = p.id === MAIN;
    return {
      id: p.id,
      name: p.name,
      price: p.price,
      includes: p.includes,
      reviewers: main ? null : p.reviewers,
      step: main ? "" : p.step,
      notes: main ? "" : p.notes,
      leaning: p === leaning,
      main,
      fileCount: main ? 0 : (extras.packageFiles[p.id]?.length ?? 0),
    };
  });
  const booked = f.bookingId !== null;
  return {
    id: f.id,
    name: f.name,
    category: f.category,
    contactName: f.contactName,
    contactPhone: f.contactPhone,
    reviewers: f.reviewers,
    followers: f.igFollowers,
    step: f.step,
    notes: f.notes,
    packages,
    leaningId: leaning?.id ?? null,
    sourceVendor: extras.sourceVendor,
    sourceGone: f.sourceVendorId !== null && extras.sourceVendor === null,
    booked,
    bookingId: f.bookingId,
    hasBooking: booked || Boolean(extras.sourceVendor?.booked),
    files: extras.files,
    packageFiles: extras.packageFiles,
  };
}

/** A package added without a name was added in a hurry: the screen calls it this. */
export const UNNAMED_PACKAGE = "Package";
export const packageName = (p: { name: string }) => p.name.trim() || UNNAMED_PACKAGE;

// ---------- the hero ----------

export const NO_PACKAGE_KICKER = "No package chosen yet";

/** "Added straight to the shortlist" or the copied-from line, whose vendor name is a link between its halves. */
export const ADDED_STRAIGHT = "Added straight to the shortlist";
export const COPIED_BEFORE = "Copied from";
export const COPIED_AFTER = "in Vendors. Changes here don’t touch it.";
/** Provisional (G26): the vendor it was copied from has been removed, so there is no name or link to give. */
export const COPIED_GONE = "Copied from a vendor that’s no longer in Vendors. Changes here don’t touch anything.";

// ---------- the sections ----------

export const packagesCount = (n: number) => plural(n, "package");
export const NO_PACKAGES = "No packages yet. Add each offer they make, with its own price and what’s included.";

/** The line under a package's included words: "120 reviews. Next: Send the quote. 2 files". */
export function packageMeta(p: Pick<PackageView, "reviewers" | "step" | "fileCount">): string {
  return [
    p.reviewers != null ? plural(p.reviewers, "review") : "",
    p.step.trim() ? `Next: ${p.step.trim()}` : "",
    p.fileCount ? plural(p.fileCount, "file") : "",
  ]
    .filter(Boolean)
    .join(". ");
}

export const filesFromVendor = (vendorName: string) =>
  `Files added to ${vendorName} in Vendors appear here by themselves.`;

export const packageAddedToast = (name: string) => `Added ${name}`;
export const packageRemovedToast = (name: string) => `Removed ${name}`;
export const packageRemoveTitle = (name: string) => `Remove ${name}?`;
export const packageRemoveBody = (price: number) => `${rp(price)}. You can undo for a few seconds.`;
/** Provisional (G26): the same sentence as a price option's (N24). */
export const PACKAGE_ADD_FAILED = "The package wasn’t added. What you typed is still here.";
export const ADD_PACKAGE_HINT = "Add the package first, then attach its files.";

// ---------- Book it and Move into Vendors ----------

export const CHOSEN_TITLE = "Chosen this one?";
export const chosenNote = (canMove: boolean) =>
  `Book it to make it a confirmed booking${canMove ? ", or move it into Vendors to keep it on file" : ""}. Its details come along, so nothing is typed twice.`;

export const bookTitle = (name: string) => `Book ${name}`;
export const BOOK_SUB = "It becomes a confirmed booking, with the package you choose as its price.";
export const BOOK_NO_PACKAGES = "No packages yet, so the booking starts without a price.";
export const BOOK_CARRIES = "Contact, notes and files come along. You’ll set the funder and due dates on the booking.";
export const packageChip = (name: string, price: number) => `${name}, ${rp(price)}`;
export const bookedToast = (name: string) => `${name} is now a booking`;
/** Provisional (G26): a booking or a move that didn't land says nothing was changed and keeps the sheet. */
export const BOOK_FAILED = "Couldn’t book it. Nothing was changed. Try again.";

export const moveTitle = (name: string) => `Move ${name} into Vendors?`;
export const MOVE_SUB =
  "Its packages become price options, and contact, reviews, notes and files come along. It stays on the shortlist too.";
export const movedToast = (name: string) => `${name} is now in Vendors`;
export const MOVE_FAILED = "Couldn’t move it into Vendors. Nothing was changed. Try again.";

// ---------- removing the finalist (N10) ----------

export const removeFinalistTitle = (name: string) => `Remove ${name} from the shortlist?`;

export interface RemoveFacts {
  name: string;
  packageCount: number;
  /** The vendor it was copied from, when it is still in Vendors. */
  vendorName: string | null;
  fileCount: number;
  hasBooking: boolean;
}

/**
 * What the confirm says (N10): what leaves with the finalist, then what stays
 * (the vendor and its files, or the finalist's own files, and any booking),
 * then the undo promise.
 */
export function removeFinalistBody(f: RemoveFacts): string {
  const stays = [
    f.vendorName
      ? `${f.vendorName} stays in Vendors, files and all.`
      : f.fileCount
        ? `${f.fileCount === 1 ? "Its file stays" : `Its ${group(f.fileCount)} files stay`} in Files › Shortlist › ${f.name}.`
        : "",
    f.hasBooking ? "Its booking stays in the budget." : "",
  ].filter(Boolean);
  return [
    `It leaves the shortlist${f.packageCount ? `, with its ${plural(f.packageCount, "package")}` : ""}.`,
    ...stays,
    "You can undo for a few seconds.",
  ].join(" ");
}

export const REMOVE_ACTION = "Remove finalist";
export const removedTitle = (name: string) => `${name} was removed from the shortlist`;
export const removedToast = (name: string) => `Removed ${name} from the shortlist`;
export const SEE_SHORTLIST = "See the shortlist";

export const NOT_HERE = {
  title: "This finalist isn’t here",
  body: "The link may be out of date, or the finalist was removed a while ago. Everything else is just where you left it.",
};
export const DEMO_NONE = "Nothing on the shortlist in demonstration mode";

export const removedByPartner = (partner: string) => ({
  title: "This finalist was removed",
  body: `${partner} removed it on another device a moment ago.`,
});

// ---------- reviews and followers ----------

/** Reviews and followers are counts of people, read as the vendor's reviewers are. */
export const readCount = readReviewers;

const SHOWN = 40;
const quoted = (typed: string) => {
  const t = typed.trim();
  return `“${t.length > SHOWN ? `${t.slice(0, SHOWN)}…` : t}”`;
};

/** N16's pattern for a count: quote what was typed, say what it stays as. */
function countMessage(noun: string, example: string) {
  return (problem: CountProblem, typed: string, before: number | null): string => {
    const stays = before === null ? "Nothing was changed." : `It stays ${group(before)}.`;
    return problem === "big"
      ? `That’s more ${noun} than this can hold: up to 999.999.999. ${stays}`
      : `${quoted(typed)} isn’t a number of ${noun}. Use digits, like ${example}. ${stays}`;
  };
}

export const reviewsMessage = countMessage("reviews", "120");
export const followersMessage = countMessage("followers", "12000");
