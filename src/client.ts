import { readFileSync, writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { TescoError, type GraphQLOperation, type GraphQLResponse } from "./types.js";

// ─── Config Directory Resolution ────────────────────────────────────────────

function getConfigDir(): string {
  const appName = "tesco-grocery-mcp";
  if (process.platform === "win32") {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), appName);
  }
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), ".config"), appName);
}

function getEnvPath(): string {
  if (process.env.TESCO_ENV_PATH) return process.env.TESCO_ENV_PATH;
  return join(getConfigDir(), ".env");
}

const ENV_PATH = getEnvPath();

const ENDPOINT = "https://xapi.tesco.com/";
// Tesco's public API key — not a secret; required for all xapi.tesco.com requests
const API_KEY = "TvOSZJHlEk0pjniDGQFAc9Q59WGAR4dA";

// ─── Mutable Auth State ──────────────────────────────────────────────────────

let bearerToken: string | undefined;
let customerUuid: string | undefined;
let cachedOrderId: string | undefined;

// ─── .env Management ─────────────────────────────────────────────────────────

function parseEnv(content: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    env[trimmed.slice(0, eqIdx)] = trimmed.slice(eqIdx + 1);
  }
  return env;
}

/**
 * Load credentials from .env on startup.
 * Does NOT throw if token is missing — the server starts without auth
 * and returns TOKEN_EXPIRED when an authenticated tool is called.
 */
export function loadCredentialsFromEnv(): void {
  console.error(`[tesco] Config: ${ENV_PATH}`);
  if (!existsSync(ENV_PATH)) {
    console.error("[tesco] No .env file found — server starting without credentials");
    return;
  }

  const env = parseEnv(readFileSync(ENV_PATH, "utf8"));
  bearerToken = env.TESCO_BEARER_TOKEN || undefined;
  customerUuid = env.TESCO_CUSTOMER_UUID || undefined;

  if (bearerToken) {
    const expiry = checkTokenExpiry();
    if (!expiry.valid) {
      console.error(`[tesco] Bearer token expired at ${expiry.expiresAt ?? "unknown"}`);
    } else {
      console.error(`[tesco] Bearer token valid until ${expiry.expiresAt}`);
    }
  } else {
    console.error("[tesco] No bearer token in .env — authenticated tools will return TOKEN_EXPIRED");
  }
}

/**
 * Update credentials in memory and persist to .env.
 */
export function setCredentials(token: string, uuid: string): void {
  bearerToken = token;
  customerUuid = uuid;

  // Read existing .env, update or add the relevant keys
  let env: Record<string, string> = {};
  if (existsSync(ENV_PATH)) {
    env = parseEnv(readFileSync(ENV_PATH, "utf8"));
  }
  env.TESCO_BEARER_TOKEN = token;
  env.TESCO_CUSTOMER_UUID = uuid;

  mkdirSync(dirname(ENV_PATH), { recursive: true });

  const content = Object.entries(env)
    .map(([k, v]) => `${k}=${v}`)
    .join("\n");
  writeFileSync(ENV_PATH, content + "\n", "utf8");
  try { chmodSync(ENV_PATH, 0o600); } catch { /* no-op on Windows */ }
}

// ─── JWT Helpers ─────────────────────────────────────────────────────────────

function base64UrlDecode(str: string): string {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4;
  if (pad) base64 += "=".repeat(4 - pad);
  return Buffer.from(base64, "base64").toString("utf8");
}

/**
 * Check if the current bearer token is expired by decoding the JWT exp claim.
 */
export function checkTokenExpiry(): { valid: boolean; expiresAt?: string } {
  if (!bearerToken) return { valid: false };

  try {
    // Strip "Bearer " prefix if present
    const jwt = bearerToken.startsWith("Bearer ")
      ? bearerToken.slice(7)
      : bearerToken;
    const parts = jwt.split(".");
    if (parts.length !== 3) return { valid: false };

    const payload = JSON.parse(base64UrlDecode(parts[1])) as { exp?: number };
    if (!payload.exp) return { valid: false };

    const expiresAt = new Date(payload.exp * 1000).toISOString();
    const valid = payload.exp > Date.now() / 1000;
    return { valid, expiresAt };
  } catch {
    return { valid: false };
  }
}

/**
 * Throw TOKEN_EXPIRED if auth is missing or expired.
 * Call at the top of any tool that requires authentication.
 */
export function requireAuth(): void {
  if (!bearerToken || !customerUuid) {
    throw new TescoError(
      "TOKEN_EXPIRED",
      "No authentication credentials. Use set_auth_token to provide a bearer token and customer UUID.",
    );
  }

  const expiry = checkTokenExpiry();
  if (!expiry.valid) {
    throw new TescoError(
      "TOKEN_EXPIRED",
      `Bearer token expired${expiry.expiresAt ? ` at ${expiry.expiresAt}` : ""}. Use set_auth_token to provide a fresh token.`,
    );
  }
}

// ─── Order ID Cache ──────────────────────────────────────────────────────────

export function getOrderId(): string | undefined {
  return cachedOrderId;
}

export function setOrderId(id: string): void {
  cachedOrderId = id;
}

export function extractOrderId(basketData: Record<string, unknown> | undefined): string | undefined {
  const id = basketData?.id;
  return typeof id === "string" ? id : undefined;
}

// ─── HTTP Client ─────────────────────────────────────────────────────────────

/**
 * Send one or more GraphQL operations to the Tesco API.
 */
export async function sendOperations(
  operations: GraphQLOperation[],
  options?: { authenticated?: boolean },
): Promise<GraphQLResponse[]> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "x-apikey": API_KEY,
    Origin: "https://www.tesco.com",
    Referer: "https://www.tesco.com/groceries/",
    language: "en-GB",
    region: "UK",
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
  };

  if (options?.authenticated !== false && bearerToken) {
    headers["authorization"] = bearerToken;
    if (customerUuid) {
      headers["customer-uuid"] = customerUuid;
    }
  }

  let response: Response;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30_000);
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(operations),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new TescoError("API_ERROR", "Request timed out after 30 seconds");
    }
    console.error("[tesco] Network error:", err);
    throw new TescoError(
      "API_ERROR",
      "Network error contacting Tesco API. Check your connection.",
    );
  } finally {
    clearTimeout(timeoutId);
  }

  // Map HTTP status codes to error types
  if (response.status === 429) {
    const retryAfter = response.headers.get("retry-after");
    throw new TescoError(
      "RATE_LIMITED",
      `Rate limited by Tesco API.${retryAfter ? ` Retry after ${retryAfter}s.` : ""}`,
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new TescoError(
      "TOKEN_EXPIRED",
      "API returned authentication error. Use set_auth_token to provide fresh credentials.",
    );
  }

  if (response.status >= 500) {
    throw new TescoError(
      "API_ERROR",
      `Tesco API returned HTTP ${response.status}`,
    );
  }

  let json: GraphQLResponse[];
  try {
    json = (await response.json()) as GraphQLResponse[];
  } catch {
    throw new TescoError("API_ERROR", "Failed to parse API response as JSON");
  }

  return json;
}

/**
 * Send a single operation and return its response.
 */
export async function sendOperation(
  operation: GraphQLOperation,
  options?: { authenticated?: boolean },
): Promise<GraphQLResponse> {
  const results = await sendOperations([operation], options);
  return results[0];
}
