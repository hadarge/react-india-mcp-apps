# Take-home: going further

These are the things that did not fit in two hours. Each one has a prompt you can give your coding agent. Start from `npm run catchup 5` (or your own `app/`).

## 1. Your own component

Use the "Bring your own component" prompt in `PROMPTS.md`, then do steps 2 to 4 again with your own tool names. Before any code, design the four tools:

- one model-visible tool that opens the UI
- one app-only read the view uses to pull its data
- one app-only write per user action
- one model-visible read so the model can learn what the user did

## 2. One more host: a custom element

A custom element is one valid packaging of the same contract. It is handy for CMSs and for teams that can't add a framework.

```text
Add app/contract/table-booker.element.ts that defines <table-booker> as a custom element wrapping tableBooker: mount in connectedCallback, destroy in disconnectedCallback, a `data` property (not attributes) that calls update(), and CustomEvents "select", "confirm", "cancel" with the payload in detail. Add app/playground/element.html that uses it with plain DOM.
```

## 3. Smaller bundle: Preact behind the same contract

```text
Create app/contract/table-booker.preact.tsx implementing the same WidgetDefinition with preact + preact/compat (install them), and build the view with it via a vite alias react -> preact/compat. Compare the size of app/.dist/index.html before and after. Do not change TableBooker.tsx or any host.
```

## 4. Per-user data: OAuth

Real apps need the user's identity on the server. Never trust identity passed as a tool argument.

```text
Add OAuth 2.1 protection to the MCP server using the auth helpers in @modelcontextprotocol/server 2.x (protected resource metadata + bearer token verification). Read the user id from the verified token in the tool handler context (extra.http?.authInfo), and scope bookings by it in bookings.ts. Unauthenticated requests to /mcp must get 401 with a WWW-Authenticate header, never an HTML redirect.
```

Lesson from production: turning auth **on** later fixes itself, because clients get a 401 and start the flow. Turning it **off** strands every client that ever connected. Decide early.

## 5. Deploy off the tunnel

Quick tunnels die when your laptop sleeps, and their URL changes on every restart.

```text
Prepare this server for deployment to <Render / Fly.io / Cloud Run / a VPS>: a production start script (build the view, run server/main.ts with tsx or compile it), PORT from the environment, PUBLIC_URL from the environment, a /healthz route, and a Dockerfile. Keep the server stateless (new McpServer per request); move bookings to <SQLite / Postgres / Redis>.
```

Then, for Claude, set `_meta.ui.domain` on the resource so the view gets a stable origin. It must be `<first 32 hex chars of sha256(exact connector URL)>.claudemcpcontent.com`. A trailing slash changes the hash.

## 6. Version the UI properly

```text
Make VIEW_URI content-addressed: compute a short sha256 of app/.dist/index.html at startup and use ui://sunset-shack/table-booker-<hash>.html. Keep a list of previous URIs that still resolve to the current HTML, so conversations rendered with an old pointer keep working.
```

## 7. Display modes

```text
In view.ts, read app.getHostContext()?.availableDisplayModes. If it includes "fullscreen", show an "Expand" button that calls app.requestDisplayMode({ mode: "fullscreen" }) and toggles back to "inline". Re-layout on onhostcontextchanged when displayMode changes. Declare availableDisplayModes in the App capabilities.
```

## 8. ChatGPT reloads (widgetState)

On reload ChatGPT can hand your view an emptied result. To recover the right booking, remember which one this widget was showing:

```text
When the view knows its query (after ontoolresult), and window.openai?.setWidgetState is a function, store { query } with it. On boot, if structuredContent has no keys, read window.openai.widgetState?.query and use it for load_slots. Guard every window.openai access; it does not exist in Claude.
```

## 9. App-registered tools

The draft spec lets the view register tools the host can call (`app.registerTool`). This makes the view introspectable: "what is selected right now?"

```text
In view.ts, register an app tool "get_selection" with app.registerTool that returns the currently selected slot and party size from the widget, and declare it in the App capabilities. Test it from the basic-host if supported; note in a comment that host support is still rolling out.
```

## 10. If your view polls

A widget nobody is looking at keeps running. In production we saw about 1,300 background calls for every human one.

- Poll only while `document.visibilityState === "visible"`.
- Back off, and keep one request in flight.
- Skip the repaint when nothing changed.

## 11. Test on a phone

Claude iOS has its own CSP and blocks camera, microphone and geolocation. Add your connector on web or desktop first, then open the same chat on your phone.
