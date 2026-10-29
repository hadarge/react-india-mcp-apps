// Who holds a port, and freeing it: lsof on macOS/Linux, netstat + tasklist on Windows.
// Never crashes if those tools are missing; it just finds nothing.
import { spawnSync } from "node:child_process";

const sh = (cmd, args) => spawnSync(cmd, args, { encoding: "utf8" }).stdout ?? "";

// [{ pid, name }] listening on `port`.
export const holders = (port) => {
  const found = new Map();
  if (process.platform === "win32") {
    for (const l of sh("netstat", ["-ano", "-p", "TCP"]).split(/\r?\n/)) {
      if (!new RegExp(`:${port}\\s.*LISTENING`).test(l)) continue;
      const pid = Number(l.trim().split(/\s+/).pop());
      const csv = sh("tasklist", ["/FI", `PID eq ${pid}`, "/FO", "CSV", "/NH"]);
      found.set(pid, csv.split(",")[0]?.replaceAll('"', "").trim() || "unknown");
    }
  } else {
    for (const l of sh("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"]).split("\n").slice(1)) {
      const [name, pid] = l.trim().split(/\s+/);
      if (pid) found.set(Number(pid), name);
    }
  }
  return [...found].map(([pid, name]) => ({ pid, name }));
};

const isNode = (name) => /^node(\.exe)?$/i.test(name);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Stop Node processes holding our ports: a dev server left running in another terminal,
// or another workshop's `npm start` on the same ports. Anything that isn't Node is left alone.
// Returns the ports still held by something else.
export const freePorts = async (ports) => {
  const blocked = [];
  for (const [port, what] of ports) {
    const held = holders(port).filter((h) => h.pid !== process.pid && h.pid !== process.ppid);
    if (!held.length) continue;
    for (const h of held.filter((h) => isNode(h.name))) {
      console.log(`  Stopping a Node process on :${port} (pid ${h.pid}) so ${what} can start there.`);
      if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(h.pid), "/T", "/F"], { stdio: "ignore" });
      else try { process.kill(h.pid, "SIGTERM"); } catch {}
    }
    for (let i = 0; i < 30 && holders(port).some((h) => isNode(h.name)); i++) await sleep(100);
    for (const h of holders(port).filter((h) => isNode(h.name))) try { process.kill(h.pid, "SIGKILL"); } catch {}
    const left = holders(port);
    if (left.length) blocked.push([port, what, left]);
  }
  return blocked;
};
