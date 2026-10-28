// Builds the local MCP Apps host (vendored from modelcontextprotocol/ext-apps examples/basic-host).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vite = path.join(root, "node_modules", "vite", "bin", "vite.js");
const force = process.argv.includes("--force");
const dist = path.join(root, "host", "dist");

export const buildHost = ({ quiet = false } = {}) => {
  for (const input of ["index.html", "sandbox.html"]) {
    if (!force && existsSync(path.join(dist, input))) continue;
    if (!quiet) console.log(`[host] building ${input}...`);
    execFileSync(process.execPath, [vite, "build", "--config", path.join(root, "host", "vite.config.ts")], {
      cwd: root,
      env: { ...process.env, INPUT: input },
      stdio: quiet ? "ignore" : "inherit",
    });
  }
};

if (import.meta.url === `file://${process.argv[1]}`) buildHost();
