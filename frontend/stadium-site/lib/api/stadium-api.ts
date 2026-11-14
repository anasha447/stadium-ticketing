import type {
  CreateHoldRequest,
  CreateOrderRequest,
  Hold,
  Match,
  Occupancy,
  Order,
  OtpChallenge,
  Quote,
  SeatDelta,
  SeatMap,
  SeatStates,
  Session,
  Ticket,
  WaitingRoomStatus,
} from "@/lib/domain/types";

export interface SeatWatcher {
  onOpen?: () => void;
  onDelta: (delta: SeatDelta) => void;
}

/**
 * Everything the screens can ask the backend. One method per endpoint of
 * ARCHITECTURE §11 that the Fan flow uses. Two adapters implement it: the
 * gateway over HTTP, and the mock layer. Failures throw ApiProblem.
 */
export interface StadiumApi {
  // catalog
  listMatches(): Promise<Match[]>;
  getMatch(matchId: number): Promise<Match>;

  // gateway: the Waiting Room
  /** Joining twice keeps the same place. */
  joinWaitingRoom(matchId: number): Promise<WaitingRoomStatus>;
  getWaitingRoom(matchId: number): Promise<WaitingRoomStatus>;
  /**
   * Calls back with the Fan's status now and every time it changes.
   * Returns a function that stops it.
   */
  watchWaitingRoom(matchId: number, onStatus: (status: WaitingRoomStatus) => void): () => void;

  // inventory
  getSeatMap(matchId: number): Promise<SeatMap>;
  getOccupancy(matchId: number): Promise<Occupancy>;
  /** All Blocks, or only the ones asked for. */
  getSeatStates(matchId: number, blockIds?: string[]): Promise<SeatStates>;
  /**
   * Opens the Match stream and calls back with every Seat State change from
   * then on. Changes from before it opened are not sent, so `onOpen` is the
   * moment to read the Seat States: it is called when the stream connects,
   * and again each time it comes back after dropping. Returns a function
   * that closes the stream.
   */
  watchSeats(matchId: number, watcher: SeatWatcher): () => void;
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
