import { beforeEach, describe, expect, it } from "vitest";
import { formatSeatId } from "@/lib/domain/seat-id";
import type { SeatState } from "@/lib/domain/types";
import { ApiProblem, PROBLEM } from "../problem";
import type { StadiumApi } from "../stadium-api";
import { createMockApi, DRAW_DELAY_MS, HOLD_TTL_MS } from "./mock-api";
import { generateSeatMap } from "./seat-map";
import { soldSeats } from "./sold-seats";
import { createMemoryStore } from "./store";

const MATCH = 1;
const MOBILE = "+34 600 000 000";

/** Seat ids of a Block that are in the given state before anyone acts. */
function seatsInState(state: SeatState, blockId: string, count: number): string[] {
  const block = generateSeatMap(MATCH).blocks.find((b) => b.id === blockId)!;
  const states = soldSeats(MATCH, 0.5).blocks[blockId];
  const found: string[] = [];
  let offset = 0;
  block.rowSeats.forEach((seats, r) => {
    for (let seat = 1; seat <= seats && found.length < count; seat++) {
      if (states[offset + seat - 1] === state) {
        found.push(formatSeatId({ blockId, row: r + 1, seat }));
      }
    }
    offset += seats;
  });
  if (found.length < count) throw new Error(`Block has fewer than ${count} seats in state ${state}`);
  return found;
}

/** Available seats next to each other in one Row of Block 107 (Category 1). */
function adjacentFreeSeats(count: number): string[] {
  const blockId = "107";
  const block = generateSeatMap(MATCH).blocks.find((b) => b.id === blockId)!;
  const states = soldSeats(MATCH, 0.5).blocks[blockId];
  let offset = 0;
  for (let row = 1; row <= block.rowSeats.length; row++) {
    const seats = block.rowSeats[row - 1];
    const start = states.slice(offset, offset + seats).indexOf("A".repeat(count));
    if (start >= 0) {
      return Array.from({ length: count }, (_, i) =>
        formatSeatId({ blockId, row, seat: start + 1 + i }),
      );
    }
    offset += seats;
  }
  throw new Error("No adjacent free seats in Block 107");
}

async function problemOf(promise: Promise<unknown>): Promise<ApiProblem> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiProblem) return error;
    throw error;
  }
  throw new Error("Expected the call to fail");
}

let clock: number;
let api: StadiumApi;

async function signIn() {
  const { demoCode } = await api.requestOtp(MOBILE);
  await api.verifyOtp(MOBILE, demoCode!);
}

beforeEach(async () => {
  clock = Date.parse("2026-11-14T10:00:00Z");
  // The Draw gives this Fan the first place, so they are admitted at once.
  api = createMockApi({ store: createMemoryStore(), now: () => clock, random: () => 0 });
  await api.joinWaitingRoom(MATCH);
  clock += DRAW_DELAY_MS + 1_000;
});

describe("catalog", () => {
  it("lists the Barcelona Derby with booking open", async () => {
    const [derby] = await api.listMatches();
    expect(derby.home.shortName).toBe("Barcelona");
    expect(derby.away.shortName).toBe("Espanyol");
    expect(derby.status).toBe("BOOKING_OPEN");
    expect(derby).not.toHaveProperty("soldShare");
  });

  it("answers 404 for a Match that does not exist", async () => {
    expect((await problemOf(api.getMatch(999))).status).toBe(404);
  });
});

describe("Hold", () => {
  it("holds available seats and returns a Quote that expires with it", async () => {
    const seatIds = adjacentFreeSeats(2);
    const hold = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds });

    expect(hold.seatIds).toEqual(seatIds);
    expect(Date.parse(hold.expiresAt)).toBe(clock + HOLD_TTL_MS);
    expect(hold.quote.expiresAt).toBe(hold.expiresAt);
    expect(hold.quote.lines).toHaveLength(2);
  });

  it("shows held seats as held, and takes them out of the available count", async () => {
    const before = await api.getOccupancy(MATCH);
    await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: adjacentFreeSeats(3) });

    const after = await api.getOccupancy(MATCH);
    expect(after.held).toBe(3);
    expect(after.available).toBe(before.available - 3);
    expect(after.blocks["107"].held).toBe(3);

    const { blocks } = await api.getSeatStates(MATCH, ["107"]);
    expect(Object.keys(blocks)).toEqual(["107"]);
    expect([...blocks["107"]].filter((s) => s === "H")).toHaveLength(3);
  });

  it("refuses a sold seat, names it, and holds nothing", async () => {
    const [free] = seatsInState("A", "101", 1);
    const [sold] = seatsInState("S", "101", 1);

    const problem = await problemOf(
      api.createHold(MATCH, { mode: "EXPLICIT", seatIds: [free, sold] }),
    );
    expect(problem.status).toBe(409);
    expect(problem.type).toBe(PROBLEM.seatsUnavailable);
    expect(problem.conflictingSeatIds).toEqual([sold]);
    expect((await api.getOccupancy(MATCH)).held).toBe(0);
  });

  it("is never more than four seats", async () => {
    const five = [...adjacentFreeSeats(4), ...seatsInState("A", "301", 1)];
    const problem = await problemOf(api.createHold(MATCH, { mode: "EXPLICIT", seatIds: five }));
    expect(problem.type).toBe(PROBLEM.invalidHold);
  });

  it("counts against the Purchase Limit across Holds", async () => {
    await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: adjacentFreeSeats(3) });
    const problem = await problemOf(
      api.createHold(MATCH, { mode: "EXPLICIT", seatIds: seatsInState("A", "301", 2) }),
    );
    expect(problem.type).toBe(PROBLEM.purchaseLimit);
  });

  it("expires by itself and frees the seats", async () => {
    const seatIds = adjacentFreeSeats(2);
    const hold = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds });

    clock += HOLD_TTL_MS - 1;
    await expect(api.getHold(MATCH, hold.holdId)).resolves.toMatchObject({ holdId: hold.holdId });

    clock += 1;
    expect((await problemOf(api.getHold(MATCH, hold.holdId))).type).toBe(PROBLEM.holdExpired);
    expect((await api.getOccupancy(MATCH)).held).toBe(0);
    await expect(api.createHold(MATCH, { mode: "EXPLICIT", seatIds })).resolves.toBeDefined();
  });

  it("can be released", async () => {
    const hold = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: adjacentFreeSeats(2) });
    await api.releaseHold(MATCH, hold.holdId);
    expect((await api.getOccupancy(MATCH)).held).toBe(0);
    expect((await problemOf(api.getHold(MATCH, hold.holdId))).status).toBe(404);
  });

  it("is refused for a Match whose booking has not opened", async () => {
    const problem = await problemOf(
      api.createHold(2, { mode: "EXPLICIT", seatIds: ["101-R01-01"] }),
    );
    expect(problem.type).toBe(PROBLEM.bookingNotOpen);
  });
});

describe("Quote", () => {
  it("gives the Group Discount to seats that sit together: 0, 5, 10, 15 percent", async () => {
    const { quote } = await api.createHold(MATCH, {
      mode: "EXPLICIT",
      seatIds: adjacentFreeSeats(4),
    });
    expect(quote.lines.map((l) => l.discountPercent)).toEqual([0, 5, 10, 15]);
    expect(quote.lines.map((l) => l.price)).toEqual(["320.00", "304.00", "288.00", "272.00"]);
    expect(quote.total).toBe("1184.00");
    expect(quote.currency).toBe("EUR");
  });

  it("gives no discount to seats that are apart", async () => {
    const seatIds = [seatsInState("A", "107", 1)[0], seatsInState("A", "301", 1)[0]];
    const { quote } = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds });
    expect(quote.lines.every((l) => l.discountPercent === 0)).toBe(true);
  });

  it("never changes once the Hold is made", async () => {
    const hold = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: adjacentFreeSeats(2) });
    clock += 60_000;
    expect(await api.getQuote(MATCH, hold.quote.quoteId)).toEqual(hold.quote);
  });
});

describe("sign-in", () => {
  it("starts unverified and becomes verified with the right code", async () => {
    expect((await api.getSession()).verified).toBe(false);
    await signIn();
    const session = await api.getSession();
    expect(session.verified).toBe(true);
    expect(session.mobile).toBe(MOBILE);
  });

  it("rejects a wrong code", async () => {
    await api.requestOtp(MOBILE);
    const problem = await problemOf(api.verifyOtp(MOBILE, "not-it"));
    expect(problem.type).toBe(PROBLEM.otpInvalid);
    expect((await api.getSession()).verified).toBe(false);
  });
});

describe("Order", () => {
  it("needs a verified Fan", async () => {
    const hold = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: adjacentFreeSeats(1) });
    const problem = await problemOf(
      api.createOrder({ holdId: hold.holdId, paymentMethod: "CARD" }, "key-1"),
    );
    expect(problem.type).toBe(PROBLEM.notSignedIn);
  });

  it("goes from PENDING to CONFIRMED and turns the seats into Tickets", async () => {
    await signIn();
    const seatIds = adjacentFreeSeats(2);
    const hold = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds });

    const order = await api.createOrder(
      { holdId: hold.holdId, paymentMethod: "APPLE_PAY" },
      "key-1",
    );
    expect(order.status).toBe("PENDING");
    expect(order.amount).toBe(hold.quote.total);
    expect(order).not.toHaveProperty("settlesAt");

    clock += 2_000;
    expect((await api.getOrder(order.orderId)).status).toBe("CONFIRMED");

    const tickets = await api.listMyTickets();
    expect(tickets.map((t) => t.seatId)).toEqual(seatIds);
    expect(tickets.map((t) => t.price)).toEqual(hold.quote.lines.map((l) => l.price));

    expect((await api.getOccupancy(MATCH)).held).toBe(0);
    const { blocks } = await api.getSeatStates(MATCH, ["107"]);
    const before = soldSeats(MATCH, 0.5).counts["107"].sold;
    expect([...blocks["107"]].filter((s) => s === "S")).toHaveLength(before + 2);
  });

  it("returns the same Order when the same key is sent twice", async () => {
    await signIn();
    const hold = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: adjacentFreeSeats(1) });
    const request = { holdId: hold.holdId, paymentMethod: "CARD" as const };

    const first = await api.createOrder(request, "key-1");
    const second = await api.createOrder(request, "key-1");
    expect(second.orderId).toBe(first.orderId);

    clock += 2_000;
    await api.getOrder(first.orderId);
    expect(await api.listMyTickets()).toHaveLength(1);
  });

  it("answers 422 when a key is reused for a different request", async () => {
    await signIn();
    const hold = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: adjacentFreeSeats(1) });
    await api.createOrder({ holdId: hold.holdId, paymentMethod: "CARD" }, "key-1");
    const problem = await problemOf(
      api.createOrder({ holdId: hold.holdId, paymentMethod: "APPLE_PAY" }, "key-1"),
    );
    expect(problem.status).toBe(422);
  });

  it("is one per Hold", async () => {
    await signIn();
    const hold = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: adjacentFreeSeats(1) });
    await api.createOrder({ holdId: hold.holdId, paymentMethod: "CARD" }, "key-1");
    const problem = await problemOf(
      api.createOrder({ holdId: hold.holdId, paymentMethod: "CARD" }, "key-2"),
    );
    expect(problem.type).toBe(PROBLEM.orderExists);
  });

  it("is refused when the Hold has expired", async () => {
    await signIn();
    const hold = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: adjacentFreeSeats(1) });
    clock += HOLD_TTL_MS;
    const problem = await problemOf(
      api.createOrder({ holdId: hold.holdId, paymentMethod: "CARD" }, "key-1"),
    );
    expect(problem.type).toBe(PROBLEM.holdExpired);
  });

  it("stops a Fan with four Tickets from holding a fifth seat", async () => {
    await signIn();
    const hold = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: adjacentFreeSeats(4) });
    const order = await api.createOrder({ holdId: hold.holdId, paymentMethod: "CARD" }, "key-1");
    clock += 2_000;
    await api.getOrder(order.orderId);

    const problem = await problemOf(
      api.createHold(MATCH, { mode: "EXPLICIT", seatIds: seatsInState("A", "301", 1) }),
    );
    expect(problem.type).toBe(PROBLEM.purchaseLimit);
  });
});
