# Your component renders in React. Soon it needs to render in ChatGPT.

The starter repo for the React India 2026 workshop (Goa, Thu 29 Oct, 1:30 to 3:30 PM IST) with Hadar Geva.

You take a real React component, pull its contract out of the framework, and run it in three hosts with no fork: a vanilla page, a React host and a Vue host. Then you serve the same unit to an LLM as an **MCP App**, so it renders inside Claude or ChatGPT and books a table back on your server.

The core path needs **no AI account and no API key**. A local MCP Apps host is included.

## Before the workshop (10 minutes, at home, on good wifi)

```bash
git clone <repo-url> react-india-mcp-apps && cd react-india-mcp-apps
npm install
npm run doctor
npm run dev        # opens the workshop guide: http://localhost:5173/guide
```

Requirements: Node **22 LTS** (22.12+; 20.19+ also works), a coding agent you are comfortable with (Claude Code, Cursor, Copilot, Codex…), and git (optional). No AI account or API key is needed for the core path. Optional, for the last step: `cloudflared` (macOS `brew install cloudflared`; Windows and Linux `npm run get-cloudflared`, which downloads Cloudflare's official binary into this folder with no admin rights) and a Claude or ChatGPT account that can add a custom connector.

**Windows:** everything works in PowerShell. Use `npm run dev -- --port 3011` (not `PORT=…`) if a non-Node program holds port 3001 (`npm run dev` stops leftover Node servers on its ports by itself), run `npm run catchup N` and `npm run dev` as two separate commands, and always stop `npm run dev` (Ctrl+C) before `catchup`.

## What runs

| URL | What it is |
|---|---|
| http://localhost:5173 | **Playground.** The component as humans consume it: a React page, and from step 1 also vanilla, React-via-contract and Vue pages |
| http://localhost:3001/mcp | **Your MCP server.** Tools plus the `ui://` resource (from step 2) |
| http://localhost:8080 | **Local MCP Apps host.** The ext-apps reference host: a sandboxed double iframe with CSP and debug panels. It plays the role Claude or ChatGPT will play |

`npm run dev` starts all of them and rebuilds the view on save. `npm run check` talks to your server the way a host does and tells you what is wrong.

## The steps

| Step | You build | Folder with the answer |
|---|---|---|
| 0 | Nothing: run it | `steps/step-0` (= the starting `app/`) |
| 1 | The contract: `mount / update / destroy` plus events. Vanilla, React and Vue hosts | `steps/step-1` |
| 2 | MCP server: `find_table` tool + `ui://` resource. The view is one more host of the contract | `steps/step-2` |
| 3 | Round trip: app-only `book_table`, idempotency, strict schemas, `updateModelContext`, model-visible `get_booking` | `steps/step-3` |
| 4 | Host-proof: summary to the model, data pulled by the view, CSP under both keys, host theme, mount ≠ call, explicit height | `steps/step-4` |
| 5 | Real hosts: tunnel, public URL derived per request, Claude / ChatGPT | `steps/step-5` |

The prompts, checkpoints and fixes for every step are in **[PROMPTS.md](PROMPTS.md)**. Each step ends with three **Explain it back** questions: when the step works, your agent answers them in the chat, quoting the code it wrote, and you check the answers. [AGENTS.md](AGENTS.md) gives your agent the workshop's rules (work only in `app/`, don't copy from `steps/`, check, explain); Cursor, Copilot, Codex and others read it directly, and Claude Code reads it through `CLAUDE.md`.

Fell behind? `npm run catchup 3` makes `app/` equal to step 3 (it backs up yours first). You can also run any finished step without touching your work: `npm run dev -- --step 3`. If the repo was published with step branches (`scripts/make-branches.mjs`), `git checkout step-3` works too.

## Layout

```
app/                    your working copy (starts at step 0)
  component/            TableBooker.tsx: the React component (never modified after step 0)
  data/                 deterministic mock availability for a fictional beach shack
  playground/           human consumers (React, vanilla, React-via-contract, Vue)
  contract/             step 1+: the framework-free contract and its React implementation
  server/               step 2+: MCP server (stateless Streamable HTTP)
  view/                 step 2+: the MCP App view, bundled to one HTML file
steps/step-N/           finished snapshots of app/
host/                   local MCP Apps host (vendored ext-apps basic-host, see host/NOTICE.md)
scripts/                dev, doctor, check, catchup, tunnel, e2e-all
```

## Versions (pinned, verified 21 Oct 2026)

`@modelcontextprotocol/ext-apps` 2.0.3 · `@modelcontextprotocol/server|client|core` 2.3.1 · `@modelcontextprotocol/node` 2.1.1 · `@modelcontextprotocol/express` 2.0.2 · `zod` 4.6.5 · `react` 19.2.9 · `vite` 8.3.4 · `vite-plugin-singlefile` 2.3.4.

ext-apps 2.x is built on the **v2 split SDK packages**, not `@modelcontextprotocol/sdk`. The wire protocol is unchanged from 1.x, so a view built here works in hosts built on 1.x.

## Scripts

| Script | What it does |
|---|---|
| `npm run dev [-- --step N]` | playground + view watch build + MCP server + local host |
| `npm run doctor` | preflight: Node version, dependencies, free ports, optional tunnel tool |
| `npm run check [-- <url>]` | headless host: lists tools, reads the resource, calls tools, checks idempotency and strict schemas |
| `npm run catchup <N>` | replace `app/` with step N (backs yours up to `.backups/`) |
| `npm run tunnel` | Cloudflare quick tunnel to your dev port (default 3001) and prints your connector URL |
| `npm run get-cloudflared` | Windows/Linux: downloads the official `cloudflared` into `.tools/` (no admin). `tunnel` uses it |
| `npm run test:e2e` | typecheck, build and check every step from scratch |
| `npm run typecheck` | `tsc --noEmit` over `app/` and the host |

## Credits

The local host is `examples/basic-host` from [modelcontextprotocol/ext-apps](https://github.com/modelcontextprotocol/ext-apps) (MIT). Sunset Shack is fictional.
