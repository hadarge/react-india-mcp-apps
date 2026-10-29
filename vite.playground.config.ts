// Dev server for the "human" consumers of the component: plain React page,
// and (from step 1) a vanilla JS page and a Vue page that mount it via its contract.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import path from "node:path";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import type { Plugin } from "vite";

const APP_DIR = path.resolve(process.env.APP_DIR ?? "app");

// The workshop guide at /guide (guide/index.html), plus /__guide/status: which step app/ looks like,
// which servers are up, and the tunnel URL once `npm run tunnel` has one.
const listening = (port: number) =>
  new Promise<boolean>((resolve) => {
    const s = net.connect({ port, host: "127.0.0.1" });
    s.setTimeout(400);
    s.once("connect", () => (s.destroy(), resolve(true)));
    s.once("error", () => resolve(false));
    s.once("timeout", () => (s.destroy(), resolve(false)));
  });
const looksLikeStep = () => {
  const has = (f: string) => existsSync(path.join(APP_DIR, f));
  const server = has("server/server.ts") ? readFileSync(path.join(APP_DIR, "server/server.ts"), "utf8") : "";
  if (/table-booker-v5/.test(server)) return 5;
  if (has("view/host-theme.css") || /load_slots/.test(server)) return 4;
  if (has("server/bookings.ts")) return 3;
  if (has("server/main.ts")) return 2;
  if (has("contract/widget.ts")) return 1;
  return 0;
};
const guide = (): Plugin => ({
  name: "workshop-guide",
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const url = req.url?.split("?")[0];
      if (url === "/guide" || url === "/guide/") {
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        return res.end(readFileSync(path.resolve("guide/index.html")));
      }
      if (url === "/__guide/status") {
        const mcpPort = Number(process.env.PORT ?? 3001);
        const hostPort = Number(process.env.HOST_PORT ?? 8080);
        const tunnelFile = path.resolve(".tunnel-url");
        res.setHeader("Content-Type", "application/json");
        return res.end(JSON.stringify({
          step: looksLikeStep(),
          playgroundPort: Number(process.env.PLAYGROUND_PORT ?? 5173),
          mcpPort, hostPort,
          mcp: await listening(mcpPort),
          host: await listening(hostPort),
          tunnel: existsSync(tunnelFile) ? readFileSync(tunnelFile, "utf8").trim() || null : null,
        }));
      }
      next();
    });
  },
});

export default defineConfig({
  root: path.join(APP_DIR, "playground"),
  plugins: [react(), vue(), guide()],
  server: { port: Number(process.env.PLAYGROUND_PORT ?? 5173), strictPort: true, fs: { allow: [APP_DIR, path.resolve("node_modules")] } },
  clearScreen: false,
});
