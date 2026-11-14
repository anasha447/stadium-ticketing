import { beforeEach, describe, expect, it } from "vitest";
import { areAdjacent, parseSeatId, seatOffset } from "@/lib/domain/seat-id";
import type { Block, SeatDelta } from "@/lib/domain/types";
import {
  BUY_SHARE,
  CATCH_UP_MS,
  DECIDE_MAX_MS,
  noOtherFans,
  OTHER_HOLDS_PER_SECOND,
  type OtherFans,
  stepOtherFans,
} from "./other-fans";
import { generateSeatMap } from "./seat-map";
import { soldSeats } from "./sold-seats";

const MATCH = 1;
const START = Date.parse("2026-11-14T10:00:00Z");

const blocks = generateSeatMap(MATCH).blocks;
const base = soldSeats(MATCH, 0.5).blocks;
const blockOf = (id: string) => blocks.find((block) => block.id === id)!;

/** A repeatable stream of numbers in [0, 1), so a test sees the same Fans every run. */
function seeded(seed: number): () => number {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The state a seat is in now, with the other Fans' changes applied. */
function stateOf(others: OtherFans, seatId: string, from = base): string {
  const ref = parseSeatId(seatId)!;
  const states = others.blocks[ref.blockId] ?? from[ref.blockId];
  return states[seatOffset(blockOf(ref.blockId), ref.row, ref.seat)];
}

const seatsOf = (deltas: SeatDelta[], state: string) =>
  deltas.filter((delta) => delta.state === state).flatMap((delta) => delta.seatIds);

let others: OtherFans;
let random: () => number;
let now: number;

function step(ms: number, mine: ReadonlySet<string> = new Set()): SeatDelta[] {
  now += ms;
  return stepOtherFans(others, { blocks, base, mine, now, random });
}

beforeEach(() => {
  now = START;
  others = noOtherFans(now);
  random = seeded(7);
});

describe("the other Fans", () => {
  it("hold seats that were available, at the set rate", () => {
    const deltas = step(1000);

    expect(deltas.map((delta) => delta.state)).toEqual(["H"]);
    expect(others.holds).toHaveLength(OTHER_HOLDS_PER_SECOND);
    for (const seatId of seatsOf(deltas, "H")) {
      expect(stateOf({ ...others, blocks: {} }, seatId)).toBe("A");
      expect(stateOf(others, seatId)).toBe("H");
    }
  });

  it("hold 1 to 4 seats together in one Row", () => {
    for (let second = 0; second < 30; second++) step(1000);

    for (const hold of others.holds) {
      expect(hold.seatIds.length).toBeGreaterThanOrEqual(1);
      expect(hold.seatIds.length).toBeLessThanOrEqual(4);
      expect(areAdjacent(hold.seatIds.map((seatId) => parseSeatId(seatId)!))).toBe(true);
    }
  });

  it("never hold a seat twice", () => {
    const held = new Set<string>();
    for (let second = 0; second < 60; second++) {
      const deltas = step(1000);
      for (const seatId of [...seatsOf(deltas, "A"), ...seatsOf(deltas, "S")]) held.delete(seatId);
      for (const seatId of seatsOf(deltas, "H")) {
        expect(held.has(seatId)).toBe(false);
        held.add(seatId);
      }
    }
  });

  it("buy most of what they hold and let the rest go", () => {
    for (let second = 0; second < 120; second++) step(1000);
    const started = others.holds.length;
    expect(started).toBeGreaterThan(0);

    // Jump to when every Hold is due, without giving new ones time to start.
    now += DECIDE_MAX_MS;
    others.at = now;
    const deltas = step(0);

    expect(others.holds).toHaveLength(0);
    const sold = seatsOf(deltas, "S");
    const letGo = seatsOf(deltas, "A");
    for (const seatId of sold) expect(stateOf(others, seatId)).toBe("S");
    for (const seatId of letGo) expect(stateOf(others, seatId)).toBe("A");
    const share = sold.length / (sold.length + letGo.length);
    expect(share).toBeGreaterThan(BUY_SHARE - 0.15);
    expect(share).toBeLessThan(BUY_SHARE + 0.15);
  });

  it("report seats let go and sold before the new Holds", () => {
    for (let second = 0; second < 60; second++) {
      const order = step(1000).map((delta) => "ASH".indexOf(delta.state));
      expect(order).toEqual([...order].sort());
      expect(new Set(order).size).toBe(order.length);
    }
  });

  it("never take a seat this Fan holds", () => {
    // One short Row, and this Fan has the two seats in the middle.
    const small: Block[] = [{ ...blockOf("107"), rowSeats: [4] }];
    const mine = new Set(["107-R01-02", "107-R01-03"]);
    const lone = noOtherFans(START);
    const taken = new Set<string>();
    for (let second = 1; second <= 200; second++) {
      const deltas = stepOtherFans(lone, {
        blocks: small,
        base: { "107": "AAAA" },
        mine,
        now: START + second * 1000,
        random,
      });
      for (const seatId of seatsOf(deltas, "H")) taken.add(seatId);
    }
    expect([...taken].sort()).toEqual(["107-R01-01", "107-R01-04"]);
  });

  it("do nothing in a stadium that is sold out", () => {
    const full: Record<string, string> = {};
    for (const [id, states] of Object.entries(base)) full[id] = "S".repeat(states.length);
    const deltas = stepOtherFans(others, { blocks, base: full, mine: new Set(), now: START + 5000, random });
    expect(deltas).toEqual([]);
    expect(others.holds).toHaveLength(0);
  });

  it("make up for only a few seconds after a long pause", () => {
    step(60 * 60_000);
    expect(others.holds.length).toBeLessThanOrEqual((OTHER_HOLDS_PER_SECOND * CATCH_UP_MS) / 1000 + 1);
    expect(others.holds.length).toBeGreaterThan(0);
  });

  it("keep the rate when called more often than once a second", () => {
    for (let quarter = 0; quarter < 400; quarter++) step(250);
    const started = others.holds.length;
    // 100 seconds: 600 Holds started, and the ones older than 40 seconds are decided.
    expect(started).toBeGreaterThan(60);
    expect(started).toBeLessThan(OTHER_HOLDS_PER_SECOND * 40 + 1);
  });
});
