# AGENTS.md

This repo is a **hands-on workshop**. A person is learning here, and you are helping them do one step at a time. The goal isn't finished code. The goal is that they understand the code you write. Work in small, explained steps, and stop when the step is done.

## What the person will type

Nobody pastes prompts here. They type a short command:

| They say | You do |
|---|---|
| "do step N" (also "step N", "implement step N") | Open `PROMPTS.md`, find the heading `## Step N`, and carry out the text inside that step's **Prompt** code block exactly, as if they had pasted it. Then the checks and "Explain it back" (rules 5 and 6) |
| "do step N with my component" | Same, but use the "Bring your own component" section of `PROMPTS.md` |
| "explain step N" | Answer that step's "Explain it back" questions, quoting the code in `app/` |
| "catch me up to step N" | Don't run it yourself while `npm run dev` is running. Tell them: stop dev (Ctrl+C), `npm run catchup N`, `npm run dev` |

No step number? Look at `app/`: no `app/contract/` means step 1 is next, no `app/server/` means step 2. Otherwise ask which step. Step 0 and step 5 are commands the person runs in their own terminal, so tell them what to run.

## The rules

1. **Work only in `app/`.** Never edit `steps/`, `host/`, `scripts/` or the root config files, and don't add dependencies. Everything the workshop needs is installed, and the room may be offline.
2. **Do only the step the person asked for.** The prompts are in `PROMPTS.md`, one per step. Don't start the next step, and don't add anything the prompt didn't ask for (extra buttons, simulations, navigation, refactors). If something extra seems useful, suggest it in one line and let the person decide.
3. **Don't look at the answer.** `steps/step-N/` holds the finished code for every step. Don't read it or copy from it unless the person asks you to. Work from the prompt, the existing code in `app/`, and the SDK's types in `node_modules/@modelcontextprotocol/`.
4. **Use the pinned packages.** `@modelcontextprotocol/ext-apps` 2.0.3 on the v2 split SDK (`@modelcontextprotocol/server`, `/client`, `/node`, `/express`). Never import from `@modelcontextprotocol/sdk` (that is the 1.x API). When you're unsure of an API, read the types: `node_modules/@modelcontextprotocol/ext-apps/dist/src/app.d.ts` for the view, `.../server/index.d.ts` for the server helpers.
5. **Check your work.** Run `npm run typecheck`, and from step 2 on, `npm run check`. The step is done when both pass. If `npm run dev` is running, a new `app/server` folder needs a restart of dev (say so).
6. **Explain it back.** When the checks pass, answer each question under "Explain it back" for this step in `PROMPTS.md`, in the chat, **quoting the lines you wrote**. Then stop and let the person read it. Don't move on until they say so.
7. **Leave the browser to the person.** Each step has a checkpoint in a browser: the playground on :5173, or the local host on :8080 with its Tool Input, Tool Result and Model Context panels. You can't see it; they can. Tell them what to look for.

## Commands

| Command | What it does |
|---|---|
| `npm run typecheck` | `tsc --noEmit` over `app/` and the host |
| `npm run check` | Talks to the MCP server like a host: tools, the `ui://` resource, idempotency, strict schemas |
| `npm run catchup <n>` | Replaces `app/` with step n (backs up the person's version first). Only when the person asks. They must stop `npm run dev` first |
| `npm run dev` | Long-running: playground, view build, MCP server, local host. Ask the person to run it in their own terminal |

## The project

- `app/component/TableBooker.tsx` is the React component. **Never modify it**: the workshop's point is that it runs everywhere unchanged.
- `app/contract/` (step 1+) is the framework-free contract: `mount / update / destroy` plus events.
- `app/server/` (step 2+) is the MCP server; `app/view/` is the MCP App view, bundled into one HTML file.
- TypeScript is strict. Match the style of the code around you: comments, naming, two-space indents, double quotes, `const` arrow functions.
