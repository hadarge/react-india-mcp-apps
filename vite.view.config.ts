// Bundles the MCP App view into ONE self-contained HTML file (JS + CSS inlined).
// Hosts fetch it with resources/read and drop it into a sandboxed iframe, so
// there is no dev server, no relative URLs, and no second request.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import path from "node:path";

const APP_DIR = path.resolve(process.env.APP_DIR ?? "app");

export default defineConfig({
  root: path.join(APP_DIR, "view"),
  plugins: [react(), viteSingleFile()],
  logLevel: "warn",
  clearScreen: false,
  build: {
    outDir: path.join(APP_DIR, ".dist"),
    emptyOutDir: true,
    sourcemap: false,
  },
});
