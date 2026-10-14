import { describe, expect, it } from "vitest";
import {
  GUEST_ORDERS,
  ITEM_ORDERS,
  SHORTLIST_ORDERS,
  VENDOR_ORDERS,
  VENUE_ORDERS,
  directionWord,
  flip,
  orderFinalists,
  orderGuests,
  orderItems,
  orderVendors,
  orderVenues,
  ownOrder,
  paging,
  preferredPrice,
  sortBy,
  startDirection,
  type OrderableItem,
} from "@/lib/model/order";
import { buildCategories } from "@/lib/model/categories";

const ids = <T extends { id: string }>(rows: T[]) => rows.map((r) => r.id);

describe("sortBy", () => {
  const rows = [
    { id: "a", v: 2 as number | null },
    { id: "b", v: null },
    { id: "c", v: 10 },
    { id: "d", v: 2 },
    { id: "e", v: undefined as number | null | undefined },
  ];

  it("sorts numbers both ways with blanks always last", () => {
    expect(ids(sortBy(rows as { id: string; v: number | null }[], (r) => r.v, "asc"))).toEqual(["a", "d", "c", "b", "e"]);
    expect(ids(sortBy(rows as { id: string; v: number | null }[], (r) => r.v, "desc"))).toEqual(["c", "a", "d", "b", "e"]);
  });

  it("keeps rows that tie in the order they came in, both ways", () => {
    const tied = [{ id: "x", v: 1 }, { id: "y", v: 1 }, { id: "z", v: 1 }];
    expect(ids(sortBy(tied, (r) => r.v, "asc"))).toEqual(["x", "y", "z"]);
    expect(ids(sortBy(tied, (r) => r.v, "desc"))).toEqual(["x", "y", "z"]);
  });

  it("breaks ties with the tie rule, always ascending", () => {
    const tied = [{ id: "b", v: 1 }, { id: "a", v: 1 }, { id: "c", v: 2 }];
    const tie = (x: { id: string }, y: { id: string }) => x.id.localeCompare(y.id);
    expect(ids(sortBy(tied, (r) => r.v, "asc", tie))).toEqual(["a", "b", "c"]);
    expect(ids(sortBy(tied, (r) => r.v, "desc", tie))).toEqual(["c", "a", "b"]);
  });

  it("sorts text naturally, ignoring case and accents, with blanks last", () => {
    const text = [
      { id: "1", v: "Item 10" },
      { id: "2", v: "item 2" },
      { id: "3", v: "" },
      { id: "4", v: "Élan" },
      { id: "5", v: "   " },
      { id: "6", v: "Eagle" },
    ];
    expect(ids(sortBy(text, (r) => r.v, "asc"))).toEqual(["6", "4", "2", "1", "3", "5"]);
    expect(ids(sortBy(text, (r) => r.v, "desc"))).toEqual(["1", "2", "4", "6", "3", "5"]);
  });

  it("treats NaN as blank", () => {
    const rs = [{ id: "n", v: NaN }, { id: "m", v: 1 }];
    expect(ids(sortBy(rs, (r) => r.v, "asc"))).toEqual(["m", "n"]);
    expect(ids(sortBy(rs, (r) => r.v, "desc"))).toEqual(["m", "n"]);
  });

  it("copes with non-Latin text", () => {
    const rs = [{ id: "a", v: "婚礼" }, { id: "b", v: "Zed" }, { id: "c", v: "استوديو" }, { id: "d", v: "Abe" }];
    const out = ids(sortBy(rs, (r) => r.v, "asc"));
    expect(out.indexOf("d")).toBeLessThan(out.indexOf("b"));
    expect(out).toHaveLength(4);
  });

  it("doesn't change the list it was given", () => {
    const input = [{ id: "a", v: 2 }, { id: "b", v: 1 }];
    sortBy(input, (r) => r.v, "asc");
    expect(ids(input)).toEqual(["a", "b"]);
  });
});

describe("directions", () => {
  it("flips and names them", () => {
    expect(flip("asc")).toBe("desc");
    expect(flip("desc")).toBe("asc");
    expect(directionWord("asc")).toBe("Ascending");
    expect(directionWord("desc")).toBe("Descending");
  });

  it("starts numbers descending and text ascending (guide §4.12)", () => {
    expect(startDirection(VENDOR_ORDERS, "rating")).toBe("desc");
    expect(startDirection(VENDOR_ORDERS, "reviewers")).toBe("desc");
    expect(startDirection(VENDOR_ORDERS, "added")).toBe("desc");
    expect(startDirection(VENDOR_ORDERS, "name")).toBe("asc");
    expect(startDirection(VENDOR_ORDERS, "category")).toBe("asc");
    expect(startDirection(VENUE_ORDERS, "cost")).toBe("desc");
    expect(startDirection(VENUE_ORDERS, "capacity")).toBe("desc");
    expect(startDirection(VENUE_ORDERS, "name")).toBe("asc");
    expect(startDirection(GUEST_ORDERS, "plus")).toBe("desc");
    expect(startDirection(GUEST_ORDERS, "name")).toBe("asc");
  });

  it("starts the shortlist price low to high, reviews and followers high to low (guide §5.13)", () => {
    expect(startDirection(SHORTLIST_ORDERS, "price")).toBe("asc");
    expect(startDirection(SHORTLIST_ORDERS, "reviews")).toBe("desc");
    expect(startDirection(SHORTLIST_ORDERS, "followers")).toBe("desc");
  });

  it("starts guest numbers at guest 1", () => {
    expect(startDirection(GUEST_ORDERS, "number")).toBe("asc");
  });

  it("offers the orders each screen names", () => {
    expect(GUEST_ORDERS.map((o) => o.label)).toEqual([
      "Number",
      "Name",
      "Connection",
      "Country",
      "Invited to",
      "Invitation sent",
      "RSVP",
      "Plus-ones",
      "Food notes",
    ]);
    expect(VENDOR_ORDERS.map((o) => o.label)).toEqual(["Category", "Name", "Stage", "Rating", "Number of reviewers", "Date added"]);
    expect(VENUE_ORDERS.map((o) => o.label)).toEqual(["Cost", "Capacity", "Name"]);
    expect(ITEM_ORDERS.map((o) => o.label)).toEqual(["Our order", "Item", "Vendor", "Confirmed", "Events", "Who it's for", "Work on next"]);
    expect(SHORTLIST_ORDERS.map((o) => o.label)).toEqual(["Category", "Preferred price", "Reviews", "Instagram followers"]);
  });
});

describe("paging", () => {
  it("says how many more the button offers", () => {
    expect(paging(1206, 100, 100)).toEqual({ visible: 100, more: 100, hasMore: true });
    expect(paging(150, 100, 100)).toEqual({ visible: 100, more: 50, hasMore: true });
    expect(paging(100, 100, 100)).toEqual({ visible: 100, more: 0, hasMore: false });
    expect(paging(12, 100, 100)).toEqual({ visible: 12, more: 0, hasMore: false });
    expect(paging(0, 100, 100)).toEqual({ visible: 0, more: 0, hasMore: false });
    expect(paging(2004, 150, 150)).toEqual({ visible: 150, more: 150, hasMore: true });
  });
});

let n = 0;
const guest = (over = {}) => ({
  id: `g${++n}`,
  number: n as number | null,
  name: `Guest ${n}`,
  connection: "",
  country: "Indonesia",
  eventType: "Both",
  inviteSent: true,
  rsvpStatus: "pending",
  plusOnes: 0,
  allergies: "",
  ...over,
});

describe("orderGuests", () => {
  const list = [
    guest({ id: "a", number: 1, name: "Hendra", connection: "Groom's uncle", country: "Indonesia", eventType: "Reception", rsvpStatus: "yes", plusOnes: 1, inviteSent: true, allergies: "No pork" }),
    guest({ id: "b", number: 2, name: "Ayu", connection: "", country: "Singapore", eventType: "Both", rsvpStatus: "no", plusOnes: 3, inviteSent: false, allergies: "" }),
    guest({ id: "c", number: 3, name: "Budi", connection: "Bride's aunt", country: "Australia", eventType: "Unsure (Abroad)", rsvpStatus: "pending", plusOnes: 1, inviteSent: true, allergies: "Vegetarian" }),
    guest({ id: "d", number: 4, name: "Citra", connection: "Bride's cousin", country: "", eventType: "Matrimony", rsvpStatus: "pending", plusOnes: 0, inviteSent: false, allergies: "Allergic to peanuts" }),
  ];

  it("orders by number, name, connection and country, blanks last", () => {
    expect(ids(orderGuests(list, "number", "asc"))).toEqual(["a", "b", "c", "d"]);
    expect(ids(orderGuests(list, "number", "desc"))).toEqual(["d", "c", "b", "a"]);
    expect(ids(orderGuests(list, "name", "asc"))).toEqual(["b", "c", "d", "a"]);
    expect(ids(orderGuests(list, "connection", "asc"))).toEqual(["c", "d", "a", "b"]);
    expect(ids(orderGuests(list, "connection", "desc"))).toEqual(["a", "d", "c", "b"]);
    expect(ids(orderGuests(list, "country", "asc"))).toEqual(["c", "a", "b", "d"]);
  });

  it("orders 'invited to' and RSVP by the order the options are shown in", () => {
    // Both events, Ceremony only, Reception only, Reception if space allows, Unsure
    expect(ids(orderGuests(list, "invite", "asc"))).toEqual(["b", "d", "a", "c"]);
    // Waiting, Attending, Not attending
    expect(ids(orderGuests(list, "rsvp", "asc"))).toEqual(["c", "d", "a", "b"]);
  });

  it("puts invitations already sent first when ascending", () => {
    expect(ids(orderGuests(list, "sent", "asc"))).toEqual(["a", "c", "b", "d"]);
    expect(ids(orderGuests(list, "sent", "desc"))).toEqual(["b", "d", "a", "c"]);
  });

  it("breaks ties by guest number, whichever way it runs", () => {
    expect(ids(orderGuests(list, "plus", "desc"))).toEqual(["b", "a", "c", "d"]);
    expect(ids(orderGuests(list, "plus", "asc"))).toEqual(["d", "a", "c", "b"]);
  });

  it("orders food notes with blanks last", () => {
    expect(ids(orderGuests(list, "food", "asc"))).toEqual(["d", "a", "c", "b"]);
  });

  it("puts guests without a number last, then by name", () => {
    const legacy = [guest({ id: "x", number: null, name: "Zed" }), guest({ id: "y", number: null, name: "Abe" }), guest({ id: "z", number: 9, name: "Mo" })];
    expect(ids(orderGuests(legacy, "number", "asc"))).toEqual(["z", "y", "x"]);
    expect(ids(orderGuests(legacy, "number", "desc"))).toEqual(["z", "y", "x"]);
  });
});

const item = (over: Partial<OrderableItem> & { id: string }): OrderableItem & { id: string } => ({
  item: "Item",
  vendor: "",
  confirmed: false,
  types: [],
  persons: ["General"],
  next: false,
  sortOrder: 0,
  ...over,
});

describe("orderItems", () => {
  const list = [
    item({ id: "a", item: "Wedding cake", vendor: "Manis", confirmed: false, types: ["Reception"], persons: ["General"], next: true, sortOrder: 3 }),
    item({ id: "b", item: "Bride's gown", vendor: "Ayu", confirmed: true, types: ["Matrimony", "Reception"], persons: ["Bride"], sortOrder: 1 }),
    item({ id: "c", item: "Sangjit trays", vendor: "", types: ["Sangjit"], persons: ["General"], sortOrder: 2 }),
    item({ id: "d", item: "Rings", vendor: "Rumah", confirmed: true, types: [], persons: ["Groom Dad"], sortOrder: 4 }),
  ];

  it("keeps our own order by sortOrder, and gives it back", () => {
    expect(ids(ownOrder(list))).toEqual(["b", "c", "a", "d"]);
    expect(ids(orderItems(list, "own", "desc"))).toEqual(["b", "c", "a", "d"]);
  });

  it("never changes our own order", () => {
    orderItems(list, "name", "asc");
    expect(list.map((i) => i.sortOrder)).toEqual([3, 1, 2, 4]);
  });

  it("sorts by item and vendor, blanks last", () => {
    expect(ids(orderItems(list, "name", "asc"))).toEqual(["b", "d", "c", "a"]);
    expect(ids(orderItems(list, "vendor", "asc"))).toEqual(["b", "a", "d", "c"]);
    expect(ids(orderItems(list, "vendor", "desc"))).toEqual(["d", "a", "b", "c"]);
  });

  it("puts confirmed first and marked to work on next first, then our own order", () => {
    expect(ids(orderItems(list, "confirmed", "asc"))).toEqual(["b", "d", "c", "a"]);
    expect(ids(orderItems(list, "next", "asc"))).toEqual(["a", "b", "c", "d"]);
  });

  it("orders by the first event in the order events are shown, items with none last", () => {
    expect(ids(orderItems(list, "events", "asc"))).toEqual(["b", "a", "c", "d"]);
    expect(ids(orderItems(list, "events", "desc"))).toEqual(["c", "b", "a", "d"]);
  });

  it("orders by who it's for in the order people are shown", () => {
    expect(ids(orderItems(list, "person", "asc"))).toEqual(["c", "a", "b", "d"]);
  });

  it("copes with 2.000 items", () => {
    const many = Array.from({ length: 2000 }, (_, i) => item({ id: `i${i}`, item: `Item ${i + 1}`, sortOrder: 2000 - i }));
    const sorted = orderItems(many, "name", "asc");
    expect(sorted[0].id).toBe("i0");
    expect(sorted[1999].id).toBe("i1999");
    expect(orderItems(many, "own", "asc")[0].id).toBe("i1999");
  });
});

const vendor = (over = {}) => ({
  id: "v",
  name: "Vendor",
  category: "Food",
  contractStatus: "List",
  bridestoryRating: null as number | null,
  bridestoryReviewCount: null as number | null,
  createdAt: null as number | null,
  ...over,
});

describe("orderVendors", () => {
  const categories = buildCategories(["Sangjit gifts"]);
  const list = [
    vendor({ id: "a", name: "Dapur Lestari", category: "Food", contractStatus: "Chosen", bridestoryRating: 4.8, bridestoryReviewCount: 312, createdAt: 3 }),
    vendor({ id: "b", name: "Rasa Nusantara", category: "Food", contractStatus: "Rejected", bridestoryRating: 4.3, bridestoryReviewCount: 88, createdAt: 4 }),
    vendor({ id: "c", name: "Lumière Décor", category: "Decoration", contractStatus: "Chosen", bridestoryRating: 4.8, bridestoryReviewCount: 143, createdAt: 1 }),
    vendor({ id: "d", name: "Svara Band", category: "Other", contractStatus: "List", createdAt: 2 }),
    vendor({ id: "e", name: "Seserahan Cantik", category: "Sangjit gifts", contractStatus: "Consideration", bridestoryRating: 0, bridestoryReviewCount: 0, createdAt: 5 }),
  ];

  it("orders by category in the shared list's order, with Other last", () => {
    expect(ids(orderVendors(list, "category", "asc", categories))).toEqual(["c", "a", "b", "e", "d"]);
    expect(ids(orderVendors(list, "category", "desc", categories))).toEqual(["d", "e", "a", "b", "c"]);
  });

  it("puts a category that isn't in the list after the ones that are", () => {
    const withGone = [...list, vendor({ id: "f", name: "Ghost", category: "Gone" })];
    expect(ids(orderVendors(withGone, "category", "asc", categories)).slice(-1)).toEqual(["f"]);
  });

  it("orders by name", () => {
    expect(ids(orderVendors(list, "name", "asc", categories))).toEqual(["a", "c", "b", "e", "d"]);
  });

  it("orders by stage along the thread, with ruled out last", () => {
    expect(ids(orderVendors(list, "stage", "asc", categories))).toEqual(["d", "e", "a", "c", "b"]);
  });

  it("orders by rating, biggest first, with a rating of 0 or none counted as blank", () => {
    expect(ids(orderVendors(list, "rating", "desc", categories))).toEqual(["a", "c", "b", "e", "d"]);
    expect(ids(orderVendors(list, "rating", "asc", categories))).toEqual(["b", "a", "c", "e", "d"]);
  });

  it("orders by reviewers, with none last, and ties by name", () => {
    expect(ids(orderVendors(list, "reviewers", "desc", categories))).toEqual(["a", "c", "b", "e", "d"]);
  });

  it("orders by date added, newest first", () => {
    expect(ids(orderVendors(list, "added", "desc", categories))).toEqual(["e", "b", "a", "d", "c"]);
  });
});

describe("orderVenues", () => {
  const M = 1_000_000;
  const venue = (id: string, name: string, cost: number, guests: number) => ({ id, name, budgetEstimate: cost, guestMax: guests });
  const list = [venue("a", "Villa", 380 * M, 450), venue("b", "Puri", 340 * M, 500), venue("c", "Unknown", 0, 0), venue("d", "Hotel", 610 * M, 1200)];

  it("orders by cost and capacity, with unfilled ones last both ways", () => {
    expect(ids(orderVenues(list, "cost", "desc"))).toEqual(["d", "a", "b", "c"]);
    expect(ids(orderVenues(list, "cost", "asc"))).toEqual(["b", "a", "d", "c"]);
    expect(ids(orderVenues(list, "capacity", "desc"))).toEqual(["d", "b", "a", "c"]);
  });

  it("orders by name", () => {
    expect(ids(orderVenues(list, "name", "asc"))).toEqual(["d", "b", "c", "a"]);
  });

  it("sorts a 13-digit cost without losing digits", () => {
    const big = [venue("x", "Big", 9_876_543 * M, 125_000), venue("y", "Small", 9_876_542 * M, 10)];
    expect(ids(orderVenues(big, "cost", "desc"))).toEqual(["x", "y"]);
  });
});

describe("orderFinalists", () => {
  const categories = buildCategories([]);
  const finalist = (id: string, name: string, type: string, price: number, reviews: number | null, followers: number | null, extra = {}) => ({
    id,
    name,
    type,
    price,
    bridestoryReviewers: reviews,
    igFollowers: followers,
    ...extra,
  });
  const list = [
    finalist("a", "Sendok Emas", "Food", 150, 154, 12_400),
    finalist("b", "Lensa Kita", "Photos and Videos", 72, 201, 45_200),
    finalist("c", "Kebun Bunga", "Decoration", 120, 96, 18_800, {
      subEntries: [{ id: "k1", price: 85 }, { id: "k2", price: 120 }],
      preferredPackageId: "k1",
    }),
    finalist("d", "Arka Visual", "Photos and Videos", 0, null, null),
  ];

  it("takes the price of the package we're leaning towards", () => {
    expect(preferredPrice(list[2])).toBe(85);
    expect(preferredPrice(list[0])).toBe(150);
    expect(preferredPrice({ price: 10, subEntries: [], preferredPackageId: "gone" })).toBe(10);
    expect(preferredPrice(list[3])).toBeNull();
  });

  it("orders price low to high, with no price last", () => {
    expect(ids(orderFinalists(list, "price", "asc", categories))).toEqual(["b", "c", "a", "d"]);
    expect(ids(orderFinalists(list, "price", "desc", categories))).toEqual(["a", "c", "b", "d"]);
  });

  it("orders reviews and followers, with none last", () => {
    expect(ids(orderFinalists(list, "reviews", "desc", categories))).toEqual(["b", "a", "c", "d"]);
    expect(ids(orderFinalists(list, "followers", "desc", categories))).toEqual(["b", "c", "a", "d"]);
  });

  it("orders by category in the shared list's order", () => {
    expect(ids(orderFinalists(list, "category", "asc", categories))).toEqual(["c", "a", "d", "b"]);
  });
});
