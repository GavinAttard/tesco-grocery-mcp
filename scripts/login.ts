#!/usr/bin/env node
/**
 * Command-line login helper (from-source convenience).
 *
 * Most users won't need this — the MCP server exposes a `login` tool that does
 * the same thing from inside Claude, with no terminal. This script is a thin
 * wrapper around that shared logic for people running from a clone.
 *
 *   npm run login
 */
import { setCredentials, checkTokenExpiry } from "../src/client.js";
import { captureCredentialsViaBrowser } from "../src/browser-login.js";

async function main(): Promise<void> {
  console.error("[login] Launching browser…");
  const { token, uuid } = await captureCredentialsViaBrowser({
    onReady: () => {
      console.error("");
      console.error("  ┌────────────────────────────────────────────────────┐");
      console.error("  │  Log in to Tesco in the browser window that opened.  │");
      console.error("  │  Once you're on the groceries page, this will finish │");
      console.error("  │  automatically. You can then close the window.       │");
      console.error("  └────────────────────────────────────────────────────┘");
      console.error("");
    },
  });

  setCredentials(token, uuid);
  const { valid, expiresAt } = checkTokenExpiry();
  console.error("[login] ✓ Credentials captured and saved.");
  console.error(`[login]   Customer UUID: ${uuid}`);
  console.error(`[login]   Token ${valid ? "valid" : "EXPIRED"} — expires ${expiresAt ?? "unknown"}`);
  console.error("[login] You're ready to shop.");
}

main().catch((err) => {
  console.error(`[login] ✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
