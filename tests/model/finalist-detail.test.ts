import { describe, expect, it } from "vitest";
import {
  chosenNote,
  finalistDetail,
  followersMessage,
  packageChip,
  packageMeta,
  packageName,
  removeFinalistBody,
  reviewsMessage,
  type FinalistDetailSource,
  type FinalistExtras,
} from "@/lib/model/finalist-detail";

// Task 4.14: a finalist's own screen as it reads the stored finalist (guide §5.14; F17, F18, F20, F24).

const pkg = (id: string, name: string, price: number, over: Record<string, unknown> = {}) => ({
  id,
  name,
  price,
  includes: "",
  reviewers: null,
  step: "",
  notes: "",
  ...over,
});

const source = (over: Partial<FinalistDetailSource> = {}): FinalistDetailSource => ({
  id: "f1",
  name: "Kebun Bunga Atelier",
  category: "Decoration",
  contactName: "",
  contactPhone: "",
  reviewers: null,
  igFollowers: null,
  step: "",
  notes: "",
  packages: [pkg("main", "Silver", 45_000_000)],
  preferredPackageId: "main",
  sourceVendorId: null,
  bookingId: null,
  ...over,
});

const extras = (over: Partial<FinalistExtras> = {}): FinalistExtras => ({
  sourceVendor: null,
  files: [],
  packageFiles: {},
  ...over,
});

describe("finalistDetail", () => {
  it("leaves out the finalist's own price until it has a name or a price, and leans on the first package then", () => {
    const bare = finalistDetail(
      source({ packages: [pkg("main", "", 0), pkg("k1", "Gold", 62_500_000)], preferredPackageId: "main" }),
      extras(),
    );
    expect(bare.packages.map((p) => p.id)).toEqual(["k1"]);
    expect(bare.leaningId).toBe("k1");
    expect(bare.packages[0].leaning).toBe(true);
  });

  it("marks the package the finalist leans towards, and the first when that one is gone", () => {
    const packages = [pkg("main", "Silver", 45), pkg("k1", "Gold", 62)];
    const chosen = finalistDetail(source({ packages, preferredPackageId: "k1" }), extras());
    expect(chosen.packages.map((p) => p.leaning)).toEqual([false, true]);
    const gone = finalistDetail(source({ packages, preferredPackageId: "removed" }), extras());
    expect(gone.packages.map((p) => p.leaning)).toEqual([true, false]);
  });

  it("has no leaning package, and says so, when there are no packages", () => {
    const none = finalistDetail(source({ packages: [pkg("main", "", 0)] }), extras());
    expect(none.packages).toEqual([]);
    expect(none.leaningId).toBeNull();
  });

  it("gives the finalist's own price no reviews, step, notes or files: those are the finalist's", () => {
    const f = finalistDetail(
      source({
        packages: [pkg("main", "Silver", 45, { reviewers: 12, step: "Call", notes: "Hi" }), pkg("k1", "Gold", 62, { reviewers: 3, step: "Visit", notes: "Ask" })],
      }),
      extras({ packageFiles: { k1: [{ id: "a", name: "Q.pdf", url: "u", size: null, mime: "", fromVendor: false }] } }),
    );
    expect(f.packages[0]).toMatchObject({ main: true, reviewers: null, step: "", notes: "", fileCount: 0 });
    expect(f.packages[1]).toMatchObject({ main: false, reviewers: 3, step: "Visit", notes: "Ask", fileCount: 1 });
  });

  it("says where the finalist came from: a vendor still in Vendors, one that has gone, or nowhere", () => {
    const vendor = { id: "v1", name: "Kebun Bunga Atelier", booked: false };
    expect(finalistDetail(source({ sourceVendorId: "v1" }), extras({ sourceVendor: vendor }))).toMatchObject({
      sourceVendor: vendor,
      sourceGone: false,
    });
    expect(finalistDetail(source({ sourceVendorId: "v1" }), extras())).toMatchObject({ sourceVendor: null, sourceGone: true });
    expect(finalistDetail(source(), extras())).toMatchObject({ sourceVendor: null, sourceGone: false });
  });

  it("knows a finalist that is a booking, and the booking to open", () => {
    const booked = finalistDetail(source({ bookingId: "vendor-v1" }), extras());
    expect(booked).toMatchObject({ booked: true, bookingId: "vendor-v1", hasBooking: true });
    const moved = finalistDetail(source({ sourceVendorId: "v1" }), extras());
    expect(moved).toMatchObject({ booked: false, bookingId: null, hasBooking: false });
    // A booked vendor behind the copy counts for what removing leaves behind, though the finalist isn't flagged.
    const behind = finalistDetail(
      source({ sourceVendorId: "v1" }),
      extras({ sourceVendor: { id: "v1", name: "K", booked: true } }),
    );
    expect(behind).toMatchObject({ booked: false, hasBooking: true });
  });
});

describe("the words", () => {
  it("calls a package with no name 'Package'", () => {
    expect(packageName({ name: "  " })).toBe("Package");
    expect(packageName({ name: "Full styling" })).toBe("Full styling");
  });

  it("joins a package's reviews, next step and files with full stops", () => {
    expect(packageMeta({ reviewers: 120, step: "Send the quote", fileCount: 2 })).toBe("120 reviews. Next: Send the quote. 2 files");
    expect(packageMeta({ reviewers: 1, step: "", fileCount: 0 })).toBe("1 review");
    expect(packageMeta({ reviewers: null, step: "  ", fileCount: 1 })).toBe("1 file");
    expect(packageMeta({ reviewers: null, step: "", fileCount: 0 })).toBe("");
    expect(packageMeta({ reviewers: 1200, step: "", fileCount: 0 })).toBe("1.200 reviews");
  });

  it("names the package chips with their price", () => {
    expect(packageChip("Gold", 62_500_000)).toBe("Gold, Rp 62.500.000");
  });

  it("offers Move into Vendors only to a finalist from scratch", () => {
    expect(chosenNote(true)).toContain("or move it into Vendors to keep it on file");
    expect(chosenNote(false)).not.toContain("Vendors");
  });

  it("says what removing a finalist takes and leaves (N10)", () => {
    const base = { name: "Kebun Bunga Atelier", packageCount: 2, vendorName: null, fileCount: 0, hasBooking: false };
    expect(removeFinalistBody({ ...base, vendorName: "Kebun Bunga Atelier" })).toBe(
      "It leaves the shortlist, with its 2 packages. Kebun Bunga Atelier stays in Vendors, files and all. You can undo for a few seconds.",
    );
    expect(removeFinalistBody({ ...base, packageCount: 0, fileCount: 1 })).toBe(
      "It leaves the shortlist. Its file stays in Files › Shortlist › Kebun Bunga Atelier. You can undo for a few seconds.",
    );
    expect(removeFinalistBody({ ...base, packageCount: 1, fileCount: 1500, hasBooking: true })).toBe(
      "It leaves the shortlist, with its 1 package. Its 1.500 files stay in Files › Shortlist › Kebun Bunga Atelier. Its booking stays in the budget. You can undo for a few seconds.",
    );
    expect(removeFinalistBody({ ...base, packageCount: 0 })).toBe("It leaves the shortlist. You can undo for a few seconds.");
  });

  it("quotes what was typed in a count that isn't one, and says what it stays as (N16's pattern)", () => {
    expect(reviewsMessage("words", "lots", 120)).toBe("“lots” isn’t a number of reviews. Use digits, like 120. It stays 120.");
    expect(followersMessage("words", "12k", null)).toBe("“12k” isn’t a number of followers. Use digits, like 12000. Nothing was changed.");
    expect(followersMessage("big", "1234567890123", 5000)).toBe(
      "That’s more followers than this can hold: up to 999.999.999. It stays 5.000.",
    );
  });
});
