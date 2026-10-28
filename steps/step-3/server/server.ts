// Step 3: the round trip. The model opens the picker (find_table); the USER
// books from inside the view through an app-only tool (book_table); the model
// can read the truth back through get_booking.
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/server";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { VENUE, availability, isoDate } from "../data/sunset-shack.js";
import * as bookings from "./bookings.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIEW_HTML = path.join(HERE, "..", ".dist", "index.html");
const VIEW_URI = "ui://sunset-shack/table-booker.html";

const text = (t: string) => [{ type: "text" as const, text: t }];

/** Live availability = mock grid minus what has been booked here. */
const slotsFrom = (from: string) => {
  return availability(from).map((s) => ({ ...s, seatsLeft: Math.max(0, s.seatsLeft - bookings.seatsTaken(s.id)) }));
};

const describe = (r: { ref: string; slotId: string; partySize: number; name: string }) => {
  const [date, rest] = r.slotId.split("T");
  const [time, zone] = rest.split("-");
  return `${r.ref}: ${r.name}, ${r.partySize} guests, ${date} at ${time}, ${zone} table`;
};

export const createServer = () => {
  const server = new McpServer({ name: "sunset-shack", version: "1.0.0" });

  registerAppTool(
    server,
    "find_table",
    {
      title: "Find a table at Sunset Shack",
      description:
        "Shows an interactive table picker for Sunset Shack, a beach restaurant at Utorda Beach, South Goa. " +
        "Use it whenever the user wants to book, check or compare tables there. " +
        "The user chooses the time and seating in the picker and books it there; do not pick a slot for them. " +
        "To learn what the user booked, call get_booking.",
      inputSchema: z
        .object({
          partySize: z.number().int().min(1).max(12).default(2).describe("Number of guests"),
          date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("First day to show, YYYY-MM-DD. Defaults to today."),
        })
        .strict(),
      annotations: { readOnlyHint: true },
      _meta: { ui: { resourceUri: VIEW_URI } },
    },
    async ({ partySize, date }) => {
      const from = date ?? isoDate(new Date());
      const slots = slotsFrom(from);
      const open = slots.filter((s) => s.seatsLeft >= partySize);
      return {
        content: text(`Showing ${open.length} open slots at ${VENUE.name} for ${partySize} from ${from}. The user will pick and book in the UI.`),
        structuredContent: { venue: VENUE, slots, partySize, currency: "INR" },
      };
    },
  );

  // App-only: the model never sees this tool in its list. The USER triggers it
  // from the view. Still, treat it as a public endpoint (visibility is a hint
  // to the host, not access control).
  registerAppTool(
    server,
    "book_table",
    {
      title: "Book a table",
      description: "Books the slot the user picked in the Sunset Shack picker. Called by the picker UI, not by the model.",
      inputSchema: z
        .object({
          slotId: z.string().min(1),
          partySize: z.number().int().min(1).max(12),
          name: z.string().trim().min(2).max(60),
          note: z.string().max(200).default(""),
          idempotencyKey: z.string().min(8).describe("Same key, same booking. Makes double clicks and retries safe."),
        })
        .strict(),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ slotId, partySize, name, note, idempotencyKey }) => {
      const existing = bookings.findByKey(idempotencyKey);
      if (existing) return { content: text(`Booked ${describe(existing)}`), structuredContent: { reservation: existing } };

      const date = slotId.slice(0, 10);
      const slot = slotsFrom(date).find((s) => s.id === slotId);
      if (!slot) return { isError: true, content: text(`Unknown slot ${slotId}.`) };
      if (slot.seatsLeft < partySize) return { isError: true, content: text(`Only ${slot.seatsLeft} seats left at ${slot.time}. Pick another time.`) };

      const reservation = bookings.create({ slotId, partySize, name, note }, idempotencyKey);
      return { content: text(`Booked ${describe(reservation)}`), structuredContent: { reservation } };
    },
  );

  registerAppTool(
    server,
    "cancel_booking",
    {
      title: "Cancel a booking",
      description: "Cancels a Sunset Shack booking by its reference. Called by the picker UI.",
      inputSchema: z.object({ ref: z.string().min(3) }).strict(),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ ref }) => {
      const r = bookings.cancel(ref);
      if (!r) return { isError: true, content: text(`No booking ${ref}.`) };
      return { content: text(`Cancelled ${ref}.`), structuredContent: { reservation: r } };
    },
  );

  // Model-visible read: the reliable way for the model to learn what the user did in the view.
  server.registerTool(
    "get_booking",
    {
      title: "Get Sunset Shack bookings",
      description:
        "Returns the user's current Sunset Shack bookings. Call this before talking about a booking, " +
        "because the user may have booked, changed or cancelled it in the picker since you last looked.",
      inputSchema: z.object({}).strict(),
      annotations: { readOnlyHint: true },
    },
    async () => {
      const list = bookings.active();
      return {
        content: text(list.length ? list.map(describe).join("\n") : "No active bookings."),
        structuredContent: { bookings: list },
      };
    },
  );

  registerAppResource(server, "Sunset Shack table picker", VIEW_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{ uri: VIEW_URI, mimeType: RESOURCE_MIME_TYPE, text: await fs.readFile(VIEW_HTML, "utf8") }],
  }));

  return server;
};
