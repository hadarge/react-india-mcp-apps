# Local MCP Apps host

This folder is a vendored copy of `examples/basic-host` from
[modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps)
(commit `82221c0`, 2026-09-25, ext-apps 2.0.3), MIT licensed.

Changes for the workshop:
- `serve.ts` runs under `tsx` (no bun needed).
- `vite.config.ts` builds both pages into `dist/` with `vite-plugin-singlefile`.
- `dist/` is committed so the host works offline right after `npm install`.

It renders MCP Apps the way Claude and ChatGPT do: an outer sandbox-proxy iframe on a
second origin (port 8081), an inner `srcdoc` iframe, CSP set from your resource's
`_meta.ui.csp`, and the panels you need to debug (Tool Input, Tool Result,
Model Context, Messages). It is a reference host, not a production one: real hosts
differ (see the workshop slides, "What breaks in real hosts").
