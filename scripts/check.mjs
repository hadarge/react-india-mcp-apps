#!/usr/bin/env node
// Headless checkpoint: talks to your MCP server exactly like a host would.
//   npm run check                      -> http://localhost:3001/mcp
//   npm run check -- https://x.trycloudflare.com/mcp
// It never needs an AI account. Exit code 0 = every check passed.
import { Client, StreamableHTTPClientTransport } from "@modelcontextprotocol/client";
import { existsSync, readFileSync } from "node:fs";

// Default port follows `npm run dev -- --port N` (dev writes .dev-port).
const devPort = new URL("../.dev-port", import.meta.url);
const port = process.env.PORT ?? (existsSync(devPort) ? readFileSync(devPort, "utf8").trim() : "3001");
const url = new URL(process.argv[2] ?? `http://localhost:${port}/mcp`);
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const info = (m) => console.log(`    ${m}`);
let failed = 0;
const bad = (m, fix) => {
  failed++;
  console.log(`  \x1b[31m✗\x1b[0m ${m}${fix ? `\n    fix: ${fix}` : ""}`);
};

console.log(`\nChecking ${url.href}\n`);
const client = new Client({ name: "workshop-check", version: "1.0.0" }, {
  capabilities: { extensions: { "io.modelcontextprotocol/ui": { mimeTypes: ["text/html;profile=mcp-app"] } } },
});
try {
  await client.connect(new StreamableHTTPClientTransport(url));
  ok("connected");
} catch (e) {
  bad(`cannot connect: ${e.message}`, "is `npm run dev` running? Does the URL end in /mcp?");
  process.exit(1);
}

const { tools } = await client.listTools();
ok(`tools/list → ${tools.map((t) => t.name).join(", ")}`);
const modelVisible = (t) => !t._meta?.ui?.visibility || t._meta.ui.visibility.includes("model");
const uiTools = tools.filter((t) => t._meta?.ui?.resourceUri && modelVisible(t));
if (!uiTools.length) bad("no tool declares _meta.ui.resourceUri", "registerAppTool(..., { _meta: { ui: { resourceUri } } })");

for (const t of tools) {
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(t.name)) bad(`tool name "${t.name}" will be rejected by clients`, "use [a-zA-Z0-9_-], under 30 chars");
  if ((t.description ?? "").length < 40) bad(`tool "${t.name}" has a thin description; the description is your only guaranteed prompt`);
  const vis = t._meta?.ui?.visibility;
  if (vis) info(`${t.name}: visibility ${JSON.stringify(vis)}`);
}

for (const t of uiTools) {
  const uri = t._meta.ui.resourceUri;
  try {
    const res = await client.readResource({ uri });
    const c = res.contents[0];
    if (c.mimeType !== "text/html;profile=mcp-app") bad(`${uri} mimeType is ${c.mimeType}`, "use RESOURCE_MIME_TYPE");
    const html = c.text ?? "";
    if (!/<script/i.test(html)) bad(`${uri} has no <script>; is the view built?`, "wait for [view] build, or run the dev script again");
    else ok(`resources/read ${uri} → ${(html.length / 1024).toFixed(0)} KB, ${c.mimeType}`);
    if (/<script[^>]+src=["'](?!data:)/i.test(html)) bad(`${uri} loads external scripts; hosts will block them`, "bundle into one file (vite-plugin-singlefile)");
    const csp = c._meta?.ui?.csp;
    if (csp) info(`csp: ${JSON.stringify(csp)}`);
    if (c._meta?.["openai/widgetCSP"]) info(`openai/widgetCSP: ${JSON.stringify(c._meta["openai/widgetCSP"])}`);
  } catch (e) {
    bad(`resources/read ${uri} failed: ${e.message}`, "the resource URI on the tool and on registerAppResource must match exactly");
  }

  const r = await client.callTool({ name: t.name, arguments: {} });
  if (r.isError) bad(`${t.name} returned isError: ${JSON.stringify(r.content)}`);
  else {
    const text = r.content?.find((x) => x.type === "text")?.text ?? "";
    ok(`tools/call ${t.name} → content ${text.length} chars, structuredContent keys [${Object.keys(r.structuredContent ?? {}).join(", ")}]`);
    const scSize = JSON.stringify(r.structuredContent ?? {}).length;
    info(`model may see: content (${text.length} B) + structuredContent (${scSize} B, host-dependent)`);
    if (scSize > 8000) info(`hint: ${scSize} B of structuredContent can land in the model's context on some hosts (step 4 fixes this)`);
  }
}

// Step 3+: the app-only write path.
const book = tools.find((t) => t.name === "book_table");
if (book) {
  const avail = tools.find((t) => t.name === "load_slots")
    ? await client.callTool({ name: "load_slots", arguments: { partySize: 2 } })
    : await client.callTool({ name: "find_table", arguments: { partySize: 2 } });
  const slot = avail.structuredContent?.slots?.find((s) => s.seatsLeft >= 2);
  if (!slot) bad("could not find an open slot to test booking");
  else {
    const key = `check-${Date.now()}`;
    const args = { slotId: slot.id, partySize: 2, name: "Workshop Check", note: "", idempotencyKey: key };
    const b1 = await client.callTool({ name: "book_table", arguments: args });
    const b2 = await client.callTool({ name: "book_table", arguments: args });
    const ref1 = b1.structuredContent?.reservation?.ref;
    if (b1.isError || !ref1) bad(`book_table failed: ${JSON.stringify(b1.content)}`);
    else ok(`book_table → ${ref1}`);
    if (ref1 && b2.structuredContent?.reservation?.ref === ref1) ok("book_table is idempotent (same key → same booking)");
    else if (ref1) bad("book_table is not idempotent", "dedupe on idempotencyKey");
    const extra = await client.callTool({ name: "book_table", arguments: { ...args, idempotencyKey: key + "x", sneaky: true } }).catch((e) => ({ isError: true, content: [{ text: e.message }] }));
    if (extra.isError) ok("unknown arguments are rejected (strict schema)");
    else bad("unknown arguments are silently stripped", "z.object({...}).strict()");
    const get = tools.find((t) => t.name === "get_booking");
    if (get) {
      const g = await client.callTool({ name: "get_booking", arguments: {} });
      const t = g.content?.find((x) => x.type === "text")?.text ?? "";
      if (t.includes(ref1)) ok("get_booking lets the model read the truth the user created in the view");
      else bad("get_booking does not report the new booking");
    }
    if (ref1) await client.callTool({ name: "cancel_booking", arguments: { ref: ref1 } }).catch(() => {});
  }
}

await client.close();
console.log(failed ? `\n${failed} problem(s).\n` : "\nAll checks passed.\n");
process.exit(failed ? 1 : 0);
