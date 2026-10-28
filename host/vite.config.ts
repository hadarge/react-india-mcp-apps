// Builds the vendored ext-apps basic-host into two self-contained HTML files.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const INPUT = process.env.INPUT ?? "index.html";

export default defineConfig({
  root: here,
  plugins: [react(), viteSingleFile()],
  logLevel: "warn",
  build: {
    rollupOptions: { input: path.join(here, INPUT) },
    outDir: path.join(here, "dist"),
    emptyOutDir: false,
  },
});
