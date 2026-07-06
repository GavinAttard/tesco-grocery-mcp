#!/usr/bin/env node
/**
 * Interactive login helper.
 *
 * Opens a real browser window at Tesco groceries. You log in normally — Tesco's
 * bot protection sees a genuine human session, so there's no lockout. As soon as
 * you're logged in and browsing, this script captures the bearer token and
 * customer UUID directly from Tesco's own API requests (no DevTools, no guessing
 * header names) and writes them into the MCP config via setCredentials().
 *
 * The browser profile is persisted, so on future runs you'll usually already be
 * logged in and this finishes in a second. Run with:  npm run login
 */
import { chromium, type BrowserContext } from "playwright";
import { join } from "node:path";
import { homedir } from "node:os";
import { setCredentials, checkTokenExpiry } from "../src/client.js";

const GROCERIES_URL = "https://www.tesco.com/groceries/";
const API_HOST = "xapi.tesco.com";
const CAPTURE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes to complete login

function getConfigDir(): string {
  const appName = "tesco-grocery-mcp";
  if (process.platform === "win32") {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), appName);
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), appName);
}

/** A captured Tesco API request must carry a bearer token AND a customer UUID. */
function extractCreds(
  headers: Record<string, string>,
): { token: string; uuid: string } | undefined {
  const auth = headers["authorization"];
  // Tesco's browser sends the customer id as x-customer-uuid; accept either form.
  const uuid = headers["x-customer-uuid"] ?? headers["customer-uuid"];
  if (!auth || !auth.toLowerCase().startsWith("bearer ") || !uuid) return undefined;
  return { token: auth, uuid };
}

async function main(): Promise<void> {
  const profileDir = join(getConfigDir(), "browser-profile");
  console.error("[login] Launching browser…");
  console.error(`[login] Profile: ${profileDir}`);

  const context: BrowserContext = await chromium.launchPersistentContext(profileDir, {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  });

  let done = false;
  const captured = await new Promise<{ token: string; uuid: string }>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (!done) reject(new Error("Timed out waiting for login (5 min)."));
    }, CAPTURE_TIMEOUT_MS);

    context.on("request", (request) => {
      if (done) return;
      if (!request.url().includes(API_HOST)) return;
      const creds = extractCreds(request.headers());
      if (!creds) return;
      done = true;
      clearTimeout(timer);
      resolve(creds);
    });

    const page = context.pages()[0] ?? context.newPage();
    Promise.resolve(page)
      .then((p) => p.goto(GROCERIES_URL, { waitUntil: "domcontentloaded" }))
      .then(() => {
        console.error("");
        console.error("  ┌────────────────────────────────────────────────────┐");
        console.error("  │  Log in to Tesco in the browser window that opened.  │");
        console.error("  │  Once you're on the groceries page, this will finish │");
        console.error("  │  automatically. You can then close the window.       │");
        console.error("  └────────────────────────────────────────────────────┘");
        console.error("");
      })
      .catch(reject);
  }).finally(async () => {
    await context.close().catch(() => {});
  });

  setCredentials(captured.token, captured.uuid);
  const { valid, expiresAt } = checkTokenExpiry();
  console.error("");
  console.error("[login] ✓ Credentials captured and saved.");
  console.error(`[login]   Customer UUID: ${captured.uuid}`);
  console.error(`[login]   Token ${valid ? "valid" : "EXPIRED"} — expires ${expiresAt ?? "unknown"}`);
  console.error("[login] You're ready to shop. The MCP will use these automatically.");
}

main().catch((err) => {
  console.error(`[login] ✗ ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
