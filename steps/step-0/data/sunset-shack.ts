// Deterministic mock availability for a fictional beach shack in South Goa.
// Same input, same output: every laptop in the room sees the same grid.
import type { Slot, Venue, Zone } from "../component/types";

export const VENUE: Venue = {
  id: "sunset-shack",
  name: "Sunset Shack",
  area: "Utorda Beach, South Goa",
  cuisine: "Goan seafood · Grill",
};

const TIMES = ["12:30", "13:30", "18:30", "19:30", "20:30"];
const ZONES: Zone[] = ["beach", "deck", "indoor"];
const CAPACITY: Record<Zone, number> = { beach: 10, deck: 8, indoor: 16 };

const hash = (s: string) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
};

export const isoDate = (d: Date) => {
  return d.toISOString().slice(0, 10);
};

/** Availability for `days` days starting at `from` (YYYY-MM-DD). */
export const availability = (from: string, days = 5): Slot[] => {
  const start = new Date(`${from}T00:00:00Z`);
  const slots: Slot[] = [];
  for (let i = 0; i < days; i++) {
    const date = isoDate(new Date(start.getTime() + i * 86400000));
    for (const time of TIMES) {
      for (const zone of ZONES) {
        const r = hash(`${date}|${time}|${zone}`);
        const evening = time >= "18:00";
        const seatsLeft = Math.floor(r * (CAPACITY[zone] + 1) * (evening && zone !== "indoor" ? 0.6 : 1));
        const minSpend = evening && zone === "beach" ? 150000 : evening && zone === "deck" ? 100000 : 0;
        slots.push({ id: `${date}T${time}-${zone}`, date, time, zone, seatsLeft, minSpend });
      }
    }
  }
  return slots;
};
