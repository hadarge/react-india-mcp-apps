// Dev server for the "human" consumers of the component: plain React page,
// and (from step 1) a vanilla JS page and a Vue page that mount it via its contract.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import vue from "@vitejs/plugin-vue";
import path from "node:path";

const APP_DIR = path.resolve(process.env.APP_DIR ?? "app");

export default defineConfig({
  root: path.join(APP_DIR, "playground"),
  plugins: [react(), vue()],
  server: { port: Number(process.env.PLAYGROUND_PORT ?? 5173), strictPort: true, fs: { allow: [APP_DIR, path.resolve("node_modules")] } },
  clearScreen: false,
});
