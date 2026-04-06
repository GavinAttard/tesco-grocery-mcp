import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { setCredentials, checkTokenExpiry } from "../client.js";
import { toolErrorResponse, type AuthResult } from "../types.js";

export function registerAuthTools(server: McpServer): void {
  server.tool(
    "set_auth_token",
    "Update the bearer token and customer UUID. Called after extracting credentials from the browser.",
    {
      token: z.string().describe("Bearer token (e.g. 'Bearer eyJ...')"),
      customerUuid: z.string().describe("Customer UUID from the authenticated session"),
    },
    async (args) => {
      try {
        setCredentials(args.token, args.customerUuid);
        const { expiresAt } = checkTokenExpiry();

        const result: AuthResult = {
          success: true,
          expiresAt: expiresAt!,
          customerUuid: args.customerUuid,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );
}
