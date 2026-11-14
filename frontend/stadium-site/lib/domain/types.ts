// The shapes the screens work with. Names follow GLOSSARY.md.
// These mirror the JSON of the gateway (ARCHITECTURE §11); where the frontend
// fixed a shape first, it is listed in docs/process/FRONTEND-DEVIATIONS.md.

export type Level = "LOWER" | "CLUB" | "UPPER";

export type Tier = "CLUB_PREMIUM" | "CATEGORY_1" | "CATEGORY_2" | "CATEGORY_3";

/** Which side of the pitch a Block is on. WEST and EAST are the long sides. */
export type Side = "WEST" | "NORTH" | "EAST" | "SOUTH";

/** A = available, H = held, S = sold. */
export type SeatState = "A" | "H" | "S";

/** A decimal amount as text, e.g. "320.00". Never a float. */
export type Money = string;

export type Currency = "EUR";

export interface Team {
  id: string;
  name: string;
  shortName: string;
}

export type MatchStatus = "SCHEDULED" | "BOOKING_OPEN" | "SOLD_OUT" | "FINISHED";

export interface Match {
  id: number;
  home: Team;
  away: Team;
  competition: string;
  venue: string;
  kickoffAt: string;
  bookingOpensAt: string;
  status: MatchStatus;
}

export interface Block {
  /** "101" to "140", "201" to "240", "301" to "340". */
  id: string;
  level: Level;
  /** 0 to 39, clockwise around the bowl, starting on the west side. */
  position: number;
  side: Side;
  tier: Tier;
  basePrice: Money;
  /** Seats in each Row, front Row first. Rows get longer as the bowl widens. */
  rowSeats: number[];
}

export interface SeatMap {
  matchId: number;
  currency: Currency;
  seatCount: number;
  blocks: Block[];
}

export interface SeatCounts {
  available: number;
  held: number;
  sold: number;
}

export interface Occupancy extends SeatCounts {
  matchId: number;
  blocks: Record<string, SeatCounts>;
}

/**
 * One string per Block, one character per Seat, Rows front to back and
 * Seats left to right. 60,000 seats fit in about 60 KB this way.
 */
export interface SeatStates {
  matchId: number;
  blocks: Record<string, string>;
}

export interface QuoteLine {
  seatId: string;
  tier: Tier;
  basePrice: Money;
  discountPercent: number;
  price: Money;
}

export interface Quote {
  quoteId: string;
  matchId: number;
  lines: QuoteLine[];
  total: Money;
  currency: Currency;
  expiresAt: string;
}

export interface Hold {
  holdId: string;
  matchId: number;
  seatIds: string[];
  expiresAt: string;
  quote: Quote;
}

export interface CreateHoldRequest {
  mode: "EXPLICIT";
  seatIds: string[];
}

export type PaymentMethod = "APPLE_PAY" | "CARD";

export type OrderStatus = "PENDING" | "CONFIRMED" | "FAILED";

export interface Order {
  orderId: string;
  holdId: string;
  matchId: number;
  seatIds: string[];
  amount: Money;
  currency: Currency;
  status: OrderStatus;
  createdAt: string;
}

export interface CreateOrderRequest {
  holdId: string;
  paymentMethod: PaymentMethod;
}

export interface Ticket {
  ticketId: string;
  orderId: string;
  matchId: number;
  seatId: string;
  tier: Tier;
  price: Money;
}

export interface Session {
  fanId: string;
  /** True once the Fan has proven a mobile number with a one-time code. */
  verified: boolean;
  mobile?: string;
}

export interface OtpChallenge {
  expiresInSeconds: number;
  /** Only the mock sends this, so the demo can show the code on screen. */
  demoCode?: string;
}

/**
 * Where a Fan is in the Waiting Room of a Match.
 * NOT_JOINED: has not joined, or their admission ran out.
 * WAITING: joined, the Draw has not happened yet.
 * QUEUED: the Draw gave them a place; Fans ahead of them are being let in.
 * ADMITTED: they may book until the admission runs out.
 */
export type WaitingRoomStatus =
  | { phase: "NOT_JOINED"; waiting: number }
  | { phase: "WAITING"; waiting: number; drawAt: string }
  | {
      phase: "QUEUED";
      /** Fans still ahead, counting this Fan: 1 means next. */
      position: number;
      /** The place the Draw gave them. */
      drawnPosition: number;
      waiting: number;
      admittedPerSecond: number;
    }
  | { phase: "ADMITTED"; drawnPosition: number; admissionExpiresAt: string };
