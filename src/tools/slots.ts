import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sendOperation, sendOperations, requireAuth, setOrderId, extractOrderId } from "../client.js";
import { buildOperation } from "../queries.js";
import {
  flattenDeliverySlots,
  flattenAvailableWeeks,
  flattenCurrentSlot,
  flattenSlotBooking,
} from "../transform.js";
import { cache, WEEKS_TTL } from "../cache.js";
import { TescoError, toolErrorResponse, type AvailableWeek } from "../types.js";

function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().split("T")[0];
}

export function registerSlotTools(server: McpServer): void {
  // ─── get_delivery_slots ──────────────────────────────────────────────────

  server.tool(
    "get_delivery_slots",
    "View available delivery slots for a date range. Returns 1-hour time slots grouped by date, including slot IDs needed for book_delivery_slot.",
    {
      start: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
        .optional()
        .describe("Start date (YYYY-MM-DD, e.g. '2026-04-10'). Defaults to today."),
      end: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
        .optional()
        .describe("End date (YYYY-MM-DD). Defaults to start + 7 days."),
      showUnavailable: z
        .boolean()
        .default(false)
        .optional()
        .describe("Include unavailable slots in results"),
    },
    async (args) => {
      try {
        requireAuth();

        const start = args.start || todayISO();
        const end = args.end || addDays(start, 7);

        const op = buildOperation(
          "DeliverySlots",
          { type: "DELIVERY_VAN", start, end },
          "mfe-slots",
        );
        const response = await sendOperation(op);
        const rawSlots = (response.data?.delivery ?? []) as Array<
          Record<string, unknown>
        >;

        const result = flattenDeliverySlots(
          rawSlots,
          start,
          end,
          args.showUnavailable ?? false,
        );

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );

  // ─── get_available_weeks ─────────────────────────────────────────────────

  server.tool(
    "get_available_weeks",
    "View which weeks have delivery slots available. Returns week start/end dates to use as inputs to get_delivery_slots.",
    {},
    async () => {
      try {
        requireAuth();

        let weeks = cache.get<AvailableWeek[]>("weeks");

        if (!weeks) {
          const op = buildOperation(
            "GetFulfilment",
            { type: "DELIVERY_VAN" },
            "mfe-slots",
          );
          const response = await sendOperation(op);
          const fulfilment = response.data?.fulfilment as
            | Record<string, unknown>
            | undefined;
          const metadata = fulfilment?.metadata as
            | Record<string, unknown>
            | undefined;
          const rawWeeks = (metadata?.availableWeeks ?? []) as Array<
            Record<string, unknown>
          >;
          weeks = flattenAvailableWeeks(rawWeeks);
          cache.set("weeks", weeks, WEEKS_TTL);
        }

        return {
          content: [{ type: "text", text: JSON.stringify({ weeks }, null, 2) }],
        };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );

  // ─── get_current_slot ────────────────────────────────────────────────────

  server.tool(
    "get_current_slot",
    "Check if the user already has a delivery slot booked. Returns slot details (date, time, charge, expiry) or hasSlot: false.",
    {},
    async () => {
      try {
        requireAuth();

        const op = buildOperation("GetBasket", {}, "mfe-basket");
        const response = await sendOperation(op);
        const basketData = response.data?.basket as Record<string, unknown>;

        const oid = extractOrderId(basketData);
        if (oid) setOrderId(oid);

        const result = flattenCurrentSlot(basketData);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );

  // ─── book_delivery_slot ──────────────────────────────────────────────────

  server.tool(
    "book_delivery_slot",
    "Book or unbook a delivery slot. Requires a slotId from get_delivery_slots. IMPORTANT: Always confirm with the user before booking.",
    {
      slotId: z.string().describe("Slot ID from get_delivery_slots results"),
      action: z
        .enum(["BOOK", "UNBOOK"])
        .default("BOOK")
        .optional()
        .describe("BOOK to reserve a slot, UNBOOK to release it"),
    },
    async (args) => {
      try {
        requireAuth();

        const action = args.action ?? "BOOK";

        const fulfilmentOp = buildOperation(
          "Fulfilment",
          { slotId: args.slotId, action },
          "mfe-slots",
        );
        const basketOp = buildOperation("GetBasket", {}, "mfe-basket");

        const results = await sendOperations([fulfilmentOp, basketOp]);
        const fulfilmentData = results[0].data?.fulfilment as Record<string, unknown>;
        const basketData = results[1].data?.basket as Record<string, unknown>;

        const oid = extractOrderId(basketData);
        if (oid) setOrderId(oid);

        // Check for GraphQL errors in the fulfilment response
        if (results[0].errors && results[0].errors.length > 0) {
          const msg = results[0].errors.map((e) => e.message).join("; ");
          throw new TescoError("API_ERROR", `Slot booking failed: ${msg}`);
        }

        const result = flattenSlotBooking(fulfilmentData, basketData, action);

        return {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        };
      } catch (e) {
        return toolErrorResponse(e);
      }
    },
  );
}
