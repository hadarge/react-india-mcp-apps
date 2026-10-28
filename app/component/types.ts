// The data shape of the component. Notice: nothing here is React-specific.
// This file is the seed of the contract you will pull out in step 1.

export type Zone = "beach" | "deck" | "indoor";

export interface Venue {
  id: string;
  name: string;
  area: string;
  cuisine: string;
  /** Optional logo/photo URL. Step 4 uses this to meet CSP. */
  imageUrl?: string;
}

export interface Slot {
  id: string;
  /** YYYY-MM-DD, venue local time */
  date: string;
  /** HH:MM, venue local time */
  time: string;
  zone: Zone;
  seatsLeft: number;
  /** Minimum spend per person, in minor units of `currency` (paise for INR). 0 = none. */
  minSpend: number;
}

export interface Reservation {
  ref: string;
  slotId: string;
  partySize: number;
  name: string;
  note?: string;
  status: "confirmed" | "cancelled";
}

export interface BookingRequest {
  slot: Slot;
  partySize: number;
  name: string;
  note: string;
}

export interface TableBookerProps {
  venue: Venue;
  slots: Slot[];
  currency?: string;
  /** Initial party size (the user can change it in the UI). */
  partySize?: number;
  /** When set, the component shows the confirmation state for this reservation. */
  reservation?: Reservation | null;
  /** Async state owned by whoever handles onConfirm. */
  status?: "idle" | "submitting" | "error";
  error?: string | null;
  /** True while data has not arrived yet (renders a skeleton). */
  loading?: boolean;

  onSelect?: (selection: { slot: Slot | null; partySize: number }) => void;
  onConfirm?: (request: BookingRequest) => void;
  onCancel?: (reservation: Reservation) => void;
}
