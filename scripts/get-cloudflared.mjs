#!/usr/bin/env node
// Downloads Cloudflare's official cloudflared binary into .tools/ (no installer, no admin rights).
// `npm run tunnel` uses it automatically. Windows on ARM gets the x64 build, which runs under emulation.
import { chmodSync, createWriteStream, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const { platform, arch } = process;
const asset =
  platform === "win32" ? "cloudflared-windows-amd64.exe"
  : platform === "linux" ? (arch === "arm64" ? "cloudflared-linux-arm64" : "cloudflared-linux-amd64")
  : null;
if (!asset) {
  console.log("On macOS use Homebrew: brew install cloudflared");
  process.exit(0);
}
const dir = path.join(root, ".tools");
const out = path.join(dir, platform === "win32" ? "cloudflared.exe" : "cloudflared");
if (existsSync(out)) {
  console.log(`Already there: ${path.relative(root, out)}`);
  process.exit(0);
}
mkdirSync(dir, { recursive: true });
const url = `https://github.com/cloudflare/cloudflared/releases/latest/download/${asset}`;
console.log(`Downloading ${asset} (about 40 MB) ...`);
const res = await fetch(url, { redirect: "follow" });
if (!res.ok) {
  console.error(`Download failed: HTTP ${res.status}. Get it by hand from ${url} and save it as ${out}`);
  process.exit(1);
}
await pipeline(Readable.fromWeb(res.body), createWriteStream(out));
if (platform !== "win32") chmodSync(out, 0o755);
console.log(`Saved ${path.relative(root, out)}. Now: npm run tunnel`);
