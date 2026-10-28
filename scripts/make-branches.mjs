#!/usr/bin/env node
// For the facilitator, once, before publishing the repo: turns steps/step-N into
// git branches `step-N` (where app/ == steps/step-N) on top of the current commit.
// Requires a clean git working tree. Does not push.
import { execFileSync } from "node:child_process";
import { cpSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8" }).trim();
if (git("status", "--porcelain")) throw new Error("Commit or stash your changes first.");
const base = git("rev-parse", "--abbrev-ref", "HEAD");
for (const step of readdirSync(path.join(root, "steps")).filter((d) => d.startsWith("step-")).sort()) {
  git("checkout", "-B", step, base);
  rmSync(path.join(root, "app"), { recursive: true, force: true });
  cpSync(path.join(root, "steps", step), path.join(root, "app"), { recursive: true });
  git("add", "-A", "app");
  try { git("commit", "-m", `${step}: app/ at ${step}`); } catch { /* step-0 == base */ }
  console.log(`branch ${step} ready`);
}
git("checkout", base);
