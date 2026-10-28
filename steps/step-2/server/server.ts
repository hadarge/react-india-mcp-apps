// Step 2: one tool, one UI resource, tied together by a ui:// URI.
import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";
import { McpServer } from "@modelcontextprotocol/server";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { VENUE, availability, isoDate } from "../data/sunset-shack.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const VIEW_HTML = path.join(HERE, "..", ".dist", "index.html");
const VIEW_URI = "ui://sunset-shack/table-booker.html";

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
        "The user chooses the time and seating in the picker; do not pick a slot for them.",
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
      const slots = availability(from);
      const open = slots.filter((s) => s.seatsLeft >= partySize);
      return {
        content: [{ type: "text", text: `Showing ${open.length} open slots at ${VENUE.name} for ${partySize} from ${from}. The user will pick in the UI.` }],
        structuredContent: { venue: VENUE, slots, partySize, currency: "INR" },
      };
    },
  );

  registerAppResource(server, "Sunset Shack table picker", VIEW_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({
    contents: [{ uri: VIEW_URI, mimeType: RESOURCE_MIME_TYPE, text: await fs.readFile(VIEW_HTML, "utf8") }],
  }));

  return server;
};
