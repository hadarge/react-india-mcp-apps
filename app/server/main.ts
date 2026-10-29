// Streamable HTTP entry point. Stateless: a fresh McpServer per request, which is how the
// 2026-07-28 spec works. createMcpHandler serves that era and still answers 2025 clients.
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import cors from "cors";
import express, { type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3001);

const main = async () => {
  if (process.argv.includes("--stdio")) {
    await createServer({ publicUrl: process.env.PUBLIC_URL ?? `http://localhost:${PORT}` }).connect(new StdioServerTransport());
    return;
  }

  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());
  // Static assets the view loads by URL (the venue logo). The sandbox will only
  // load them if the resource declares this origin in its CSP (see server.ts).
  app.use("/assets", express.static(path.join(path.dirname(fileURLToPath(import.meta.url)), "assets")));

  // createMcpHandler answers both protocol eras with a fresh McpServer per request: 2026-07-28
  // (server/discover, a _meta envelope on every request, what Claude sends first) and the 2025
  // initialize handshake as a stateless fallback. toNodeHandler adapts its fetch API to Express.
  const mcp = toNodeHandler(
    createMcpHandler(
      ({ requestInfo }) => {
        // Behind a tunnel or proxy, the public origin is not localhost. Derive it per request
        // so the CSP we declare matches the URL the host actually used.
        const h = requestInfo?.headers;
        const proto = (h?.get("x-forwarded-proto") ?? (requestInfo ? new URL(requestInfo.url).protocol.replace(":", "") : "http")).split(",")[0].trim();
        const host = h?.get("x-forwarded-host") ?? h?.get("host") ?? `localhost:${PORT}`;
        return createServer({ publicUrl: process.env.PUBLIC_URL ?? `${proto}://${host}` });
      },
      { onerror: (err) => console.error("[mcp]", err.message) },
    ),
  );
  app.all("/mcp", (req: Request, res: Response) => mcp(req, res, req.body));

  app.get("/", (_req, res) => res.type("text").send("Sunset Shack MCP server. Point your MCP client at /mcp"));

  app.listen(PORT, () => {
    console.log(`[mcp] listening on http://localhost:${PORT}/mcp`);
    console.log(`[mcp] for Claude / ChatGPT: npm run tunnel, then add <tunnel-url>/mcp as a connector`);
  });
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
