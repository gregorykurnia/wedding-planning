import { withElementIds } from "@/lib/data/array-ops";
import { isObject, legacyFiles, millis, num, numOrNull, str, strOrNull, type LegacyFile } from "./common";

/** The finalist's own top-level price and description, read as a package with this id. */
export const MAIN_PACKAGE_ID = "main";

export interface Package {
  id: string;
  name: string;
  price: number;
  description: string;
  /** What's included, in the package's own words (`includes`, or the old screens' description when it isn't the name). */
  includes: string;
  reviewers: number | null;
  igFollowers: number | null;
  step: string;
  notes: string;
  files: LegacyFile[];
}

export interface FinalistDoc {
  id: string;
  name: string;
  category: string;
  contactName: string;
  contactPhone: string;
  /** `main` first, then the stored packages (`subEntries`). */
  packages: Package[];
  /** Falls back to `main` when unset or pointing at a removed package. */
  preferredPackageId: string;
  sourceVendorId: string | null;
  movedTo: { kind: "booking" | "vendor"; id: string } | null;
  reviewers: number | null;
  igFollowers: number | null;
  step: string;
  notes: string;
  files: LegacyFile[];
  createdAt: number | null;
  updatedAt: number | null;
  updatedBy: string | null;
}

export function finalistFromDoc(id: string, data: Record<string, unknown>): FinalistDoc {
  const main: Package = {
    id: MAIN_PACKAGE_ID,
    name: str(data.priceDescription),
    price: num(data.price),
    description: str(data.priceDescription),
    includes: str(data.includes),
    reviewers: numOrNull(data.bridestoryReviewers),
    igFollowers: numOrNull(data.igFollowers),
    step: str(data.nextAction),
    notes: "",
    files: [],
  };
  const stored = withElementIds<Record<string, unknown>>(data.subEntries).map(
    (p): Package => ({
      id: p.id,
      name: str(p.name),
      price: num(p.price),
      description: str(p.priceDescription),
      // A package the old screens made has its words in `priceDescription`; when they differ from the name they read as what's included.
      includes: str(p.includes) || (str(p.priceDescription).trim() !== str(p.name).trim() ? str(p.priceDescription) : ""),
      reviewers: numOrNull(p.bridestoryReviewers),
      igFollowers: numOrNull(p.igFollowers),
      step: str(p.nextAction),
      notes: str(p.notes),
      files: legacyFiles(p.files),
    }),
  );
  const packages = [main, ...stored];
  const preferred = strOrNull(data.preferredPackageId);
  const moved = isObject(data.movedTo) ? data.movedTo : null;
  const movedTo: FinalistDoc["movedTo"] =
    moved && (moved.kind === "booking" || moved.kind === "vendor") && typeof moved.id === "string"
      ? { kind: moved.kind, id: moved.id }
      : null;
  return {
    id,
    name: str(data.name),
    category: str(data.type) || "Other",
    contactName: str(data.contactName),
    contactPhone: str(data.contactPhone),
    packages,
    preferredPackageId:
      preferred && packages.some((p) => p.id === preferred) ? preferred : MAIN_PACKAGE_ID,
    sourceVendorId: strOrNull(data.sourceVendorId),
    movedTo,
    reviewers: numOrNull(data.bridestoryReviewers),
    igFollowers: numOrNull(data.igFollowers),
    step: str(data.nextAction),
    notes: str(data.notes),
    files: legacyFiles(data.files),
    createdAt: millis(data.createdAt),
    updatedAt: millis(data.updatedAt),
    updatedBy: strOrNull(data.updatedBy),
  };
}
