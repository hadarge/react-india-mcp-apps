#!/usr/bin/env node
// Fell behind? Copy a finished step into ./app and keep going.
//   npm run catchup 3        -> app/ becomes steps/step-3 (your current app/ is backed up first)
// Works without git and without network.
import { cpSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const n = process.argv[2];
const src = path.join(root, "steps", `step-${n}`);
if (!n || !existsSync(src)) {
  console.error("Usage: npm run catchup <step>   (0-5)");
  process.exit(1);
}
const app = path.join(root, "app");
if (existsSync(app)) {
  const backups = path.join(root, ".backups");
  mkdirSync(backups, { recursive: true });
  const dest = path.join(backups, `app-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  try {
    renameSync(app, dest);
  } catch (e) {
    console.error(`Could not move app/ (${e.code}). Stop \`npm run dev\` first (Ctrl+C), then run catchup again.`);
    process.exit(1);
  }
  console.log(`Backed up your app/ to ${path.relative(root, dest)}`);
}
cpSync(src, app, { recursive: true, filter: (p) => !p.includes(`${path.sep}.dist`) });
rmSync(path.join(app, ".dist"), { recursive: true, force: true });
console.log(`app/ is now step ${n}. If \`npm run dev\` is running, restart it (Ctrl+C, then npm run dev).`);
