// ─── Error Types ─────────────────────────────────────────────────────────────

export type TescoErrorCode =
  | "TOKEN_EXPIRED"
  | "RATE_LIMITED"
  | "API_ERROR"
  | "INVALID_REQUEST";

export class TescoError extends Error {
  constructor(
    public readonly code: TescoErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "TescoError";
  }
}

export function toolErrorResponse(e: unknown): {
  content: Array<{ type: "text"; text: string }>;
  isError: true;
} {
  const error =
    e instanceof TescoError
      ? { error: e.code, message: e.message }
      : { error: "API_ERROR", message: String(e) };
  return { content: [{ type: "text", text: JSON.stringify(error) }], isError: true };
}

// ─── GraphQL Transport ───────────────────────────────────────────────────────

export interface GraphQLOperation {
  operationName: string;
  variables: Record<string, unknown>;
  extensions: { mfeName: string };
  query: string;
}

export interface GraphQLResponse {
  data?: Record<string, unknown>;
  errors?: Array<{
    message: string;
    locations?: unknown[];
    extensions?: unknown;
  }>;
  status?: number;
}

// ─── Flattened Output Types (what MCP tools return to Claude) ────────────────

export interface Promotion {
  description: string;
  clubcardOnly: boolean;
  discountedPrice: number | null;
}

export interface Reviews {
  count: number;
  rating: number;
}

export interface Product {
  id: string;
  tpnb: string;
  title: string;
  brand: string;
  price: number;
  unitPrice: number;
  unitOfMeasure: string;
  isForSale: boolean;
  isInFavourites: boolean;
  imageUrl: string;
  department: string;
  aisle: string;
  promotion: Promotion | null;
  reviews: Reviews | null;
}

export interface ProductList {
  totalCount: number;
  page: number;
  pageSize: number;
  products: Product[];
}

export interface BasketItem {
  id: string;
  title: string;
  quantity: number;
  cost: number;
  unitPrice: number | null;
  unitOfMeasure: string | null;
  isForSale: boolean;
  status: string;
}

export interface DeliverySlot {
  date: string;
  time: string;
  charge: number;
  expiresAt: string | null;
}

export interface BasketCharges {
  delivery: number | null;
  minimumBasketCharge: number | null;
}

export interface Basket {
  guidePrice: number;
  itemCount: number;
  deliverySlot: DeliverySlot | null;
  items: BasketItem[];
  charges: BasketCharges;
}

export interface BasketUpdateItemResult {
  id: string;
  successful: boolean;
  quantity: number;
  cost: number;
}

export interface BasketUpdateResult {
  success: boolean;
  results: BasketUpdateItemResult[];
  basketGuidePrice: number;
}

export interface Category {
  name: string;
  id?: string;
  children?: Category[];
}

export interface OrderSlot {
  start: string;
  end: string;
}

export interface OrderItem {
  id: string;
  quantity: number;
  cost: number;
}

export interface Order {
  id: string;
  orderId: string;
  status: string;
  shoppingMethod: string;
  slot: OrderSlot | null;
  items: OrderItem[];
}

export interface AuthResult {
  success: boolean;
  expiresAt: string;
  customerUuid: string;
}

// ─── Delivery Slot Types ─────────────────────────────────────────────────────

export interface AvailableSlot {
  id: string;
  date: string;
  start: string;
  end: string;
  time: string;
  charge: number;
  status: string;
}

export interface SlotsByDate {
  date: string;
  dayOfWeek: string;
  slots: AvailableSlot[];
}

export interface DeliverySlotsResult {
  dateRange: { start: string; end: string };
  totalAvailable: number;
  cheapestCharge: number;
  slotsByDate: SlotsByDate[];
}

export interface AvailableWeek {
  weekNo: number;
  startDate: string;
  endDate: string;
}

export interface CurrentSlotResult {
  hasSlot: boolean;
  slot: {
    date: string;
    time: string;
    charge: number;
    status: string;
    reservationExpiry: string | null;
  } | null;
}

export interface SlotBookingResult {
  success: boolean;
  action: "BOOK" | "UNBOOK";
  slot: {
    date: string;
    time: string;
    charge: number;
    status: string;
    reservationExpiry: string | null;
  } | null;
  basket: { guidePrice: number; itemCount: number };
}
