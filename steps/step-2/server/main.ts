// Streamable HTTP entry point. Stateless: a fresh McpServer per request, which
// is how the 2026 spec and both big hosts want you to think about it anyway.
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
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

  app.all("/mcp", async (req: Request, res: Response) => {
    const server = createServer();
    const transport = new NodeStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      // Plain JSON responses instead of SSE streams: survives quick tunnels and proxies that buffer SSE.
      enableJsonResponse: true,
    });
    res.on("close", () => {
      transport.close().catch(() => {});
      server.close().catch(() => {});
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error("[mcp] error", err);
      if (!res.headersSent) res.status(500).json({ jsonrpc: "2.0", error: { code: -32603, message: "Internal error" }, id: null });
    }
  });

  app.get("/", (_req, res) => res.type("text").send("Sunset Shack MCP server. Point your MCP client at /mcp"));

  app.listen(PORT, () => console.log(`[mcp] listening on http://localhost:${PORT}/mcp`));
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
