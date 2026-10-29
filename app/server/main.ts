// Streamable HTTP entry point. Stateless: a fresh McpServer per request, which is how the
// 2026-07-28 spec works. createMcpHandler serves that era and still answers 2025 clients.
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { toNodeHandler } from "@modelcontextprotocol/node";
import { createMcpHandler } from "@modelcontextprotocol/server";
import { StdioServerTransport } from "@modelcontextprotocol/server/stdio";
import cors from "cors";
import type { Request, Response } from "express";
import { createServer } from "./server.js";

const PORT = Number(process.env.PORT ?? 3001);

const main = async () => {
  if (process.argv.includes("--stdio")) {
    await createServer().connect(new StdioServerTransport());
    return;
  }

  const app = createMcpExpressApp({ host: "0.0.0.0" });
  app.use(cors());

  // createMcpHandler answers both protocol eras with a fresh McpServer per request: 2026-07-28
  // (server/discover, a _meta envelope on every request, what Claude sends first) and the 2025
  // initialize handshake as a stateless fallback. toNodeHandler adapts its fetch API to Express.
  const mcp = toNodeHandler(createMcpHandler(() => createServer(), { onerror: (err) => console.error("[mcp]", err.message) }));
  app.all("/mcp", (req: Request, res: Response) => mcp(req, res, req.body));

  app.get("/", (_req, res) => res.type("text").send("Sunset Shack MCP server. Point your MCP client at /mcp"));

  app.listen(PORT, () => console.log(`[mcp] listening on http://localhost:${PORT}/mcp`));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
