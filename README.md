# tesco-grocery-mcp

An [MCP](https://modelcontextprotocol.io) server that wraps Tesco's grocery APIs, letting AI assistants like Claude search products, manage your basket, and book delivery slots.

## Tools

### Authentication

| Tool | Description |
|------|-------------|
| `login` | Open a browser to log in to Tesco and auto-capture credentials (no DevTools). Also runs automatically when a token is missing or expired. |
| `set_auth_token` | Manually set bearer token and customer UUID (advanced/fallback) |

### Search & Browse

| Tool | Description |
|------|-------------|
| `search_products` | Search for grocery products (supports batched multi-query) |
| `get_product_details` | Get detailed info for a specific product |
| `get_offers` | Find products on promotion or Clubcard price |
| `get_substitutions` | Find alternatives for unavailable products |
| `browse_categories` | Get the department/aisle/shelf taxonomy tree |
| `get_favourites` | Get your favourite products |
| `get_order_history` | Get previous orders |

### Basket

| Tool | Description |
|------|-------------|
| `get_basket` | View current basket contents |
| `add_to_basket` | Add products or change quantities |
| `remove_from_basket` | Remove products from basket |

### Delivery Slots

| Tool | Description |
|------|-------------|
| `get_delivery_slots` | View available delivery slots for a date range |
| `get_available_weeks` | See which weeks have delivery slots |
| `get_current_slot` | Check if you have a slot booked |
| `book_delivery_slot` | Book or unbook a delivery slot |

## Prerequisites

- Node.js >= 18
- A Tesco.com account with an active grocery session

## Installation

### Via npx (recommended)

No installation needed — just configure your MCP client (see below).

### Global install

```bash
npm install -g tesco-grocery-mcp
```

### From source

```bash
git clone https://github.com/GavinAttard/tesco-grocery-mcp.git
cd tesco-grocery-mcp
npm install
npm run build
```

## Configuration

### Claude Desktop

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "tesco-grocery": {
      "command": "npx",
      "args": ["-y", "tesco-grocery-mcp"]
    }
  }
}
```

### Claude Code

```bash
claude mcp add tesco-grocery -- npx -y tesco-grocery-mcp
```

### Other MCP clients

Run the server on stdio:

```bash
npx -y tesco-grocery-mcp
```

Or if installed globally:

```bash
tesco-grocery
```

## Authentication

The server needs a bearer token from an active Tesco.com session. Tesco runs bot
protection on its login page, so the login itself must be done by a human in a real
browser — but everything else, including grabbing the token, is automated. There's
nothing to copy and no DevTools.

### It just prompts you when needed

You don't have to do anything up front. The first time an action needs
authentication (or when your token expires ~60 minutes after issue), the server
**automatically opens a browser window** at Tesco. Log in normally; as soon as you're
on the groceries page it captures the bearer token and customer UUID straight from
Tesco's own API requests, saves them, and continues with what you asked for.

- **Default browser:** the window opens in your default browser when that's a
  Chromium-family browser Playwright can instrument (Google Chrome or Microsoft Edge);
  otherwise it falls back to bundled Chromium. Safari and Firefox can't be used for
  capture. Force a choice with `TESCO_BROWSER_CHANNEL=chrome|msedge|chromium`.
- **Persisted session:** the browser profile is saved, so repeat logins usually need
  no re-typing — the window opens already signed in and closes in a second.
- **Explicit `login` tool:** you can also just ask to "log in to Tesco" to trigger it
  on demand.
- **Disable auto-login:** set `TESCO_AUTO_LOGIN=0` (e.g. for headless/CI) to get a
  `TOKEN_EXPIRED` error instead of a browser window.

> Requires a browser. Chrome/Edge are used if present; otherwise install the bundled
> one once with `npx playwright install chromium`.

### From a source checkout

If you're running from a clone, you can also trigger the same login from the terminal:

```bash
npm run login
```

### Manual fallback

If you'd rather set credentials by hand:

1. Log in to [tesco.com/groceries](https://www.tesco.com/groceries/) in your browser
2. Open DevTools (F12) → Network tab
3. Find any request to `xapi.tesco.com` and copy the `Authorization` header value and `x-customer-uuid` header value OR copy values from the oAUTH.ACCESSTOKEN and UUID cookies
4. Use the `set_auth_token` tool to provide these credentials

Credentials are persisted locally, so you only need to re-auth when your session
expires. See [`.env.example`](.env.example) for the credential format.

## Shopping Skill

The [`skills/SKILL.md`](skills/SKILL.md) file contains an optimised execution guide that teaches AI assistants how to efficiently handle a full weekly grocery shop — from searching to basket management to delivery slot booking. You can use it as a system prompt or reference for your own workflows.

## License

[MIT](LICENSE)
