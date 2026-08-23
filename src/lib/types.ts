export type VenueStatus = "Shortlist" | "Contacted" | "Toured" | "Booked" | "Rejected";

export interface Venue {
  id: string;
  name: string;
  budgetEstimate: number; // raw IDR number
  guestMax: number;
  location: string;
  status: VenueStatus;
  notes: string;
  images: string[];
  coverImage: string | null;
  files: VendorFile[];
  // Confirmed-list tracking fields (see Vendor for the vendor-side equivalents).
  confirmedType: ConfirmedType;
  budgetSpent: number;
  nextTargetDate: string | null; // ISO date string
  nextAction: string;
  subEntries: ConfirmedSubEntry[];
  createdAt: number | null;
  updatedAt: number | null;
}

export type VendorCategory =
  | "Bride Dress"
  | "Decoration"
  | "Food"
  | "Groom Suit"
  | "Invites"
  | "Makeup Artist"
  | "Music/DJ"
  | "Photos and Videos"
  | "Transportation"
  | "Wedding Cake"
  | "Wedding Organizer"
  | "Other";

// The Confirmed list's "Type" column spans both entity kinds, so it needs
// its own value space rather than reusing VendorCategory (which drives the
// Vendors page's own category tabs) or VenueStatus.
export type ConfirmedType = VendorCategory | "Venue";

export type ContractStatus = "Inquiring" | "Consideration" | "Chosen" | "Done" | "Rejected";

export interface VendorFile {
  name: string;
  url: string;
}

// A line item nested under a Confirmed-list entry (venue or vendor) — e.g.
// a DP vs. final payment split, or an add-on booked separately. Mirrors the
// parent's own tracking fields so it can be edited the same way, but rolls
// up into the parent's row rather than standing as its own entry.
export interface ConfirmedSubEntry {
  id: string;
  name: string;
  totalPrice: number;
  budgetSpent: number;
  nextTargetDate: string | null; // ISO date string
  nextAction: string;
  files: VendorFile[];
}

export interface VendorPriceOption {
  id: string;
  description: string;
  price: number;
  selected: boolean;
}

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contractStatus: ContractStatus;
  priceOptions: VendorPriceOption[];
  notes: string;
  starred: boolean;
  images: string[];
  files: VendorFile[];
  // Confirmed-list tracking fields, independent of priceOptions (which is
  // for comparing options pre-booking) — set once a vendor is locked in.
  confirmedType: ConfirmedType;
  totalPrice: number;
  budgetSpent: number;
  nextTargetDate: string | null; // ISO date string
  nextAction: string;
  subEntries: ConfirmedSubEntry[];
  createdAt: number | null;
  updatedAt: number | null;
}

export type RsvpStatus = "pending" | "yes" | "no";

export type EventType = "Both" | "Matrimony" | "Reception" | "Unsure (Abroad)" | "Reception Shortlist";

export interface Guest {
  id: string;
  name: string;
  connection: string;
  country: string;
  rsvpStatus: RsvpStatus;
  eventType: EventType;
  inviteSent: boolean;
  plusOnes: number;
  allergies: string;
  createdAt: number | null;
  updatedAt: number | null;
}

export type PaymentStatus = "unpaid" | "deposit" | "paid";

export interface BudgetItem {
  id: string;
  category: string;
  estimatedAmount: number;
  actualAmount: number;
  paymentStatus: PaymentStatus;
  notes: string;
  // Optional link back to the booked venue/vendor this line was generated
  // from, so confirmed bookings can graduate straight into the budget.
  linkedVenueId: string | null;
  linkedVendorId: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

export interface TodoSubtask {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null; // ISO date string
  done: boolean;
}

export interface TodoItem {
  id: string;
  title: string;
  notes: string;
  dueDate: string | null; // ISO date string
  done: boolean;
  subtasks: TodoSubtask[];
  createdAt: number | null;
  updatedAt: number | null;
}

export type ChecklistPhase =
  | "12 Months Out"
  | "6 Months Out"
  | "1 Month Out"
  | "Week Of";

export interface ChecklistItem {
  id: string;
  title: string;
  phase: ChecklistPhase;
  dueDate: string | null; // ISO date string
  done: boolean;
  createdAt: number | null;
  updatedAt: number | null;
}

// A standalone "what if I booked this" entry — same shape as a Confirmed
// row but not backed by a real Venue/Vendor, so it never affects the
// Confirmed page's totals.
export interface HypotheticalItem {
  id: string;
  name: string;
  type: ConfirmedType;
  totalPrice: number;
  budgetSpent: number;
  nextTargetDate: string | null; // ISO date string
  nextAction: string;
  files: VendorFile[];
  subEntries: ConfirmedSubEntry[];
  createdAt: number | null;
  updatedAt: number | null;
}

export interface Note {
  id: string;
  text: string;
  createdAt: number | null;
  updatedAt: number | null;
}

// One wedding's worth of data lives under a Workspace. All the collections
// above (venues, vendors, guests, ...) are subcollections of a workspace
// document, so two couples using the app never see each other's data.
export interface Workspace {
  id: string;
  name: string;
  ownerId: string; // uid of the member who created the workspace
  memberIds: string[]; // uids allowed to read/write this workspace's data
  memberEmails: string[]; // lowercased emails, mirrored for invite lookups
  inviteCode: string; // short code a second member enters to join
  createdAt: number | null;
  updatedAt: number | null;
}

// Maps a signed-in user to the workspace they belong to. One doc per uid,
// keyed by uid itself (users/{uid}), so membership resolution is a single
// point read instead of a query over all workspaces.
export interface UserProfile {
  uid: string;
  email: string;
  workspaceId: string | null;
  createdAt: number | null;
}
