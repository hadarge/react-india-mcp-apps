// The source of truth. The view and the model each get a snapshot of it;
// only the server sees both. (In-memory for the workshop; a DB in real life.)
import type { Reservation } from "../component/types.js";

const bookings = new Map<string, Reservation>(); // ref -> reservation
const byKey = new Map<string, string>(); // idempotencyKey -> ref

export const findByKey = (key: string) => {
  const ref = byKey.get(key);
  return ref ? bookings.get(ref) : undefined;
};

export const create = (r: Omit<Reservation, "ref" | "status">, key: string): Reservation => {
  const ref = "SS-" + Math.random().toString(36).slice(2, 7).toUpperCase();
  const res: Reservation = { ...r, ref, status: "confirmed" };
  bookings.set(ref, res);
  byKey.set(key, ref);
  return res;
};

export const cancel = (ref: string) => {
  const r = bookings.get(ref);
  if (r) r.status = "cancelled";
  return r;
};

export const active = () => {
  return [...bookings.values()].filter((b) => b.status === "confirmed");
};

export const seatsTaken = (slotId: string) => {
  return active().filter((b) => b.slotId === slotId).reduce((n, b) => n + b.partySize, 0);
};
