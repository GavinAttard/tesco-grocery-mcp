#!/usr/bin/env node

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadCredentialsFromEnv } from "./client.js";
import { registerAuthTools } from "./tools/auth.js";
import { registerSearchTools } from "./tools/search.js";
import { registerBasketTools } from "./tools/basket.js";
import { registerBrowseTools } from "./tools/browse.js";
import { registerSlotTools } from "./tools/slots.js";

function loadVersion(): string {
  const require = createRequire(import.meta.url);
  // dist/src/index.js → ../../package.json; src/index.ts → ../package.json
  try { return (require("../../package.json") as { version: string }).version; }
  catch { return (require("../package.json") as { version: string }).version; }
}

// Load credentials from .env (non-fatal if missing)
loadCredentialsFromEnv();

// Create MCP server
const server = new McpServer({
  name: "tesco-grocery",
  version: loadVersion(),
});

// Register all tools
registerAuthTools(server);
registerSearchTools(server);
registerBasketTools(server);
registerBrowseTools(server);
registerSlotTools(server);

// Connect via stdio transport
const transport = new StdioServerTransport();
await server.connect(transport);

console.error("[tesco] MCP server running on stdio");
