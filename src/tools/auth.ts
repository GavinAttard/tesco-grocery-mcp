import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { setCredentials, checkTokenExpiry } from "../client.js";
import { captureCredentialsViaBrowser } from "../browser-login.js";
import { toolErrorResponse, type AuthResult } from "../types.js";

export function registerAuthTools(server: McpServer): void {
  server.tool(
    "login",
    "Open a browser window so the user can log in to Tesco, then automatically capture and save their credentials. Use this whenever authentication is needed or the token has expired — no terminal or DevTools required. The call blocks until the user finishes logging in (up to 5 minutes); tell the user to complete the login in the browser window that opens.",
    {},
    async () => {
      try {
        const { token, uuid } = await captureCredentialsViaBrowser();
        setCredentials(token, uuid);
        const { expiresAt } = checkTokenExpiry();

        const result: AuthResult = {
          success: true,
          expiresAt: expiresAt!,
          customerUuid: uuid,
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );

  server.tool(
    "set_auth_token",
    "Manually set the bearer token and customer UUID (advanced/fallback). Prefer the `login` tool, which captures these automatically.",
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
