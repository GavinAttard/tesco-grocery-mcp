import { join } from "node:path";
import { homedir } from "node:os";
import { execFileSync } from "node:child_process";

/**
 * Browser-driven credential capture.
 *
 * Opens a real browser window at Tesco groceries so the user can log in
 * normally (Tesco's bot protection blocks headless/scripted logins, so a real
 * window is required). As soon as the user is logged in and browsing, the
 * bearer token and customer UUID are read straight from Tesco's own API
 * requests — no DevTools, no cookie decryption, no guessing header names.
 *
 * The browser profile is persisted under the config dir, so repeat logins
 * usually need no re-typing — the window opens already signed in and closes in
 * a second.
 *
 * Playwright is imported dynamically so the core server has no hard dependency
 * on it; if it (or its browser) is missing, a clear, actionable error is thrown.
 */

export interface CapturedCredentials {
  token: string;
  uuid: string;
}

const API_HOST = "xapi.tesco.com";
const GROCERIES_URL = "https://www.tesco.com/groceries/";
const DEFAULT_TIMEOUT_MS = 5 * 60 * 1000;

function getConfigDir(): string {
  const appName = "tesco-grocery-mcp";
  if (process.platform === "win32") {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), appName);
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), appName);
}

/**
 * Best-effort read of the OS default browser, mapped to a Playwright channel.
 * Returns "chrome" or "msedge" when the default is a browser Playwright can
 * instrument; undefined otherwise (→ bundled Chromium). Safari/Firefox can't be
 * used for token capture, so they fall through to the Chromium fallbacks.
 */
function detectDefaultChannel(): string | undefined {
  try {
    if (process.platform === "darwin") {
      const plist = join(
        homedir(),
        "Library/Preferences/com.apple.LaunchServices/com.apple.launchservices.secure.plist",
      );
      const json = execFileSync("plutil", ["-convert", "json", "-o", "-", plist], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const handlers = (JSON.parse(json).LSHandlers ?? []) as Array<Record<string, string>>;
      const https = handlers.find((h) => h.LSHandlerURLScheme === "https");
      const id = (https?.LSHandlerRoleAll ?? "").toLowerCase();
      if (id.includes("chrome")) return "chrome";
      if (id.includes("edge")) return "msedge";
    } else if (process.platform === "win32") {
      const out = execFileSync(
        "reg",
        [
          "query",
          "HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice",
          "/v",
          "ProgId",
        ],
        { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
      ).toLowerCase();
      if (out.includes("chrome")) return "chrome";
      if (out.includes("edge") || out.includes("msedge")) return "msedge";
    }
  } catch {
    /* detection is best-effort; fall back below */
  }
  return undefined;
}

/** Ordered, de-duplicated list of channels to try (undefined = bundled Chromium). */
function candidateChannels(): Array<string | undefined> {
  const list: Array<string | undefined> = [];
  const env = process.env.TESCO_BROWSER_CHANNEL;
  if (env) list.push(env === "chromium" ? undefined : env);
  list.push(detectDefaultChannel());
  list.push("chrome", "msedge", undefined); // fallbacks: Chrome → Edge → bundled
  const seen = new Set<string>();
  return list.filter((c) => {
    const key = c ?? "__chromium__";
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function extractCreds(headers: Record<string, string>): CapturedCredentials | undefined {
  const auth = headers["authorization"];
  const uuid = headers["x-customer-uuid"] ?? headers["customer-uuid"];
  if (!auth || !auth.toLowerCase().startsWith("bearer ") || !uuid) return undefined;
  return { token: auth, uuid };
}

export async function captureCredentialsViaBrowser(opts?: {
  timeoutMs?: number;
  /** Called once the browser window is open and pointed at Tesco. */
  onReady?: () => void;
}): Promise<CapturedCredentials> {
  let chromium: typeof import("playwright").chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    throw new Error(
      "Browser login needs Playwright, which isn't installed. Run: npm install playwright && npx playwright install chromium",
    );
  }

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const baseOpts = {
    headless: false,
    viewport: { width: 1280, height: 900 },
    args: ["--disable-blink-features=AutomationControlled"],
  };

  // Open in the user's default browser when it's a Chromium-family one we can
  // instrument (Chrome/Edge); otherwise fall back to bundled Chromium. Each
  // channel keeps its own persisted profile so sessions don't clash.
  let context: Awaited<ReturnType<typeof chromium.launchPersistentContext>> | undefined;
  let lastErr: unknown;
  for (const channel of candidateChannels()) {
    const profileDir = join(getConfigDir(), `browser-profile${channel ? `-${channel}` : ""}`);
    try {
      context = await chromium.launchPersistentContext(
        profileDir,
        channel ? { ...baseOpts, channel } : baseOpts,
      );
      break;
    } catch (e) {
      lastErr = e;
    }
  }
  if (!context) {
    throw new Error(
      `Couldn't launch a browser (${lastErr instanceof Error ? lastErr.message : String(lastErr)}). ` +
        "Install one with: npx playwright install chromium",
    );
  }

  let done = false;
  try {
    return await new Promise<CapturedCredentials>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (!done) reject(new Error(`Timed out after ${Math.round(timeoutMs / 60000)} min waiting for login.`));
      }, timeoutMs);

      context.on("request", (request) => {
        if (done || !request.url().includes(API_HOST)) return;
        const creds = extractCreds(request.headers());
        if (!creds) return;
        done = true;
        clearTimeout(timer);
        resolve(creds);
      });

      const page = context.pages()[0] ?? context.newPage();
      Promise.resolve(page)
        .then((p) => p.goto(GROCERIES_URL, { waitUntil: "domcontentloaded" }))
        .then(() => opts?.onReady?.())
        .catch(reject);
    });
  } finally {
    await context.close().catch(() => {});
  }
}
