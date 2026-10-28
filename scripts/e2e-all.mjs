#!/usr/bin/env node
// Verifies every finished step from a clean state:
//   typecheck -> build playground pages -> build view -> start server -> npm run check
// Used before the workshop (and by CI if you add it). Takes ~1-2 minutes.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, writeFileSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const node = process.execPath;
const vite = path.join(root, "node_modules/vite/bin/vite.js");
const tsx = path.join(root, "node_modules/tsx/dist/cli.mjs");
const tsc = path.join(root, "node_modules/typescript/bin/tsc");
const only = process.argv[2];
const steps = readdirSync(path.join(root, "steps")).filter((d) => d.startsWith("step-") && (!only || d === `step-${only}`)).sort();
const results = [];

const sh = (label, args, env = {}) => {
  const r = spawnSync(node, args, { cwd: root, env: { ...process.env, ...env }, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${label} failed:\n${(r.stdout + r.stderr).slice(-2000)}`);
  return r.stdout;
};

for (const [i, step] of steps.entries()) {
  const dir = path.join(root, "steps", step);
  const row = { step, typecheck: "-", playground: "-", view: "-", check: "-" };
  results.push(row);
  try {
    const tsconfig = path.join(root, `.tsconfig.${step}.json`);
    writeFileSync(tsconfig, JSON.stringify({ extends: "./tsconfig.json", include: [`steps/${step}`] }));
    try { sh("typecheck", [tsc, "--noEmit", "-p", tsconfig]); } finally { rmSync(tsconfig); }
    row.typecheck = "ok";

    const pages = readdirSync(path.join(dir, "playground")).filter((f) => f.endsWith(".html"));
    const out = path.join(root, ".e2e", step);
    const input = Object.fromEntries(pages.map((p) => [p.replace(".html", ""), path.join(dir, "playground", p)]));
    writeFileSync(path.join(root, `.vite.${step}.mjs`), `import base from "./vite.playground.config.ts";\nexport default { ...base, logLevel: "error", build: { outDir: ${JSON.stringify(out)}, emptyOutDir: true, rollupOptions: { input: ${JSON.stringify(input)} } } };\n`);
    try { sh("playground build", [vite, "build", "--config", `.vite.${step}.mjs`], { APP_DIR: dir }); } finally { rmSync(path.join(root, `.vite.${step}.mjs`)); }
    row.playground = `ok (${pages.length} pages)`;

    if (existsSync(path.join(dir, "view"))) {
      sh("view build", [vite, "build", "--config", "vite.view.config.ts"], { APP_DIR: dir });
      row.view = "ok";
    }
    if (existsSync(path.join(dir, "server", "main.ts"))) {
      const port = String(3200 + i);
      const srv = spawn(node, [tsx, path.join(dir, "server", "main.ts")], { cwd: root, env: { ...process.env, PORT: port, APP_DIR: dir }, stdio: ["ignore", "pipe", "pipe"] });
      await new Promise((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("server did not start")), 20000);
        srv.stdout.on("data", (d) => String(d).includes("listening") && (clearTimeout(t), resolve()));
        srv.on("exit", (c) => reject(new Error(`server exited ${c}`)));
      });
      const r = spawnSync(node, [path.join(root, "scripts/check.mjs"), `http://localhost:${port}/mcp`], { encoding: "utf8" });
      srv.kill();
      row.check = r.status === 0 ? "ok" : "FAIL";
      if (r.status !== 0) console.log(r.stdout);
    }
  } catch (e) {
    row.error = e.message.split("\n").slice(0, 8).join("\n");
  }
}

rmSync(path.join(root, ".e2e"), { recursive: true, force: true });
console.table(results.map(({ error, ...r }) => r));
const errs = results.filter((r) => r.error || r.check === "FAIL");
for (const r of errs) if (r.error) console.log(`\n${r.step}: ${r.error}`);
process.exit(errs.length ? 1 : 0);
