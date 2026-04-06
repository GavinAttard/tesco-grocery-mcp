import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendOperation, requireAuth } from "../client.js";
import { buildOperation } from "../queries.js";
import { flattenCategories, flattenOrder, flattenProducts } from "../transform.js";
import { cache, TAXONOMY_TTL, FAVOURITES_TTL, ORDERS_TTL } from "../cache.js";
import { toolErrorResponse, type Category, type Order, type ProductList } from "../types.js";

export function registerBrowseTools(server: McpServer): void {
  // ─── browse_categories ──────────────────────────────────────────────────────

  server.tool(
    "browse_categories",
    "Get the department/aisle/shelf taxonomy tree.",
    {
      department: z.string().optional().describe("Filter to a specific department name"),
      depth: z
        .number()
        .int()
        .min(1)
        .max(3)
        .default(2)
        .optional()
        .describe("Tree depth: 1=departments, 2=+aisles, 3=+shelves"),
    },
    async (args) => {
      try {
        let rawCategories = cache.get<Array<Record<string, unknown>>>("taxonomy");

        if (!rawCategories) {
          const op = buildOperation(
            "Taxonomy",
            {
              includeChildren: true,
              usePageType: true,
              includeInspirationEvents: true,
              configs: [],
            },
            "mfe-header",
          );
          const response = await sendOperation(op, { authenticated: false });
          rawCategories = response.data?.taxonomy as Array<Record<string, unknown>>;
          cache.set("taxonomy", rawCategories, TAXONOMY_TTL);
        }

        const categories = flattenCategories(rawCategories, {
          department: args.department,
          depth: args.depth,
        });

        return {
          content: [{ type: "text", text: JSON.stringify({ categories }, null, 2) }],
        };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );

  // ─── get_favourites ─────────────────────────────────────────────────────────

  server.tool(
    "get_favourites",
    "Get the user's favourite products.",
    {
      count: z
        .number()
        .int()
        .min(1)
        .max(48)
        .default(24)
        .optional()
        .describe("Number of favourites to return"),
    },
    async (args) => {
      try {
        requireAuth();

        let products = cache.get<Array<Record<string, unknown>>>("favourites");

        if (!products) {
          const op = buildOperation("GetFavouritesCarousel", {}, "mfe-favourites");
          const response = await sendOperation(op);
          const favourites = response.data?.favourites as Record<string, unknown> | undefined;
          products = (favourites?.products ?? []) as Array<Record<string, unknown>>;
          cache.set("favourites", products, FAVOURITES_TTL);
        }

        const count = args.count ?? 24;
        const slicedProducts = products.slice(0, count);

        const result: ProductList = {
          totalCount: products.length,
          page: 1,
          pageSize: count,
          products: flattenProducts(slicedProducts),
        };

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );

  // ─── get_order_history ──────────────────────────────────────────────────────

  server.tool(
    "get_order_history",
    "Get previous orders.",
    {},
    async () => {
      try {
        requireAuth();

        let orders = cache.get<Order[]>("orders");

        if (!orders) {
          const op = buildOperation("GetAllOrders", {}, "mfe-orders");
          const response = await sendOperation(op);
          const rawOrders = response.data?.orders as Array<Record<string, unknown>>;
          orders = rawOrders.map(flattenOrder);
          cache.set("orders", orders, ORDERS_TTL);
        }

        return {
          content: [{ type: "text", text: JSON.stringify({ orders }, null, 2) }],
        };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );
}
