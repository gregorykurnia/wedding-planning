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
  // Confirmed-list tracking fields (see Vendor for the vendor-side equivalents).
  budgetSpent: number;
  nextTargetDate: string | null; // ISO date string
  nextAction: string;
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

export type ContractStatus = "Inquiring" | "Consideration" | "Chosen" | "Done" | "Rejected";

export interface VendorFile {
  name: string;
  url: string;
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
  totalPrice: number;
  budgetSpent: number;
  nextTargetDate: string | null; // ISO date string
  nextAction: string;
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

export interface Note {
  id: string;
  text: string;
  createdAt: number | null;
  updatedAt: number | null;
}
