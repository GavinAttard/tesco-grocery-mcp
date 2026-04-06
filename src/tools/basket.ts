import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendOperation, sendOperations, requireAuth, getOrderId, setOrderId, extractOrderId } from "../client.js";
import { buildOperation } from "../queries.js";
import { flattenBasket, flattenBasketUpdate } from "../transform.js";
import { TescoError, toolErrorResponse } from "../types.js";

export function registerBasketTools(server: McpServer): void {
  // ─── get_basket ─────────────────────────────────────────────────────────────

  server.tool(
    "get_basket",
    "Get the current basket contents.",
    {},
    async () => {
      try {
        requireAuth();

        const op = buildOperation("GetBasket", {}, "mfe-basket");
        const response = await sendOperation(op);
        const basketData = response.data?.basket as Record<string, unknown>;

        const oid = extractOrderId(basketData);
        if (oid) setOrderId(oid);

        const result = flattenBasket(basketData);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );

  // ─── add_to_basket ──────────────────────────────────────────────────────────

  server.tool(
    "add_to_basket",
    "Add one or more products to the basket, or change their quantity.",
    {
      items: z
        .array(
          z.object({
            id: z.string().describe("Product ID"),
            quantity: z.number().int().min(0).describe("Desired quantity (0 to remove)"),
          }),
        )
        .min(1)
        .describe("Products to add/update"),
    },
    async (args) => {
      try {
        requireAuth();

        let orderId = getOrderId();

        if (!orderId) {
          const basketOp = buildOperation("GetBasket", {}, "mfe-basket");
          const basketRes = await sendOperation(basketOp);
          const basketData = basketRes.data?.basket as Record<string, unknown>;
          orderId = extractOrderId(basketData);
          if (orderId) setOrderId(orderId);
        }

        if (!orderId) {
          throw new TescoError("API_ERROR", "Could not determine basket order ID");
        }

        const updateOp = buildOperation(
          "UpdateBasket",
          {
            orderId,
            items: args.items.map((item) => ({
              adjustment: false,
              id: item.id,
              newValue: item.quantity,
              newUnitChoice: "pcs",
            })),
          },
          "mfe-basket",
        );
        const basketOp = buildOperation("GetBasket", {}, "mfe-basket");

        const results = await sendOperations([updateOp, basketOp]);
        const updateData = results[0].data?.basket as Record<string, unknown>;
        const basketData = results[1].data?.basket as Record<string, unknown>;

        const oid2 = extractOrderId(basketData);
        if (oid2) setOrderId(oid2);

        const result = flattenBasketUpdate(updateData, basketData);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );

  // ─── remove_from_basket ─────────────────────────────────────────────────────

  server.tool(
    "remove_from_basket",
    "Remove one or more products from the basket.",
    {
      ids: z.array(z.string()).min(1).describe("Product IDs to remove"),
    },
    async (args) => {
      try {
        requireAuth();

        let orderId = getOrderId();

        if (!orderId) {
          const basketOp = buildOperation("GetBasket", {}, "mfe-basket");
          const basketRes = await sendOperation(basketOp);
          const basketData = basketRes.data?.basket as Record<string, unknown>;
          orderId = extractOrderId(basketData);
          if (orderId) setOrderId(orderId);
        }

        if (!orderId) {
          throw new TescoError("API_ERROR", "Could not determine basket order ID");
        }

        const updateOp = buildOperation(
          "UpdateBasket",
          {
            orderId,
            items: args.ids.map((id) => ({
              adjustment: false,
              id,
              newValue: 0,
              newUnitChoice: "pcs",
            })),
          },
          "mfe-basket",
        );
        const basketOp = buildOperation("GetBasket", {}, "mfe-basket");

        const results = await sendOperations([updateOp, basketOp]);
        const updateData = results[0].data?.basket as Record<string, unknown>;
        const basketData = results[1].data?.basket as Record<string, unknown>;

        const oid3 = extractOrderId(basketData);
        if (oid3) setOrderId(oid3);

        const result = flattenBasketUpdate(updateData, basketData);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );
}
