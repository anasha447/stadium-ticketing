import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseSeatId, seatOffset } from "@/lib/domain/seat-id";
import type { SeatDelta } from "@/lib/domain/types";
import { applyDeltas } from "@/lib/stadium/live-seats";
import { ApiProblem, PROBLEM } from "../problem";
import type { StadiumApi } from "../stadium-api";
import { createMockApi, DRAW_DELAY_MS, OTHER_FANS_EVERY_MS } from "./mock-api";
import { DECIDE_MAX_MS, OTHER_HOLDS_PER_SECOND } from "./other-fans";
import { generateSeatMap } from "./seat-map";
import { createMemoryStore, type MockStore } from "./store";

const MATCH = 1;
const NOT_ON_SALE = 2;

const blocks = new Map(generateSeatMap(MATCH).blocks.map((block) => [block.id, block]));

/** A repeatable stream of numbers in [0, 1). */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let clock: number;
let store: MockStore;
let api: StadiumApi;
let deltas: SeatDelta[];
let opens: number;
let stop: () => void;

/** Lets time pass, a second at a time, on the mock's clock and on the timers. */
function pass(ms: number) {
  for (let done = 0; done < ms; done += OTHER_FANS_EVERY_MS) {
    clock += OTHER_FANS_EVERY_MS;
    vi.advanceTimersByTime(OTHER_FANS_EVERY_MS);
  }
}

function watch(matchId = MATCH) {
  stop = api.watchSeats(matchId, {
    onOpen: () => opens++,
    onDelta: (delta) => deltas.push(delta),
  });
}

const seatsIn = (state: string) =>
  deltas.filter((delta) => delta.state === state).flatMap((delta) => delta.seatIds);

async function stateOf(seatId: string): Promise<string> {
  const ref = parseSeatId(seatId)!;
  const states = await api.getSeatStates(MATCH, [ref.blockId]);
  return states.blocks[ref.blockId][seatOffset(blocks.get(ref.blockId)!, ref.row, ref.seat)];
}

beforeEach(async () => {
  vi.useFakeTimers();
  clock = Date.parse("2026-11-14T10:00:00Z");
  store = createMemoryStore();
  // The Draw gives this Fan the first place, so they are admitted at once.
  api = createMockApi({ store, now: () => clock, random: () => 0 });
  await api.joinWaitingRoom(MATCH);
  clock += DRAW_DELAY_MS + 1_000;
  // From here on the other Fans get a mixed, repeatable run of chances.
  api = createMockApi({ store, now: () => clock, random: seeded(11) });
  deltas = [];
  opens = 0;
  stop = () => {};
});

afterEach(() => {
  stop();
  vi.useRealTimers();
});

describe("Match stream", () => {
  it("opens a moment after it is asked for, and only once", () => {
    watch();
    expect(opens).toBe(0);
    pass(3_000);
    expect(opens).toBe(1);
  });

  it("sends the seats other Fans hold", () => {
    watch();
    pass(2_000);

    expect(deltas.every((delta) => delta.state === "H")).toBe(true);
    const held = seatsIn("H");
    expect(held.length).toBeGreaterThanOrEqual(OTHER_HOLDS_PER_SECOND * 2);
    expect(new Set(held).size).toBe(held.length);
  });

  it("later sends the same seats as sold or available again", () => {
    watch();
    pass(1_000);
    const held = seatsIn("H");
    deltas = [];

    pass(DECIDE_MAX_MS);
    const decided = new Set([...seatsIn("S"), ...seatsIn("A")]);
    for (const seatId of held) expect(decided.has(seatId)).toBe(true);
    expect(seatsIn("S").length).toBeGreaterThan(0);
  });

  it("matches what the Seat States say, so a snapshot plus the changes is the truth", async () => {
    const before = await api.getSeatStates(MATCH);
    watch();
    pass(60_000);

    const after = await api.getSeatStates(MATCH);
    expect(applyDeltas(before.blocks, deltas, blocks)).toEqual(after.blocks);
  });

  it("is counted in the occupancy", async () => {
    const before = await api.getOccupancy(MATCH);
    watch();
    pass(60_000);
    stop();

    const after = await api.getOccupancy(MATCH);
    const { blocks: states } = await api.getSeatStates(MATCH);
    const all = Object.values(states).join("");
    const count = (state: string) => all.split(state).length - 1;
    expect(after.held).toBe(count("H"));
    expect(after.sold).toBe(count("S"));
    expect(after.available).toBe(count("A"));
    expect(after.held).toBeGreaterThan(0);
    expect(after.sold).toBeGreaterThan(before.sold);
    expect(after.available + after.held + after.sold).toBe(
      before.available + before.held + before.sold,
    );
  });

  it("refuses this Fan a seat another Fan holds", async () => {
    watch();
    pass(1_000);
    const [theirs] = seatsIn("H");

    try {
      await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: [theirs] });
      throw new Error("Expected the Hold to be refused");
    } catch (error) {
      if (!(error instanceof ApiProblem)) throw error;
      expect(error.type).toBe(PROBLEM.seatsUnavailable);
      expect(error.conflictingSeatIds).toEqual([theirs]);
    }
  });

  it("never touches the seats this Fan holds", async () => {
    const { blocks: states } = await api.getSeatStates(MATCH, ["107"]);
    const block = blocks.get("107")!;
    // The first two available seats next to each other in the front Row.
    const first = states["107"].slice(0, block.rowSeats[0]).indexOf("AA") + 1;
    const mine = [`107-R01-${String(first).padStart(2, "0")}`, `107-R01-${String(first + 1).padStart(2, "0")}`];
    await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: mine });

    watch();
    pass(120_000);

    expect(deltas.flatMap((delta) => delta.seatIds).filter((id) => mine.includes(id))).toEqual([]);
    expect(await stateOf(mine[0])).toBe("H");
    expect(await stateOf(mine[1])).toBe("H");
  });

  it("goes quiet once it is closed", () => {
    watch();
    pass(2_000);
    stop();
    const seen = deltas.length;
    pass(10_000);
    expect(deltas).toHaveLength(seen);
  });

  it("never opens if it is closed straight away", () => {
    watch();
    stop();
    pass(2_000);
    expect(opens).toBe(0);
  });

  it("keeps what the other Fans did for the next visit", async () => {
    watch();
    pass(30_000);
    stop();
    const left = await api.getSeatStates(MATCH);

    const again = createMockApi({ store, now: () => clock, random: seeded(3) });
    expect(await again.getSeatStates(MATCH)).toEqual(left);
  });

  it("stays silent for a Match that is not on sale", () => {
    watch(NOT_ON_SALE);
    pass(5_000);
    expect(opens).toBe(1);
    expect(deltas).toEqual([]);
  });
});
