#!/usr/bin/env node
// Exposes http://localhost:3001 on a public HTTPS URL so Claude / ChatGPT can reach it.
// Default: Cloudflare quick tunnel (no account). Fallback: `ngrok http 3001`.
// The URL changes on every restart: re-add the connector (or edit its URL) each time.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

// Follows `npm run dev -- --port N` (dev writes .dev-port); PORT env or --port override it.
const portArg = process.argv.indexOf("--port");
const devPort = new URL("../.dev-port", import.meta.url);
const port = portArg > 0 ? process.argv[portArg + 1] : process.env.PORT ?? (existsSync(devPort) ? readFileSync(devPort, "utf8").trim() : "3001");
const win = process.platform === "win32";
// On Windows, npm's shims are .cmd files, which Node can only start through a shell.
const has = (cmd) => spawnSync(cmd, ["--version"], { stdio: "ignore", shell: win }).status === 0;

let cmd, args;
if (!has("cloudflared") && win && process.arch === "arm64") {
  // The cloudflared npm package has no Windows-on-ARM build. The official x64 one runs under emulation.
  console.error("cloudflared isn't installed, and `npx cloudflared` has no Windows ARM build.\n" +
    "Install it once:  winget install --id Cloudflare.cloudflared   (then open a new terminal)\n" +
    `Or use ngrok:     ngrok http ${port}   and add <https-url>/mcp as the connector.`);
  process.exit(1);
}
if (has("cloudflared")) [cmd, args] = ["cloudflared", ["tunnel", "--no-autoupdate", "--url", `http://localhost:${port}`]];
else [cmd, args] = [win ? "npx.cmd" : "npx", ["-y", "cloudflared@0.7.1", "tunnel", "--no-autoupdate", "--url", `http://localhost:${port}`]];

console.log(`Starting a Cloudflare quick tunnel to localhost:${port} ...`);
const child = spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], shell: win });
let shown = false;
const scan = (d) => {
  const m = String(d).match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);
  if (m && !shown) {
    shown = true;
    const url = `${m[0]}/mcp`;
    console.log(`\n  Connector URL:  \x1b[1m${url}\x1b[0m\n`);
    console.log(`  Check it:       npm run check -- ${url}`);
    console.log(`  Claude:         Settings → Connectors → Add custom connector → paste the URL (no auth)`);
    console.log(`  ChatGPT:        chatgpt.com/plugins → + → Add custom MCP server → paste the URL (developer mode, plan-dependent)`);
    console.log(`\n  Keep this terminal open. Ctrl+C closes the tunnel.\n`);
  }
};
child.stdout.on("data", scan);
child.stderr.on("data", (d) => {
  scan(d);
  if (/error|failed/i.test(String(d)) && !shown) process.stderr.write(d);
});
child.on("exit", (code) => {
  if (!shown) console.error(`\nTunnel did not start (exit ${code}). Fallback: install ngrok and run \`ngrok http ${port}\`, then use <https-url>/mcp.`);
  process.exit(code ?? 0);
});
process.on("SIGINT", () => child.kill("SIGINT"));
