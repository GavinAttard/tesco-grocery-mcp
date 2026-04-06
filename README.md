# tesco-grocery-mcp

An [MCP](https://modelcontextprotocol.io) server that wraps Tesco's grocery APIs, letting AI assistants like Claude search products, manage your basket, and book delivery slots.

## Tools

### Authentication

| Tool | Description |
|------|-------------|
| `set_auth_token` | Set bearer token and customer UUID from your browser session |

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

The server requires a bearer token from an active Tesco.com session:

1. Log in to [tesco.com/groceries](https://www.tesco.com/groceries/) in your browser
2. Open DevTools (F12) → Network tab
3. Find any request to `xapi.tesco.com` and copy the `Authorization` header value and `x-customer-uuid` header value OR copy values from the oAUTH.ACCESSTOKEN and UUID cookies
4. Use the `set_auth_token` tool to provide these credentials

Credentials are persisted locally so you only need to do this when your session expires.

See [`.env.example`](.env.example) for the credential format.

## Shopping Skill

The [`skills/SKILL.md`](skills/SKILL.md) file contains an optimised execution guide that teaches AI assistants how to efficiently handle a full weekly grocery shop — from searching to basket management to delivery slot booking. You can use it as a system prompt or reference for your own workflows.

## License

[MIT](LICENSE)
