import type {
  Product,
  Promotion,
  Reviews,
  BasketItem,
  Basket,
  DeliverySlot,
  BasketCharges,
  BasketUpdateItemResult,
  BasketUpdateResult,
  Order,
  OrderSlot,
  OrderItem,
  Category,
  AvailableSlot,
  SlotsByDate,
  DeliverySlotsResult,
  AvailableWeek,
  CurrentSlotResult,
  SlotBookingResult,
} from "./types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Coerce unknown to number. Returns 0 for non-numbers intentionally —
 *  many consumers perform arithmetic on the result without null checks. */
function safeNum(val: unknown): number {
  return typeof val === "number" ? val : 0;
}

function safeStr(val: unknown): string {
  return typeof val === "string" ? val : "";
}

// ─── Product Flattening ──────────────────────────────────────────────────────

/**
 * Flatten a raw search result node into a clean Product.
 * The raw shape nests price/promotions inside sellers.results[0].
 */
export function flattenProduct(node: Record<string, unknown>): Product | null {
  // Skip sponsored/ad items
  if (node.adId) return null;

  const sellers = node.sellers as
    | { results?: Array<Record<string, unknown>> }
    | undefined;
  const seller = sellers?.results?.[0];

  const priceObj = seller?.price as Record<string, unknown> | undefined;
  const promotions = seller?.promotions as
    | Array<Record<string, unknown>>
    | undefined;

  let promotion: Promotion | null = null;
  if (promotions && promotions.length > 0) {
    const promo = promotions[0];
    const attrs = promo.attributes as string[] | undefined;
    const promoPrice = promo.price as Record<string, unknown> | undefined;
    promotion = {
      description: safeStr(promo.description),
      clubcardOnly: attrs?.includes("CLUBCARD_PRICING") ?? false,
      discountedPrice:
        typeof promoPrice?.afterDiscount === "number"
          ? promoPrice.afterDiscount
          : null,
    };
  }

  const reviewsObj = node.reviews as
    | { stats?: Record<string, unknown> }
    | undefined;
  let reviews: Reviews | null = null;
  if (reviewsObj?.stats) {
    const count = reviewsObj.stats.noOfReviews;
    const rating = reviewsObj.stats.overallRating;
    if (typeof count === "number" && typeof rating === "number") {
      reviews = { count, rating };
    }
  }

  return {
    id: safeStr(node.id),
    tpnb: safeStr(node.tpnb),
    title: safeStr(node.title),
    brand: safeStr(node.brandName),
    price: safeNum(priceObj?.price),
    unitPrice: safeNum(priceObj?.unitPrice),
    unitOfMeasure: safeStr(priceObj?.unitOfMeasure),
    isForSale: (seller?.isForSale as boolean) ?? false,
    isInFavourites: (node.isInFavourites as boolean) ?? false,
    imageUrl: safeStr(node.defaultImageUrl),
    department: safeStr(node.departmentName),
    aisle: safeStr(node.aisleName),
    promotion,
    reviews,
  };
}

/**
 * Flatten an array of search result entries, filtering out ads and nulls.
 */
export function flattenProducts(
  results: Array<Record<string, unknown>>,
): Product[] {
  return results
    .map((r) => {
      const node = (r.node ?? r) as Record<string, unknown>;
      return flattenProduct(node);
    })
    .filter((p): p is Product => p !== null);
}

// ─── Basket Flattening ───────────────────────────────────────────────────────

/**
 * Flatten a raw basket item.
 * Note: GetBasket items do NOT include title or unitPrice —
 * only product.id, cost, quantity, unit, weight.
 */
export function flattenBasketItem(item: Record<string, unknown>): BasketItem {
  const product = item.product as Record<string, unknown> | undefined;
  return {
    id: safeStr(product?.id ?? item.id),
    title: safeStr(item.title ?? ""),
    quantity: safeNum(item.quantity),
    cost: safeNum(item.cost),
    unitPrice: typeof item.unitPrice === "number" ? item.unitPrice : null,
    unitOfMeasure:
      typeof item.unitOfMeasure === "string" ? item.unitOfMeasure : null,
    isForSale: (product?.isForSale as boolean) ?? true,
    status: safeStr(product?.status ?? "Unknown"),
  };
}

/**
 * Flatten a raw GetBasket response into a clean Basket.
 */
export function flattenBasket(
  basketData: Record<string, unknown>,
): Basket {
  // Items can be at basket.items or basket.splitView[0].items
  let rawItems = basketData.items as Array<Record<string, unknown>> | undefined;
  let guidePrice = 0;
  let charges: BasketCharges = { delivery: null, minimumBasketCharge: null };

  // Check splitView for richer data (guidePrice, charges)
  const splitView = basketData.splitView as
    | Array<Record<string, unknown>>
    | undefined;
  if (splitView && splitView.length > 0) {
    const sv = splitView[0];
    if (typeof sv.guidePrice === "number") {
      guidePrice = sv.guidePrice;
    }
    if (sv.items && Array.isArray(sv.items) && (sv.items as unknown[]).length > 0) {
      rawItems = sv.items as Array<Record<string, unknown>>;
    }
    const svCharges = sv.charges as Record<string, unknown> | undefined;
    if (svCharges) {
      charges = {
        delivery:
          typeof svCharges.fulfilment === "number"
            ? svCharges.fulfilment
            : null,
        minimumBasketCharge:
          typeof svCharges.minimumValue === "number"
            ? svCharges.minimumValue
            : null,
      };
    }
  }

  const items = (rawItems ?? []).map(flattenBasketItem);

  // Compute guide price from item costs if not available from splitView
  if (guidePrice === 0 && items.length > 0) {
    guidePrice = items.reduce((sum, item) => sum + item.cost, 0);
  }

  // Delivery slot
  let deliverySlot: DeliverySlot | null = null;
  const slot = basketData.slot as Record<string, unknown> | undefined;
  if (slot) {
    const start = safeStr(slot.start);
    const end = safeStr(slot.end);
    deliverySlot = {
      date: start ? start.split("T")[0] : "",
      time: start && end ? formatTimeRange(start, end) : "",
      charge: safeNum(slot.charge),
      expiresAt:
        typeof slot.reservationExpiry === "string"
          ? slot.reservationExpiry
          : typeof slot.expiry === "string"
            ? slot.expiry
            : null,
    };
  }

  // If charges not from splitView, check slot for delivery charge
  if (charges.delivery === null && slot) {
    charges.delivery =
      typeof slot.charge === "number" ? slot.charge : null;
  }

  return {
    guidePrice: Math.round(guidePrice * 100) / 100,
    itemCount: items.length,
    deliverySlot,
    items,
    charges,
  };
}

function formatTimeRange(start: string, end: string): string {
  try {
    const s = new Date(start);
    const e = new Date(end);
    const fmt = (d: Date) => {
      const h = d.getUTCHours();
      const m = d.getUTCMinutes();
      const period = h >= 12 ? "pm" : "am";
      const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
      return m === 0 ? `${hour}${period}` : `${hour}:${m.toString().padStart(2, "0")}${period}`;
    };
    return `${fmt(s)}-${fmt(e)}`;
  } catch {
    return "";
  }
}

// ─── Basket Update Flattening ────────────────────────────────────────────────

/**
 * Flatten UpdateBasket + GetBasket batch response into BasketUpdateResult.
 */
export function flattenBasketUpdate(
  updateResponse: Record<string, unknown>,
  basketResponse: Record<string, unknown>,
): BasketUpdateResult {
  const updates = updateResponse.updates as
    | { items?: Array<Record<string, unknown>> }
    | undefined;
  const updateItems = updates?.items ?? [];

  // Get item costs from the splitView or items in the update response
  const splitView = updateResponse.splitView as
    | Array<Record<string, unknown>>
    | undefined;
  const svItems = splitView?.[0]?.items as
    | Array<Record<string, unknown>>
    | undefined;

  const results: BasketUpdateItemResult[] = updateItems.map((u) => {
    const id = safeStr(u.id);
    // Try to find matching item in splitView for cost/quantity
    const matchingItem = svItems?.find((item) => {
      const product = item.product as Record<string, unknown> | undefined;
      return product?.id === id;
    });

    return {
      id,
      successful: (u.successful as boolean) ?? false,
      quantity: safeNum(matchingItem?.quantity),
      cost: safeNum(matchingItem?.cost),
    };
  });

  // Compute guide price from the basket response
  const basket = flattenBasket(basketResponse);

  return {
    success: results.every((r) => r.successful),
    results,
    basketGuidePrice: basket.guidePrice,
  };
}

// ─── Order Flattening ────────────────────────────────────────────────────────

export function flattenOrder(raw: Record<string, unknown>): Order {
  const slot = raw.slot as Record<string, unknown> | undefined;
  let orderSlot: OrderSlot | null = null;
  if (slot && slot.start && slot.end) {
    orderSlot = {
      start: safeStr(slot.start),
      end: safeStr(slot.end),
    };
  }

  const rawItems = (raw.items ?? []) as Array<Record<string, unknown>>;
  const items: OrderItem[] = rawItems.map((item) => ({
    id: safeStr(item.id),
    quantity: safeNum(item.quantity),
    cost: safeNum(item.cost),
  }));

  return {
    id: safeStr(raw.id),
    orderId: safeStr(raw.orderId),
    status: safeStr(raw.status),
    shoppingMethod: safeStr(raw.shoppingMethod),
    slot: orderSlot,
    items,
  };
}

// ─── Category Flattening ─────────────────────────────────────────────────────

/**
 * Flatten taxonomy data into Category tree, optionally truncating depth
 * and filtering by department name.
 */
export function flattenCategories(
  rawCategories: Array<Record<string, unknown>>,
  options?: { department?: string; depth?: number },
): Category[] {
  const maxDepth = options?.depth ?? 3;

  function mapCategory(
    raw: Record<string, unknown>,
    currentDepth: number,
  ): Category {
    const cat: Category = {
      name: safeStr(raw.name),
    };

    if (raw.id) cat.id = safeStr(raw.id);

    if (currentDepth < maxDepth) {
      const children = raw.children as
        | Array<Record<string, unknown>>
        | undefined;
      if (children && children.length > 0) {
        cat.children = children.map((c) => mapCategory(c, currentDepth + 1));
      }
    }

    return cat;
  }

  let categories = rawCategories;

  // Filter by department name if specified
  if (options?.department) {
    const dept = options.department.toLowerCase();
    categories = categories.filter(
      (c) => safeStr(c.name).toLowerCase().includes(dept),
    );
  }

  return categories.map((c) => mapCategory(c, 1));
}

// ─── Delivery Slot Flattening ────────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/**
 * Flatten a raw delivery slot from the DeliverySlots API response.
 */
export function flattenDeliverySlot(raw: Record<string, unknown>): AvailableSlot {
  const start = safeStr(raw.start);
  const end = safeStr(raw.end);
  const date = start ? start.split("T")[0] : "";

  return {
    id: safeStr(raw.id),
    date,
    start,
    end,
    time: start && end ? formatTimeRange(start, end) : "",
    charge: safeNum(raw.charge),
    status: safeStr(raw.status),
  };
}

/**
 * Group flattened slots by date, adding day-of-week labels.
 */
export function groupSlotsByDate(slots: AvailableSlot[]): SlotsByDate[] {
  const grouped = new Map<string, AvailableSlot[]>();

  for (const slot of slots) {
    const existing = grouped.get(slot.date);
    if (existing) {
      existing.push(slot);
    } else {
      grouped.set(slot.date, [slot]);
    }
  }

  return Array.from(grouped.entries()).map(([date, dateSlots]) => {
    const d = new Date(date + "T00:00:00Z");
    return {
      date,
      dayOfWeek: DAY_NAMES[d.getUTCDay()],
      slots: dateSlots,
    };
  });
}

/**
 * Flatten delivery slots response into a structured result.
 */
export function flattenDeliverySlots(
  rawSlots: Array<Record<string, unknown>>,
  start: string,
  end: string,
  showUnavailable: boolean,
): DeliverySlotsResult {
  let slots = rawSlots.map(flattenDeliverySlot);

  if (!showUnavailable) {
    slots = slots.filter((s) => s.status === "Available");
  }

  const charges = slots
    .filter((s) => s.status === "Available")
    .map((s) => s.charge);

  return {
    dateRange: { start, end },
    totalAvailable: slots.filter((s) => s.status === "Available").length,
    cheapestCharge: charges.length > 0 ? Math.min(...charges) : 0,
    slotsByDate: groupSlotsByDate(slots),
  };
}

/**
 * Flatten GetFulfilment response into available weeks.
 */
export function flattenAvailableWeeks(
  rawWeeks: Array<Record<string, unknown>>,
): AvailableWeek[] {
  return rawWeeks.map((w) => ({
    weekNo: safeNum(w.weekNo),
    startDate: safeStr(w.startDate).split("T")[0],
    endDate: safeStr(w.endDate).split("T")[0],
  }));
}

/**
 * Extract current slot info from basket data.
 */
export function flattenCurrentSlot(
  basketData: Record<string, unknown>,
): CurrentSlotResult {
  const slot = basketData.slot as Record<string, unknown> | undefined;

  if (!slot || !slot.start) {
    return { hasSlot: false, slot: null };
  }

  const start = safeStr(slot.start);
  const end = safeStr(slot.end);

  return {
    hasSlot: true,
    slot: {
      date: start ? start.split("T")[0] : "",
      time: start && end ? formatTimeRange(start, end) : "",
      charge: safeNum(slot.charge),
      status: safeStr(slot.status),
      reservationExpiry:
        typeof slot.reservationExpiry === "string"
          ? slot.reservationExpiry
          : null,
    },
  };
}

/**
 * Flatten Fulfilment mutation + GetBasket batch response into a booking result.
 */
export function flattenSlotBooking(
  fulfilmentData: Record<string, unknown>,
  basketData: Record<string, unknown>,
  action: "BOOK" | "UNBOOK",
): SlotBookingResult {
  const fulfilmentSlot = fulfilmentData.slot as Record<string, unknown> | undefined;
  const basket = flattenBasket(basketData);

  let slot: SlotBookingResult["slot"] = null;
  if (fulfilmentSlot && fulfilmentSlot.start && action === "BOOK") {
    const start = safeStr(fulfilmentSlot.start);
    const end = safeStr(fulfilmentSlot.end);
    slot = {
      date: start ? start.split("T")[0] : "",
      time: start && end ? formatTimeRange(start, end) : "",
      charge: safeNum(fulfilmentSlot.charge ?? (basketData.slot as Record<string, unknown> | undefined)?.charge),
      status: safeStr(fulfilmentSlot.status),
      reservationExpiry:
        typeof fulfilmentSlot.reservationExpiry === "string"
          ? fulfilmentSlot.reservationExpiry
          : null,
    };
  }

  return {
    success: true,
    action,
    slot,
    basket: {
      guidePrice: basket.guidePrice,
      itemCount: basket.itemCount,
    },
  };
}
