export type VenueStatus = "Considering" | "Toured" | "Booked" | "Rejected";

export interface Venue {
  id: string;
  name: string;
  budgetEstimate: number; // raw IDR number
  guestMax: number;
  status: VenueStatus;
  notes: string;
  images: string[];
  coverImage: string | null;
  createdAt: number | null;
  updatedAt: number | null;
}

export type VendorCategory =
  | "Caterer"
  | "Florist"
  | "Photographer"
  | "Videographer"
  | "Music/DJ"
  | "Makeup Artist"
  | "Decoration"
  | "Wedding Organizer"
  | "Other";

export type ContractStatus = "Not Contacted" | "In Talks" | "Contracted" | "Paid";

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  contactName: string;
  contactPhone: string;
  contactEmail: string;
  contractStatus: ContractStatus;
  notes: string;
  images: string[];
  createdAt: number | null;
  updatedAt: number | null;
}

export type RsvpStatus = "pending" | "yes" | "no";

export interface Guest {
  id: string;
  name: string;
  connection: string;
  country: string;
  rsvpStatus: RsvpStatus;
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
