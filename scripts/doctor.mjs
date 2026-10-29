#!/usr/bin/env node
// Preflight. Run it before the workshop and again when you sit down.
// Everything here works offline once `npm install` has finished.
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { holders } from "./ports.mjs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
let problems = 0;
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const bad = (m, fix) => { problems++; console.log(`  \x1b[31m✗\x1b[0m ${m}\n    fix: ${fix}`); };

console.log("\nWorkshop doctor\n");

const [maj, min] = process.versions.node.split(".").map(Number);
if (maj > 22 || (maj === 22 && min >= 12) || (maj === 20 && min >= 19)) ok(`Node ${process.versions.node}`);
else bad(`Node ${process.versions.node} is too old`, "install Node 22 LTS (https://nodejs.org) or `nvm install 22`");

const deps = ["@modelcontextprotocol/ext-apps", "@modelcontextprotocol/server", "@modelcontextprotocol/client", "vite", "react", "react-dom", "vue", "tsx", "zod", "express"];
const missing = deps.filter((dep) => !existsSync(path.join(root, "node_modules", dep, "package.json")));
if (missing.length) bad(`missing dependencies: ${missing.join(", ")}`, "run `npm install` (no internet? copy the repo from the USB stick, then `npm ci --offline --cache ./.npm-cache`)");
else ok("dependencies installed");

// A custom npm registry (corporate mirror, an old local mirror in ~/.npmrc) is the most common reason installs fail.
const registry = (spawnSync("npm", ["config", "get", "registry"], { encoding: "utf8", shell: process.platform === "win32" }).stdout ?? "").trim();
if (registry && !/^https:\/\/registry\.npmjs\.org\/?$/.test(registry))
  warn(`npm registry is ${registry}. If installs fail, run: npm install --registry=https://registry.npmjs.org/`);

if (existsSync(path.join(root, "host", "dist", "index.html")) && existsSync(path.join(root, "host", "dist", "sandbox.html"))) ok("local MCP Apps host is built");
else warn("local host not built yet; `npm run dev` builds it on first run (~10 s)");

// A port is busy if anything accepts a connection on it (IPv4 or IPv6 localhost).
const accepts = (port, host) => {
  return new Promise((resolve) => {
    const s = net.connect({ port, host });
    s.setTimeout(500);
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
    s.once("timeout", () => (s.destroy(), resolve(false)));
  });
};
const portFree = async (port) => {
  return !(await accepts(port, "127.0.0.1")) && !(await accepts(port, "::1"));
};
// Who holds a port: lsof on macOS/Linux, netstat on Windows. Never crash if neither exists.
const whoHolds = (port) => {
  if (process.platform === "win32") {
    const out = spawnSync("netstat", ["-ano", "-p", "TCP"], { encoding: "utf8" }).stdout ?? "";
    const line = out.split(/\r?\n/).find((l) => new RegExp(`:${port}\\s.*LISTENING`).test(l));
    return line ? `pid ${line.trim().split(/\s+/).pop()}` : "unknown";
  }
  const out = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], { encoding: "utf8" }).stdout ?? "";
  return out.split("\n")[1]?.split(/\s+/).slice(0, 2).join(" pid ") || "unknown";
};
// The MCP port follows `npm run dev -- --port N` (sticky in .dev-port).
const devPortFile = new URL("../.dev-port", import.meta.url);
const mcpPort = Number(process.env.PORT ?? (existsSync(devPortFile) ? readFileSync(devPortFile, "utf8").trim() : 3001));
for (const [port, what] of [[5173, "playground"], [mcpPort, "MCP server"], [8080, "local host"], [8081, "host sandbox"]]) {
  if (await portFree(port)) ok(`port ${port} free (${what})`);
  else {
    const held = holders(port);
    if (held.length && held.every((h) => /^node(\.exe)?$/i.test(h.name))) warn(`port ${port} is held by Node (pid ${held.map((h) => h.pid).join(", ")}); \`npm run dev\` stops it for you`);
    else bad(`port ${port} is busy (${whoHolds(port)})`, port === mcpPort ? "stop it, or run `npm run dev -- --port 3011` (the host, check and tunnel follow)" : `stop the process using ${port}`);
  }
}

const has = (cmd) => spawnSync(cmd, ["--version"], { stdio: "ignore", shell: process.platform === "win32" }).status === 0;
if (has("cloudflared")) ok("cloudflared found (for connecting Claude / ChatGPT)");
else if (existsSync(path.join(root, ".tools", process.platform === "win32" ? "cloudflared.exe" : "cloudflared"))) ok("cloudflared found in .tools/ (for connecting Claude / ChatGPT)");
else warn(`cloudflared not installed: optional, only for the real-host step (${process.platform === "darwin" ? "`brew install cloudflared`" : "`npm run get-cloudflared`, no admin rights"})`);
if (has("git")) ok("git found");
else warn("git not found: use `npm run catchup <n>` to jump between steps");

console.log(problems ? `\n${problems} thing(s) to fix before the workshop.\n` : "\nYou're ready. Run `npm run dev`.\n");
process.exit(problems ? 1 : 0);
