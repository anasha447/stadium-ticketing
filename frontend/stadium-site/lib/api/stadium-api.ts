import type {
  CreateHoldRequest,
  CreateOrderRequest,
  Hold,
  Match,
  Occupancy,
  Order,
  OtpChallenge,
  Quote,
  SeatMap,
  SeatStates,
  Session,
  Ticket,
} from "@/lib/domain/types";

/**
 * Everything the screens can ask the backend. One method per endpoint of
 * ARCHITECTURE §11 that the Fan flow uses. Two adapters implement it: the
 * gateway over HTTP, and the mock layer. Failures throw ApiProblem.
 */
export interface StadiumApi {
  // catalog
  listMatches(): Promise<Match[]>;
  getMatch(matchId: number): Promise<Match>;

  // inventory
  getSeatMap(matchId: number): Promise<SeatMap>;
  getOccupancy(matchId: number): Promise<Occupancy>;
  /** All Blocks, or only the ones asked for. */
  getSeatStates(matchId: number, blockIds?: string[]): Promise<SeatStates>;
  createHold(matchId: number, request: CreateHoldRequest): Promise<Hold>;
  getHold(matchId: number, holdId: string): Promise<Hold>;
  releaseHold(matchId: number, holdId: string): Promise<void>;
  getQuote(matchId: number, quoteId: string): Promise<Quote>;

  // identity
  getSession(): Promise<Session>;
  requestOtp(mobile: string): Promise<OtpChallenge>;
  verifyOtp(mobile: string, code: string): Promise<Session>;

  // ticketing
  /** The same key with the same request always returns the same Order. */
  createOrder(request: CreateOrderRequest, idempotencyKey: string): Promise<Order>;
  getOrder(orderId: string): Promise<Order>;
  listMyTickets(): Promise<Ticket[]>;
}
