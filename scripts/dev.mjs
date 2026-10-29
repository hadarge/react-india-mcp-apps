#!/usr/bin/env node
// One command for the whole workshop loop:
//   playground (http://localhost:5173)  - the component in React / vanilla / Vue pages
//   view build (watch)                  - bundles app/view into one HTML file
//   MCP server (http://localhost:3001)  - tools + ui:// resource
//   local host (http://localhost:8080)  - ext-apps basic-host, renders MCP Apps like Claude does
//
// Usage: npm run dev                 (your working copy in ./app)
//        npm run dev -- --step 3     (run a finished step without touching ./app)
//        npm run dev -- --port 3011  (if 3001 is taken; works on Windows too)
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildHost } from "./build-host.mjs";
import { freePorts } from "./ports.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const stepIdx = args.indexOf("--step");
const step = stepIdx >= 0 ? args[stepIdx + 1] : null;
const appDir = step != null ? path.join(root, "steps", `step-${step}`) : path.resolve(root, process.env.APP_DIR ?? "app");
if (!existsSync(appDir)) {
  console.error(`No such folder: ${appDir}`);
  process.exit(1);
}

const portIdx = args.indexOf("--port");
// Sticky port: once you've run `--port 3011`, later plain `npm run dev` runs (e.g. after catchup) keep it.
// `npm run dev -- --port 3001` switches back.
const devPortFile = path.join(root, ".dev-port");
const savedPort = existsSync(devPortFile) ? readFileSync(devPortFile, "utf8").trim() : undefined;
const PORT = portIdx >= 0 ? args[portIdx + 1] : (process.env.PORT ?? savedPort ?? "3001");
// Remember the port so `npm run check` and `npm run tunnel` follow `--port` too.
writeFileSync(devPortFile, PORT);
const env = { ...process.env, APP_DIR: appDir, PORT, SERVERS: process.env.SERVERS ?? JSON.stringify([`http://localhost:${PORT}/mcp`]), FORCE_COLOR: "1" };
const bin = (pkg, file) => path.join(root, "node_modules", pkg, file);
const colors = { play: 35, view: 36, mcp: 33, host: 32 };
const children = [];

const run = (name, cmd, cmdArgs) => {
  const child = spawn(process.execPath, [cmd, ...cmdArgs], { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] });
  const tag = `\x1b[${colors[name]}m[${name}]\x1b[0m `;
  const pipe = (stream, out) => {
    let buf = "";
    stream.on("data", (d) => {
      buf += d;
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const l of lines) if (l.trim()) out.write(tag + l + "\n");
    });
  };
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on("exit", (code) => {
    if (code) console.error(`${tag}exited with code ${code}`);
    // One part stopped (e.g. a newer \`npm run dev\` took the ports): stop the rest too, don't linger.
    if (!stopping) {
      console.error(`${tag}stopped; shutting down this dev run. Start it again with \`npm run dev\`.`);
      stop();
    }
  });
  children.push(child);
};

const rel = path.relative(root, appDir) || ".";
const hasView = existsSync(path.join(appDir, "view"));
const hasServer = existsSync(path.join(appDir, "server", "main.ts"));

console.log(`\n  Running \x1b[1m${rel}\x1b[0m\n`);

// Free our ports first. A Node process on them is a dev server from another terminal, or another
// workshop's `npm start`: stop it. Anything else is left alone, with a way around it.
const ports = [[Number(process.env.PLAYGROUND_PORT ?? 5173), "the playground"]];
if (hasServer) ports.push([Number(PORT), "the MCP server"], [Number(process.env.HOST_PORT ?? 8080), "the local host"], [8081, "the host sandbox"]);
for (const [port, what, left] of await freePorts(ports)) {
  const hint = port === Number(PORT) ? `run \`npm run dev -- --port ${Number(PORT) + 10}\`` : "close that program first";
  console.error(`  Port ${port} (${what}) is held by ${left.map((h) => `${h.name} pid ${h.pid}`).join(", ")}: ${hint}.`);
}
console.log(`  Playground   http://localhost:${process.env.PLAYGROUND_PORT ?? 5173}        (React, vanilla, Vue consumers)`);
if (hasServer) {
  console.log(`  MCP server   http://localhost:${PORT}/mcp`);
  console.log(`  Local host   http://localhost:${process.env.HOST_PORT ?? 8080}        (pick a tool, press Call Tool)`);
}
const guideUrl = `http://localhost:${process.env.PLAYGROUND_PORT ?? 5173}/guide`;
console.log(`  \x1b[1mGuide        ${guideUrl}\x1b[0m   (every step, with links)`);
console.log("");

run("play", bin("vite", "bin/vite.js"), ["--config", "vite.playground.config.ts"]);
if (hasView) run("view", bin("vite", "bin/vite.js"), ["build", "--watch", "--config", "vite.view.config.ts"]);
if (hasServer) {
  buildHost({ quiet: true });
  run("mcp", bin("tsx", "dist/cli.mjs"), ["watch", "--clear-screen=false", path.join(appDir, "server", "main.ts")]);
  run("host", bin("tsx", "dist/cli.mjs"), ["host/serve.ts"]);
}

// Open the guide in the browser on the first run (and again after 6 hours), not on every restart.
// Opt out: GUIDE=0 npm run dev. Never in CI.
const openedFile = path.join(root, ".guide-opened");
const recentlyOpened = existsSync(openedFile) && Date.now() - statSync(openedFile).mtimeMs < 6 * 3600_000;
if (!process.env.CI && process.env.GUIDE !== "0" && !recentlyOpened) {
  setTimeout(() => {
    const [cmd, cmdArgs] = process.platform === "darwin" ? ["open", [guideUrl]] : process.platform === "win32" ? ["cmd", ["/c", "start", "", guideUrl]] : ["xdg-open", [guideUrl]];
    try { spawn(cmd, cmdArgs, { stdio: "ignore", detached: true }).on("error", () => {}).unref(); writeFileSync(openedFile, guideUrl); } catch {}
  }, 2500);
}

let stopping = false;
const stop = () => {
  stopping = true;
  for (const c of children) {
    // Windows has no process groups: kill the whole tree, or tsx's server child keeps holding the port.
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(c.pid), "/T", "/F"], { stdio: "ignore" });
    else c.kill("SIGTERM");
  }
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
