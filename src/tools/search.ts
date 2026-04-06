import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendOperation, sendOperations } from "../client.js";
import { buildOperation } from "../queries.js";
import { flattenProducts } from "../transform.js";
import { toolErrorResponse, type ProductList } from "../types.js";

// ─── Shared Helpers ─────────────────────────────────────────────────────────

function buildSearchVariables(
  query: string,
  page: number,
  count: number,
  sort: string,
): Record<string, unknown> {
  return {
    query,
    page,
    count,
    sortBy: sort,
    includeRestrictions: true,
    includeVariations: true,
    showDepositReturnCharge: false,
    showPopularFilter: true,
    showExpandedResults: false,
    includeRangeFilter: false,
    showSuggestedSearch: false,
    includeAdditionalInfo: true,
    includeIsInAnyList: true,
    filterCriteria: [{ name: "inputType", values: ["free text"] }],
    appliedFacetArgs: [],
    configs: [],
    suggestionsMaxTimeOut: 600,
  };
}

// ─── Registration ───────────────────────────────────────────────────────────

export function registerSearchTools(server: McpServer): void {
  // ── search_products ─────────────────────────────────────────────────────

  server.tool(
    "search_products",
    "Search for grocery products. Pass an array of queries to run many searches in one call — use this to fan out a shopping list without spending multiple turns.",
    {
      queries: z
        .array(
          z.object({
            query: z.string().min(1).describe("Search query text"),
            page: z.number().int().min(1).default(1).optional().describe("Page number"),
            count: z
              .number()
              .int()
              .min(1)
              .max(24)
              .default(12)
              .optional()
              .describe("Results per page (max 24)"),
            sort: z
              .enum(["relevance", "price-ascending", "price-descending"])
              .default("relevance")
              .optional()
              .describe("Sort order"),
          }),
        )
        .min(1)
        .max(10)
        .describe(
          "Up to 10 searches executed in a single batched HTTP request. Pass one entry per item on the shopping list. If you have more than 10 items, split them across multiple tool calls.",
        ),
    },
    async (args) => {
      try {
        const normalised = args.queries.map((q) => ({
          query: q.query,
          page: q.page ?? 1,
          count: q.count ?? 12,
          sort: q.sort ?? "relevance",
        }));

        const ops = normalised.map((q) =>
          buildOperation(
            "Search",
            buildSearchVariables(q.query, q.page, q.count, q.sort),
            "mfe-plp",
          ),
        );

        const responses = await sendOperations(ops, { authenticated: false });

        type QueryResult = {
          query: string;
          index: number;
          ok: boolean;
          productList?: ProductList;
          error?: { code: string; message: string };
        };

        const results: QueryResult[] = responses.map((response, index) => {
          const input = normalised[index];
          const search = response.data?.search as Record<string, unknown> | undefined;

          if (response.errors?.length || !search) {
            const message =
              response.errors?.[0]?.message ?? "Search returned no data";
            return {
              query: input.query,
              index,
              ok: false,
              error: { code: "SEARCH_FAILED", message },
            };
          }

          const pageInformation = search.pageInformation as
            | Record<string, unknown>
            | undefined;
          const hits = (search.results ?? []) as Array<Record<string, unknown>>;
          const products = flattenProducts(hits);

          const productList: ProductList = {
            totalCount:
              typeof pageInformation?.totalCount === "number"
                ? pageInformation.totalCount
                : products.length,
            page: input.page,
            pageSize: input.count,
            products,
          };

          return { query: input.query, index, ok: true, productList };
        });

        const succeeded = results.filter((r) => r.ok).length;
        const envelope = {
          results,
          summary: {
            total: results.length,
            succeeded,
            failed: results.length - succeeded,
          },
        };

        return { content: [{ type: "text", text: JSON.stringify(envelope, null, 2) }] };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );

  // ── get_product_details ─────────────────────────────────────────────────

  server.tool(
    "get_product_details",
    "Get detailed information for a single product by ID.",
    {
      id: z.string().describe("Product ID from search results"),
    },
    async (args) => {
      try {
        const op = buildOperation(
          "Search",
          buildSearchVariables(args.id, 1, 1, "relevance"),
          "mfe-plp",
        );

        const response = await sendOperation(op, { authenticated: false });

        const search = response.data?.search as Record<string, unknown> | undefined;
        const results = (search?.results ?? []) as Array<Record<string, unknown>>;

        const products = flattenProducts(results);

        if (products.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  error: "PRODUCT_NOT_FOUND",
                  message: `No product found with ID ${args.id}`,
                }),
              },
            ],
            isError: true,
          };
        }

        return { content: [{ type: "text", text: JSON.stringify(products[0], null, 2) }] };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );

  // ── get_offers ──────────────────────────────────────────────────────────

  server.tool(
    "get_offers",
    "Search for products currently on promotion or Clubcard price.",
    {
      query: z.string().default("").optional().describe("Filter offers by search term"),
      clubcardOnly: z.boolean().default(false).optional().describe("Only show Clubcard prices"),
    },
    async (args) => {
      try {
        const searchQuery = args.query || "offers";
        const op = buildOperation(
          "Search",
          buildSearchVariables(searchQuery, 1, 48, "relevance"),
          "mfe-plp",
        );

        const response = await sendOperation(op, { authenticated: false });

        const search = response.data?.search as Record<string, unknown> | undefined;
        const results = (search?.results ?? []) as Array<Record<string, unknown>>;

        let products = flattenProducts(results);

        // Filter to promoted products only
        products = products.filter((p) => p.promotion !== null);

        // Optionally filter to Clubcard-only deals
        if (args.clubcardOnly) {
          products = products.filter((p) => p.promotion?.clubcardOnly === true);
        }

        const result: ProductList = {
          totalCount: products.length,
          page: 1,
          pageSize: 48,
          products,
        };

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );

  // ── get_substitutions ──────────────────────────────────────────────────

  server.tool(
    "get_substitutions",
    "Find alternative products for substitution. Searches for similar products, filtering to only those available for sale. Use when a basket item is unavailable (isForSale: false).",
    {
      query: z.string().describe("Search terms for alternatives (e.g. the product title or key words like 'semi skimmed milk 4 pints')"),
      excludeId: z
        .string()
        .optional()
        .describe("Product ID to exclude from results (the unavailable product)"),
      count: z
        .number()
        .int()
        .min(1)
        .max(24)
        .default(8)
        .optional()
        .describe("Number of suggestions to return"),
    },
    async (args) => {
      try {
        const count = args.count ?? 8;

        const op = buildOperation(
          "Search",
          buildSearchVariables(args.query, 1, count, "relevance"),
          "mfe-plp",
        );

        const response = await sendOperation(op, { authenticated: false });

        const search = response.data?.search as Record<string, unknown> | undefined;
        const results = (search?.results ?? []) as Array<Record<string, unknown>>;

        let products = flattenProducts(results);

        // Filter to available products only
        products = products.filter((p) => p.isForSale);

        // Exclude the original product if specified
        if (args.excludeId) {
          products = products.filter((p) => p.id !== args.excludeId);
        }

        const result: ProductList = {
          totalCount: products.length,
          page: 1,
          pageSize: count,
          products,
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
