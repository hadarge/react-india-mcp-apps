// Step 5: the step-4 server, with the public URL passed in per request (see main.ts).
// Step 4 recap: host-proof.
//  - The model gets a SUMMARY (in content AND structuredContent: hosts disagree on which one the model reads).
//  - The view PULLS the heavy grid through an app-only tool (load_slots). That also survives
//    hosts that replay an emptied result on reload, and keeps 8 KB of slots out of the model's context.
//  - The resource declares its CSP twice: the standard key and ChatGPT's legacy key.
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
const VIEW_URI = "ui://sunset-shack/table-booker-v5.html"; // bumped from v4: a chat that cached step 4's view (CSP = localhost) must not reuse it


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

export const createServer = ({ publicUrl }: { publicUrl: string }) => {
  // The public origin of THIS server: localhost locally, the tunnel URL behind a tunnel.
  const PUBLIC_URL = publicUrl.replace(/\/$/, "");
  const venue = () => ({ ...VENUE, imageUrl: `${PUBLIC_URL}/assets/sunset-shack.svg` });
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
      const evening = open.filter((s) => s.time >= "18:00").length;
      const summary =
        `Showing the Sunset Shack picker for ${partySize} from ${from}: ${open.length} open slots (${evening} in the evening). ` +
        `The user picks and books in the picker; call get_booking to see what they booked.`;
      return {
        content: text(summary),
        // Small and model-safe on purpose: some hosts put structuredContent in the model's context.
        structuredContent: { summary, query: { from, partySize } },
      };
    },
  );

  // App-only read: the view pulls the full grid. The model never sees this payload.
  registerAppTool(
    server,
    "load_slots",
    {
      title: "Load Sunset Shack availability",
      description: "Returns the full availability grid for the Sunset Shack picker. Called by the picker UI, not by the model.",
      inputSchema: z
        .object({
          from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
          partySize: z.number().int().min(1).max(12).default(2),
        })
        .strict(),
      annotations: { readOnlyHint: true },
      _meta: { ui: { visibility: ["app"] } },
    },
    async ({ from, partySize }) => {
      const start = from ?? isoDate(new Date());
      // Workshop shortcut: one shared in-memory store. In production, scope this to the
      // authenticated user from the bearer token, never from an argument.
      const reservation = bookings.active().at(-1) ?? null;
      return {
        content: text(`Availability from ${start}.`),
        structuredContent: { venue: venue(), slots: slotsFrom(start), partySize, currency: "INR", reservation },
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

  // CSP: declare every origin the view loads from. Hosts block everything else.
  // Send it twice: `ui.csp` (the standard) and `openai/widgetCSP` (ChatGPT's legacy key, still read).
  const csp = { resourceDomains: [PUBLIC_URL], connectDomains: [] as string[] };
  const resourceMeta = {
    ui: { csp, prefersBorder: true },
    "openai/widgetCSP": { resource_domains: csp.resourceDomains, connect_domains: csp.connectDomains },
  };

  registerAppResource(server, "Sunset Shack table picker", VIEW_URI, { mimeType: RESOURCE_MIME_TYPE, _meta: resourceMeta }, async () => ({
    contents: [{ uri: VIEW_URI, mimeType: RESOURCE_MIME_TYPE, text: await fs.readFile(VIEW_HTML, "utf8"), _meta: resourceMeta }],
  }));

  return server;
};
