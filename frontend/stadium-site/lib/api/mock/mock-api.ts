import type {
  Hold,
  Occupancy,
  Order,
  SeatCounts,
  SeatState,
  Session,
  Ticket,
  WaitingRoomStatus,
} from "@/lib/domain/types";
import { parseSeatId, seatOffset } from "@/lib/domain/seat-id";
import { PROBLEM, problem } from "../problem";
import type { StadiumApi } from "../stadium-api";
import { findMatch, MATCHES, toMatch, type MockMatch } from "./matches";
import { priceSeats } from "./pricing";
import { findBlock, generateSeatMap } from "./seat-map";
import { soldSeats } from "./sold-seats";
import type { MockState, MockStore, StoredOrder } from "./store";

// The mock backend. It keeps the same rules the real services will keep, so
// the screens are built against honest behaviour:
//   - a Hold is 1 to 4 available seats, all or nothing, and expires by itself
//   - a Quote is fixed when the Hold is made
//   - a Fan can never have more than four seats for a Match
//   - the same Idempotency-Key never creates a second Order
//   - a Hold needs an admission from the Waiting Room

export const HOLD_TTL_MS = 480_000; // 8 minutes, as in DESIGN §3
export const MAX_SEATS = 4;
const PAYMENT_MS = 1_500;

// The Waiting Room, at demo size. The real one admits at a measured rate
// starting at 200 Fans a second (DESIGN section 1); the crowd here is small
// enough that the longest wait is 18 seconds.
export const WAITING_FANS = 3_600;
export const ADMITTED_PER_SECOND = 200;
/** How long after a Fan joins the Draw happens. In real life it is at the booking-open time. */
export const DRAW_DELAY_MS = 6_000;
/** How long an admission lasts. */
export const ADMISSION_MS = 30 * 60_000;
const OTP_TTL_MS = 300_000;

export interface MockApiOptions {
  store: MockStore;
  /** The clock. Tests pass their own to move time forward. */
  now?: () => number;
  /** Pretend network delay, so loading states show up in the demo. */
  latencyMs?: number;
  /** A number from 0 up to, not including, 1. Tests pass their own to fix the Draw. */
  random?: () => number;
}

const fairRandom = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

export function createMockApi({
  store,
  now = Date.now,
  latencyMs = 0,
  random = fairRandom,
}: MockApiOptions): StadiumApi {
  const newId = () => crypto.randomUUID();

  function load(): MockState {
    return (
      store.load() ?? {
        fanId: newId(),
        verified: false,
        holds: {},
        orders: {},
        tickets: [],
        idempotency: {},
      }
    );
  }

  const isLive = (hold: Hold) => Date.parse(hold.expiresAt) > now();

  /** Finishes pretend payments that are due and turns them into Tickets. */
  function settle(state: MockState): void {
    for (const order of Object.values(state.orders)) {
      if (order.status !== "PENDING" || order.settlesAt > now()) continue;
      const hold = state.holds[order.holdId];
      const paidInTime = hold && Date.parse(hold.expiresAt) > order.settlesAt;
      if (!paidInTime) {
        order.status = "FAILED";
        continue;
      }
      order.status = "CONFIRMED";
      for (const line of hold.quote.lines) {
        state.tickets.push({
          ticketId: newId(),
          orderId: order.orderId,
          matchId: order.matchId,
          seatId: line.seatId,
          tier: line.tier,
          price: line.price,
        });
      }
      delete state.holds[order.holdId];
    }
  }

  /** Runs one request: load, settle what is due, do the work, save. */
  async function run<T>(work: (state: MockState) => T): Promise<T> {
    if (latencyMs > 0) await new Promise((done) => setTimeout(done, latencyMs));
    const state = load();
    settle(state);
    try {
      return work(state);
    } finally {
      store.save(state);
    }
  }

  /** Where this Fan is in a Match's Waiting Room, worked out from the clock. */
  function waitingRoom(state: MockState, matchId: number): WaitingRoomStatus {
    const place = state.waitingRoom?.[matchId];
    if (!place) return { phase: "NOT_JOINED", waiting: WAITING_FANS };
    if (now() < place.drawAt) {
      return {
        phase: "WAITING",
        waiting: WAITING_FANS,
        drawAt: new Date(place.drawAt).toISOString(),
      };
    }
    // After the Draw the queue moves at a steady rate, so the place a Fan
    // drew decides exactly when their turn comes.
    const admittedAt = place.drawAt + (place.drawnPosition / ADMITTED_PER_SECOND) * 1000;
    if (now() < admittedAt) {
      return {
        phase: "QUEUED",
        // Multiply before dividing: whole numbers stay exact, so a Fan is
        // never shown one place further back than they are.
        position: Math.max(1, Math.ceil(((admittedAt - now()) * ADMITTED_PER_SECOND) / 1000)),
        drawnPosition: place.drawnPosition,
        waiting: WAITING_FANS,
        admittedPerSecond: ADMITTED_PER_SECOND,
      };
    }
    if (now() < admittedAt + ADMISSION_MS) {
      return {
        phase: "ADMITTED",
        drawnPosition: place.drawnPosition,
        admissionExpiresAt: new Date(admittedAt + ADMISSION_MS).toISOString(),
      };
    }
    delete state.waitingRoom![matchId];
    return { phase: "NOT_JOINED", waiting: WAITING_FANS };
  }

  function requireMatch(matchId: number): MockMatch {
    const match = findMatch(matchId);
    if (!match) throw problem(404, PROBLEM.notFound, "Match not found");
    return match;
  }

  /** This Fan's seats for a Match: held now, or already bought. */
  function mySeats(state: MockState, matchId: number): Map<string, SeatState> {
    const seats = new Map<string, SeatState>();
    for (const ticket of state.tickets) {
      if (ticket.matchId === matchId) seats.set(ticket.seatId, "S");
    }
    for (const hold of Object.values(state.holds)) {
      if (hold.matchId !== matchId || !isLive(hold)) continue;
      for (const seatId of hold.seatIds) seats.set(seatId, "H");
    }
    return seats;
  }

  function seatState(state: MockState, match: MockMatch, seatId: string): SeatState | null {
    const ref = parseSeatId(seatId);
    const block = ref && findBlock(ref.blockId);
    if (!ref || !block) return null;
    const offset = seatOffset(block, ref.row, ref.seat);
    if (offset < 0) return null;
    const mine = mySeats(state, match.id).get(seatId);
    if (mine) return mine;
    return soldSeats(match.id, match.soldShare).blocks[block.id][offset] as SeatState;
  }

  /** The public shape, without what only the mock needs. */
  function toOrder(stored: StoredOrder): Order {
    const order: Partial<StoredOrder> = { ...stored };
    delete order.paymentMethod;
    delete order.settlesAt;
    return order as Order;
  }

  const toSession = (state: MockState): Session => ({
    fanId: state.fanId,
    verified: state.verified,
    ...(state.mobile && { mobile: state.mobile }),
  });

  return {
    listMatches: () => run(() => MATCHES.map(toMatch)),

    getMatch: (matchId) => run(() => toMatch(requireMatch(matchId))),

    joinWaitingRoom: (matchId) =>
      run((state) => {
        const match = requireMatch(matchId);
        if (match.status !== "BOOKING_OPEN") {
          throw problem(409, PROBLEM.bookingNotOpen, "Booking is not open for this Match");
        }
        // One place per Fan: joining again changes nothing.
        if (waitingRoom(state, matchId).phase === "NOT_JOINED") {
          state.waitingRoom ??= {};
          state.waitingRoom[matchId] = {
            drawAt: now() + DRAW_DELAY_MS,
            // The Draw: every place is equally likely, whenever the Fan joined.
            drawnPosition: 1 + Math.floor(random() * WAITING_FANS),
          };
        }
        return waitingRoom(state, matchId);
      }),

    getWaitingRoom: (matchId) =>
      run((state) => {
        requireMatch(matchId);
        return waitingRoom(state, matchId);
      }),

    watchWaitingRoom: (matchId, onStatus) => {
      // The gateway pushes updates; the mock looks at the clock four times a second.
      const look = () => {
        const state = load();
        const status = waitingRoom(state, matchId);
        store.save(state);
        onStatus(status);
      };
      look();
      const timer = setInterval(look, 250);
      return () => clearInterval(timer);
    },

    getSeatMap: (matchId) =>
      run(() => {
        requireMatch(matchId);
        return generateSeatMap(matchId);
      }),

    getOccupancy: (matchId) =>
      run((state) => {
        const match = requireMatch(matchId);
        const base = soldSeats(matchId, match.soldShare).counts;
        const blocks: Record<string, SeatCounts> = {};
        for (const [blockId, counts] of Object.entries(base)) {
          blocks[blockId] = { ...counts };
        }
        // This Fan's seats were available before, so move them across.
        for (const [seatId, state_] of mySeats(state, matchId)) {
          const counts = blocks[parseSeatId(seatId)!.blockId];
          counts.available--;
          if (state_ === "H") counts.held++;
          else counts.sold++;
        }
        const total: Occupancy = { matchId, available: 0, held: 0, sold: 0, blocks };
        for (const counts of Object.values(blocks)) {
          total.available += counts.available;
          total.held += counts.held;
          total.sold += counts.sold;
        }
        return total;
      }),

    getSeatStates: (matchId, blockIds) =>
      run((state) => {
        const match = requireMatch(matchId);
        const base = soldSeats(matchId, match.soldShare).blocks;
        const wanted = blockIds ?? Object.keys(base);
        const blocks: Record<string, string> = {};
        for (const blockId of wanted) {
          if (!(blockId in base)) {
            throw problem(404, PROBLEM.notFound, `Block ${blockId} not found`);
          }
          blocks[blockId] = base[blockId];
        }
        for (const [seatId, state_] of mySeats(state, matchId)) {
          const ref = parseSeatId(seatId)!;
          const states = blocks[ref.blockId];
          if (states === undefined) continue;
          const offset = seatOffset(findBlock(ref.blockId)!, ref.row, ref.seat);
          blocks[ref.blockId] =
            states.slice(0, offset) + state_ + states.slice(offset + 1);
        }
        return { matchId, blocks };
      }),

    createHold: (matchId, request) =>
      run((state) => {
        const match = requireMatch(matchId);
        if (match.status !== "BOOKING_OPEN") {
          throw problem(409, PROBLEM.bookingNotOpen, "Booking is not open for this Match");
        }

        if (waitingRoom(state, matchId).phase !== "ADMITTED") {
          throw problem(403, PROBLEM.notAdmitted, "Go through the Waiting Room first");
        }

        const seatIds = [...new Set(request.seatIds)].sort();
        if (seatIds.length < 1 || seatIds.length > MAX_SEATS) {
          throw problem(400, PROBLEM.invalidHold, `A Hold is 1 to ${MAX_SEATS} seats`);
        }
        const states = seatIds.map((seatId) => seatState(state, match, seatId));
        if (states.includes(null)) {
          throw problem(400, PROBLEM.invalidHold, "Unknown seat");
        }

        const already = mySeats(state, matchId).size;
        if (already + seatIds.length > MAX_SEATS) {
          throw problem(409, PROBLEM.purchaseLimit, "Purchase Limit reached", {
            detail: `You can have ${MAX_SEATS} seats per Match and already have ${already}.`,
          });
        }

        const conflictingSeatIds = seatIds.filter((_, i) => states[i] !== "A");
        if (conflictingSeatIds.length > 0) {
          throw problem(409, PROBLEM.seatsUnavailable, "Seats unavailable", {
            conflictingSeatIds,
          });
        }

        const expiresAt = new Date(now() + HOLD_TTL_MS).toISOString();
        const hold: Hold = {
          holdId: newId(),
          matchId,
          seatIds,
          expiresAt,
          quote: {
            quoteId: newId(),
            matchId,
            ...priceSeats(seatIds),
            currency: "EUR",
            expiresAt,
          },
        };
        state.holds[hold.holdId] = hold;
        return hold;
      }),

    getHold: (matchId, holdId) =>
      run((state) => {
        const hold = state.holds[holdId];
        if (!hold || hold.matchId !== matchId) {
          throw problem(404, PROBLEM.notFound, "Hold not found");
        }
        if (!isLive(hold)) throw problem(410, PROBLEM.holdExpired, "Hold expired");
        return hold;
      }),

    releaseHold: (matchId, holdId) =>
      run((state) => {
        const hold = state.holds[holdId];
        if (!hold || hold.matchId !== matchId) {
          throw problem(404, PROBLEM.notFound, "Hold not found");
        }
        delete state.holds[holdId];
      }),

    getQuote: (matchId, quoteId) =>
      run((state) => {
        const hold = Object.values(state.holds).find(
          (h) => h.matchId === matchId && h.quote.quoteId === quoteId,
        );
        if (!hold) throw problem(404, PROBLEM.notFound, "Quote not found");
        if (!isLive(hold)) throw problem(410, PROBLEM.holdExpired, "Quote expired");
        return hold.quote;
      }),

    getSession: () => run(toSession),

    requestOtp: (mobile) =>
      run((state) => {
        const digits = mobile.replace(/[\s()+-]/g, "");
        if (!/^\d{8,15}$/.test(digits)) {
          throw problem(400, PROBLEM.otpInvalid, "Enter a valid mobile number");
        }
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
        state.otp = { mobile, code, expiresAt: now() + OTP_TTL_MS };
        return { expiresInSeconds: OTP_TTL_MS / 1000, demoCode: code };
      }),

    verifyOtp: (mobile, code) =>
      run((state) => {
        const otp = state.otp;
        if (!otp || otp.mobile !== mobile || otp.code !== code || otp.expiresAt <= now()) {
          throw problem(401, PROBLEM.otpInvalid, "That code is not right");
        }
        delete state.otp;
        state.verified = true;
        state.mobile = mobile;
        return toSession(state);
      }),

    createOrder: (request, idempotencyKey) =>
      run((state) => {
        if (!idempotencyKey) {
          throw problem(400, PROBLEM.idempotencyMismatch, "Idempotency-Key is required");
        }
        const fingerprint = `${request.holdId}|${request.paymentMethod}`;
        const seen = state.idempotency[idempotencyKey];
        if (seen) {
          if (seen.fingerprint !== fingerprint) {
            throw problem(
              422,
              PROBLEM.idempotencyMismatch,
              "This Idempotency-Key was used for a different request",
            );
          }
          return toOrder(state.orders[seen.orderId]);
        }

        if (!state.verified) {
          throw problem(401, PROBLEM.notSignedIn, "Verify your mobile number first");
        }
        const hold = state.holds[request.holdId];
        if (!hold) throw problem(404, PROBLEM.notFound, "Hold not found");
        if (!isLive(hold)) throw problem(410, PROBLEM.holdExpired, "Hold expired");
        const existing = Object.values(state.orders).find(
          (o) => o.holdId === hold.holdId && o.status !== "FAILED",
        );
        if (existing) {
          throw problem(409, PROBLEM.orderExists, "This Hold already has an Order", {
            orderId: existing.orderId,
          });
        }

        const order: StoredOrder = {
          orderId: newId(),
          holdId: hold.holdId,
          matchId: hold.matchId,
          seatIds: hold.seatIds,
          amount: hold.quote.total,
          currency: hold.quote.currency,
          status: "PENDING",
          createdAt: new Date(now()).toISOString(),
          paymentMethod: request.paymentMethod,
          settlesAt: now() + PAYMENT_MS,
        };
        state.orders[order.orderId] = order;
        state.idempotency[idempotencyKey] = { fingerprint, orderId: order.orderId };
        return toOrder(order);
      }),

    getOrder: (orderId) =>
      run((state) => {
        const order = state.orders[orderId];
        if (!order) throw problem(404, PROBLEM.notFound, "Order not found");
        return toOrder(order);
      }),

    listMyTickets: () => run((state): Ticket[] => state.tickets),
  };
}
