# Prompt card

Each step below has the same four parts:

- **Goal**: what you are building in this step.
- **Prompt**: paste it into your coding agent (Claude Code, Cursor, Copilot, Codex, and so on).
- **Checkpoint**: what you should see when the step is done.
- **If it breaks**: the common failures and their fixes.

**Explain it back.** Every step ends with three questions. When the step works, have your agent answer them in the chat, quoting the lines it wrote (`AGENTS.md` tells it to), then read the answers and push back. Knowing why a line is there is the part an agent can't do for you.

Fell behind? Stop `npm run dev` (Ctrl+C), run `npm run catchup <n>`, then `npm run dev` again. Catchup replaces `app/` with the finished step and backs up your version first. It takes under a minute.

Using your own component instead of the provided one? See the section "Bring your own component" at the end.

> Why the prompts name exact imports: agents were trained mostly on the 2025 APIs (`@modelcontextprotocol/sdk` 1.x, `ext-apps` 0.x/1.x, `window.openai`). This repo pins **ext-apps 2.0.3 on the v2 SDK packages**. When the agent "fixes" an import back to `@modelcontextprotocol/sdk/...`, it is wrong. Paste the prompt again.

---

## Step 0 · Run it (from the door, first render in under 10 minutes)

```bash
npm run doctor      # no red ✗ lines; yellow warnings (cloudflared, git) are fine
npm run dev
```

**Checkpoint:** http://localhost:5173 shows the Sunset Shack picker inside a normal React page. When you click a time, the event appears in the "Events out" panel.

**If it breaks**
- `port … is busy`: something else is running. Stop it, or run `npm run dev -- --port 3011`. The port sticks: later `npm run dev`, `check` and `tunnel` reuse it (`--port 3001` switches back).
- `npm install` is crawling on the venue wifi: copy the repo folder from the facilitator's USB stick (it includes an npm cache), then run `npm ci --offline --cache ./.npm-cache` inside it. Windows (PowerShell): `robocopy E:\react-india-mcp-apps $HOME\react-india-mcp-apps /E` (your stick's drive letter), `cd $HOME\react-india-mcp-apps`, then the same `npm ci` line.

---

## Step 1 · Pull the contract out of React (16 min)

**Goal:** turn the component into a unit that any host can run through `mount / update / destroy` plus events. React becomes an implementation detail bundled inside it.

**Prompt**

```text
You are working in this repo. Read app/component/TableBooker.tsx and app/component/types.ts first. Do NOT modify the component.

Goal: give this React component a framework-free contract so any host can run it.

1. Create app/contract/widget.ts with these framework-free types (no React imports):
   - WidgetInstance<Props> { update(next: Partial<Props>): void; destroy(): void }
   - WidgetDefinition<Props, Events> { name: string; version: string; mount(el: HTMLElement, props: Props, events?: Partial<Events>): WidgetInstance<Props> }
2. Create app/contract/table-booker.widget.tsx exporting `tableBooker: WidgetDefinition<TableBookerData, TableBookerEvents>`:
   - TableBookerData = TableBookerProps without onSelect/onConfirm/onCancel; TableBookerEvents = those three, required.
   - mount() uses createRoot from react-dom/client. update() shallow-merges into the current props and re-renders. destroy() unmounts and is safe to call twice.
3. Prove there is no React app around it: add app/playground/vanilla.html + vanilla.ts. Plain DOM only. Mount the widget with data from app/data/sunset-shack.ts, log every event into an <aside class="log">, and add buttons for update({ partySize: 4 }), update({ loading: true }), destroy() and "mount again". Reuse ./shell.css.
4. Add app/playground/react-host.html + react-host.tsx: a React page that does NOT import TableBooker. It renders the widget only through the contract, using a small generic <Widget def props events /> adapter that mounts once, calls update() when props change, and never remounts because the events object changed identity.
5. Add app/playground/vue.html + vue-host.ts: a Vue 3 page (vue and @vitejs/plugin-vue are installed; use defineComponent + h(), no SFC) that hosts the same widget through the contract: mount in onMounted, update() from a deep watch, destroy in onBeforeUnmount, re-emit the events as Vue events.
6. Run `npm run typecheck` and fix every error.
```

**Checkpoint:** open http://localhost:5173/vanilla.html, then /react-host.html and /vue.html: the same widget in three hosts.
- Clicking a slot logs `select …`.
- Pressing `update({ partySize: 4 })` disables the slots that are now too small.
- Press `destroy()`, then press **Esc**: nothing is logged. That proves the component's keydown listener was cleaned up.

**If it breaks**
- *Esc still logs after destroy:* `destroy()` does not call `root.unmount()`. That is a listener leak, the bug that kills long-lived widget hosts.
- *React host remounts on every click* (the selection resets): the adapter's effect depends on `events` or `props`. Keep the events in a ref and mount only once.
- *"You are calling createRoot() on a container that has already been passed to createRoot()":* you mounted twice without destroying.

**Finished early?** Run the "Bring your own component" prompt at the end of this file on a component from your day job.

**Explain it back**
1. Why does `destroy()` call `root.unmount()`, and how does the Esc test prove it ran?
2. Why does the React host keep `events` in a ref and mount only once? What breaks if its effect depends on `events`?
3. Which `TableBooker` props are data and which are events? Which of them could not arrive from a server as JSON?

---

## Step 2 · Serve it to an agent (16 min)

**Goal:** add an MCP server with one tool, `find_table`, linked to a `ui://` resource. The resource is your view bundled into a single HTML file, and that view is one more host of the contract.

**Prompt**

```text
Turn this repo into an MCP App server. Use EXACTLY these packages (already installed, do not add others, do not use @modelcontextprotocol/sdk):
- @modelcontextprotocol/ext-apps 2.0.3: `import { App } from "@modelcontextprotocol/ext-apps"` (view), `import { registerAppTool, registerAppResource, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server"` (server)
- @modelcontextprotocol/server 2.x: `import { McpServer } from "@modelcontextprotocol/server"`
- @modelcontextprotocol/express + @modelcontextprotocol/node for HTTP: `import { createMcpExpressApp } from "@modelcontextprotocol/express"`, `import { toNodeHandler } from "@modelcontextprotocol/node"`, and `import { createMcpHandler } from "@modelcontextprotocol/server"`
- zod 4

1. app/server/main.ts: an Express app from createMcpExpressApp({ host: "0.0.0.0" }) with cors(). Serve app.all("/mcp") with `toNodeHandler(createMcpHandler(() => createServer()))`, called as `(req, res) => mcp(req, res, req.body)`. createMcpHandler builds a fresh McpServer per request and answers both protocol eras (2026-07-28 `server/discover`, and the 2025 `initialize` handshake). Listen on process.env.PORT ?? 3001 and log "listening".
2. app/server/server.ts exporting createServer():
   - const VIEW_URI = "ui://sunset-shack/table-booker.html"
   - registerAppTool(server, "find_table", { title, description, inputSchema: z.object({ partySize: z.number().int().min(1).max(12).default(2), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() }).strict(), annotations: { readOnlyHint: true }, _meta: { ui: { resourceUri: VIEW_URI } } }, handler)
   - The description tells the model WHEN to use it, and that the user picks the slot in the UI.
   - The handler returns { content: [{ type: "text", text: <one-line summary> }], structuredContent: { venue, slots, partySize, currency: "INR" } } using app/data/sunset-shack.ts.
   - registerAppResource(server, "Sunset Shack table picker", VIEW_URI, { mimeType: RESOURCE_MIME_TYPE }, async () => ({ contents: [{ uri: VIEW_URI, mimeType: RESOURCE_MIME_TYPE, text: <contents of app/.dist/index.html> }] }))
3. app/view/index.html + app/view/view.ts: mount tableBooker (from app/contract) into #root with { loading: true }. Create `new App({ name: "sunset-shack-view", version: "1.0.0" })`. Set app.ontoolresult BEFORE calling app.connect(); on a result, widget.update({ ...result.structuredContent, loading: false }).
The view is built into ONE file at app/.dist/index.html by vite.view.config.ts (already configured) and `npm run dev` already watches it. Run `npm run typecheck` and `npm run check`.
```

**Checkpoint:** restart `npm run dev`.
- `npm run check` prints all green.
- Open http://localhost:8080/?server=sunset-shack&tool=find_table&call=true. The picker renders inside the host's sandboxed iframe, and the "Tool Result" panel shows what the model would receive.

**If it breaks**
- *Blank card, no errors:* `app.connect()` was never called, or the handlers were attached after it. The handshake (`ui/initialize`) never happened.
- *"Connecting…" forever in the host:* is the MCP server running on 3001? Run `npm run check`.
- *Host shows the tool but no UI:* the `resourceUri` on the tool and the URI in `registerAppResource` differ by one character. Or the mimeType is not `RESOURCE_MIME_TYPE`.
- *Agent imported `@modelcontextprotocol/sdk/server/mcp.js`:* that is the v1 API. Paste the prompt again.
- *"Server is binding to 0.0.0.0 without DNS rebinding protection":* expected for a local workshop server. It binds to all interfaces so the tunnel in step 5 can reach it. In production you put auth in front.

**Explain it back**
1. What does `find_table` return in `content` and in `structuredContent`, and who reads each one?
2. Why must `app.ontoolresult` be set before `app.connect()`? What does the user see if it isn't?
3. What links the tool to the view? Point at the two lines that must match, and say why the view is one HTML file.

---

## Step 3 · Close the loop (14 min)

**Goal:** the user books from inside the view. The view calls an **app-only** tool on your server. Then the model can learn the truth, either from a best-effort hint or from a tool it can call itself.

**Prompt**

```text
Add the write path. Server (app/server/):
1. A tiny in-memory store (bookings.ts): create(reservation, idempotencyKey) returns the SAME booking for the same key; cancel(ref); active(); seatsTaken(slotId). find_table must subtract booked seats.
2. registerAppTool "book_table": inputSchema z.object({ slotId, partySize, name (2-60 chars), note (default ""), idempotencyKey (min 8) }).strict(); annotations { readOnlyHint: false, destructiveHint: false, idempotentHint: true }; _meta: { ui: { visibility: ["app"] } } so the MODEL never sees it, only the view can call it. Validate that the slot exists and has enough seats, else return { isError: true, content: [text explaining why] }. On success return a text summary plus structuredContent { reservation }.
3. registerAppTool "cancel_booking" ({ ref }), also visibility ["app"], destructiveHint: true.
4. server.registerTool "get_booking" (model-visible, readOnlyHint): returns the active bookings as text. Its description tells the model to call it before talking about a booking, because the user may have changed it in the picker.
View (app/view/view.ts), wire the contract's events to the bridge:
- onConfirm: widget.update({ status: "submitting" }); `await app.callServerTool({ name: "book_table", arguments: { ..., idempotencyKey: crypto.randomUUID() } })`; on isError show the error text; on success widget.update({ reservation, status: "idle" }) and then, best effort, `app.updateModelContext({ content: [{ type: "text", text: "The user booked …" }] })` (catch and ignore failures).
- onCancel: call cancel_booking the same way.
Run `npm run typecheck` and `npm run check`.
```

**Checkpoint:** in the local host, pick a slot, type a name and press **Book**.
- The card flips to "Table booked" with a reference.
- The host's **Model Context** panel shows your sentence.
- `npm run check` reports idempotency ✓ and strict schema ✓.
- The host's tool dropdown lists `find_table` and `get_booking`, but not `book_table`. App-only tools are hidden from the model.

**If it breaks**
- *Clicking Book does nothing in Claude/ChatGPT but worked in a plain preview:* plain previews have no bridge. Always test in a host (this one, the Inspector, or a real client).
- *Double booking on a double click:* there is no idempotency key, or it is generated per click on the server side. Generate it in the view, once per intent.
- *An extra argument "worked" but did nothing:* the schema is not `.strict()`. Zod strips unknown keys silently and returns 200.

**Explain it back**
1. Why is `book_table` app-only, and what does `visibility: ["app"]` *not* protect you from?
2. Where is the idempotency key created, and what would break if the server created it instead?
3. After the user books, how can the model find out? Compare `updateModelContext` with `get_booking`: which one can you rely on, and why?

---

## Step 4 · Survive real hosts (15 min)

**Goal:** apply the production rules: send the model a summary, let the view pull its own data, declare CSP, follow the host theme, and treat mount and call as separate events.

**Prompt**

```text
Harden the app for real hosts (Claude, ChatGPT). Server:
1. find_table returns ONLY a short summary: put the same summary in content (text) AND in structuredContent: { summary, query: { from, partySize } }. Hosts disagree on which of the two the model reads, so never put the slot grid or secrets in structuredContent.
2. New app-only tool "load_slots" ({ from?, partySize }).strict(), _meta.ui.visibility ["app"]: returns structuredContent { venue, slots, partySize, currency, reservation } where reservation is the latest active booking or null (comment that production must scope it to the authenticated user).
3. Serve app/server/assets/ at /assets with express.static and set venue.imageUrl = `${PUBLIC_URL}/assets/sunset-shack.svg`, where PUBLIC_URL = process.env.PUBLIC_URL ?? `http://localhost:${PORT}`.
4. Change VIEW_URI to "ui://sunset-shack/table-booker-v4.html" (hosts cache by URI). On the resource, set _meta = { ui: { csp: { resourceDomains: [PUBLIC_URL], connectDomains: [] }, prefersBorder: true }, "openai/widgetCSP": { resource_domains: [PUBLIC_URL], connect_domains: [] } }, both on the registerAppResource config and on the returned content item.
View (app/view/view.ts), import { App, applyDocumentTheme, applyHostStyleVariables, applyHostFonts } from "@modelcontextprotocol/ext-apps":
5. new App(info, {}, { autoResize: false }). Report height yourself: a ResizeObserver on #root that calls app.sendSizeChanged({ height: Math.ceil(rect.height) }) ONLY when the value changes.
6. ontoolinput: store the query as { partySize: args.partySize, from: args.date } (load_slots takes `from`, not `date`, and is strict), show loading, start a 25 s "no result" timer. ontoolresult: clear the timer; if structuredContent.query has keys, use it; then call load_slots via app.callServerTool and update the widget. ontoolcancelled: show "Cancelled." onhostcontextchanged and after connect(): applyDocumentTheme(ctx.theme), applyHostStyleVariables(ctx.styles.variables) and set a data-host-styles attribute on <html>, applyHostFonts(ctx.styles.css.fonts). onteardown: widget.destroy(). After a successful book_table or cancel_booking, call load_slots again: every result is a snapshot, so the grid is stale the moment you write.
7. app/view/host-theme.css (import it in view.ts): under :root[data-host-styles] .tb, map --tb-bg/--tb-fg/--tb-muted/--tb-border/--tb-surface/--tb-font to --color-background-primary, --color-text-primary, --color-text-secondary, --color-border-primary, --color-background-secondary, --font-sans. Do not touch the component.
Run `npm run typecheck` and `npm run check`.
```

**Checkpoint**
- `npm run check` shows that the model now gets about 400 bytes (it was about 8.5 KB), and that the CSP is listed under both keys.
- In the host, the logo appears. Toggle the host's 🌙 and the picker follows the theme.
- **Try breaking it:** set `resourceDomains: []` and reload. The logo disappears, and DevTools shows `violates the following Content Security Policy directive: "img-src 'self' data: blob:"`. That is exactly what your users would see in Claude.

**If it breaks**
- *Logo blocked even with the CSP set:* the host cached the old resource. Bump the `ui://` URI (in real hosts: reconnect the connector or start a new chat).
- *Widget grows taller and taller:* you send the height on every ResizeObserver tick, or `html, body` have `height: 100%`.
- *Stuck on the skeleton:* `load_slots` is missing from the server, or it is model-only. The view can call only tools whose visibility includes `"app"`.

**Explain it back**
1. Why does `find_table` now return only a summary, and how does the view get the slots?
2. Why does the view start its "no result" timer in `ontoolinput` instead of when it mounts?
3. What does the CSP declaration allow, why is it declared under two keys, and what happens in a host when it's missing?

---

## Step 5 · Put it in a real chat (9 min)

**Goal:** expose your server over HTTPS and connect it to Claude or ChatGPT.

```bash
# terminal 1: stop dev first (Ctrl+C), then
npm run catchup 5
npm run dev          # keeps the port you used before (e.g. 3011)
# terminal 2 (skip if your tunnel from 2:55 is still running: it follows the same port)
npm run get-cloudflared   # once, Windows/Linux without cloudflared (no admin rights)
npm run tunnel       # → prints https://<random>.trycloudflare.com/mcp
npm run check -- https://<random>.trycloudflare.com/mcp
```

Why `catchup 5`: step 5's server derives its public URL from each request, so the CSP automatically matches the tunnel. On your own step-4 code the CSP says localhost, and Claude blocks the logo.

- **Claude** (web or desktop; the Free plan allows one custom connector): Settings → Connectors → **Add custom connector** → name it **Sunset Shack** → paste the URL → no auth. If Claude asks to allow a tool the first time, allow it. In a **new chat**, ask: *"Use Sunset Shack to find me a table for 4 this Friday evening."*
- **ChatGPT** (custom MCP servers need developer mode; availability depends on your plan and workspace): chatgpt.com/plugins → **+** → **Add custom MCP server** → name it **Sunset Shack**, paste the URL, auth "None" → *Create as a plugin* (confirm any "I trust this server" prompt), then mention it with `@` in a chat. After any server change, press **Refresh** on the plugin.
- **No account?** Stay on the local host: it counts for checkpoint 2. (The MCP Inspector's Apps tab, `npx @modelcontextprotocol/inspector`, Node 22.19+, is another host, but we haven't got it running ourselves; try it at home.)

**Checkpoint:** the picker renders in the chat. After you book, ask *"what did I book?"*. The model should call `get_booking` and answer with your reference.

**If it breaks**
- *Claude says it can't find a tool, or answers by itself:* name the connector in the prompt ("use Sunset Shack"). Also start a new chat after you add or change tools, because hosts cache tool lists.
- *UI didn't change after you edited code:* hosts cache the resource. Bump the `ui://` URI and reconnect.
- *"Use caution" banner when the view sends a message:* that is Claude staging `ui/message` for the user to confirm. It is expected; it is why we used a tool plus model context instead.
- *Tunnel URL changed:* quick tunnels get a new URL every restart. Edit the connector URL.

**Explain it back**
1. Why does step 5's server build its public URL from each request instead of using a constant?
2. Why can't Claude or ChatGPT connect to `localhost:3001` directly?
3. After you book, ask "what did I book?". Which tool did the model call, and why didn't it already know?

---

## Bring your own component

Copy your component (and its types) into `app/component/`, put realistic sample data in `app/data/`, then use these prompts in place of the Step 1 to Step 4 prompts:

```text
Read app/component/<YourComponent>.tsx. Do not modify it. Create a framework-free contract for it exactly like app/contract/widget.ts describes (mount/update/destroy + events), implement it in app/contract/<your-component>.widget.tsx with react-dom/client, and add app/playground/vanilla.html that mounts it with data from app/data/ and logs every event. Split its props into DATA (serializable, can come from a server) and EVENTS (callbacks). List any props that are not serializable (functions other than events, refs, React nodes, class instances): those must be redesigned before it can run in a chat.
```

Then reuse the step 2 to 4 prompts, replacing `find_table` / `book_table` / `load_slots` with your own tool names. Design them first:
- one model-visible tool that opens the UI;
- one app-only read that the view uses to pull its data;
- one app-only write for each user action;
- one model-visible read so the model can learn what the user did.
