import { describe, expect, it } from "vitest";
import { generateSeatMap } from "@/lib/api/mock/seat-map";
import { blockOutline, MAP_BOUNDS } from "./minimap";
import { viewReducer } from "./view";
import { seatView } from "./view-score";

const map = generateSeatMap(1);
const block = (id: string) => map.blocks.find((b) => b.id === id)!;

describe("view score", () => {
  it("is between 0 and 100 for every Block, front Row and back", () => {
    for (const b of map.blocks) {
      for (const row of [1, b.rowSeats.length]) {
        const { score } = seatView(b, row, 1);
        expect(score).toBeGreaterThanOrEqual(0);
        expect(score).toBeLessThanOrEqual(100);
      }
    }
  });

  it("rates the halfway line above a seat behind the goal on the same Level", () => {
    const side = seatView(block("207"), 6, 12).score; // club Level, middle of the west side
    const end = seatView(block("217"), 6, 12).score; // club Level, behind the north goal
    expect(side).toBeGreaterThan(end + 10);
  });

  it("rates the back of the upper Level in a corner lowest of these", () => {
    const best = seatView(block("207"), 6, 12).score;
    const far = seatView(block("312"), 28, 1).score;
    expect(far).toBeLessThan(best - 25);
  });

  it("gives the front Row of the west side as 8 metres from the pitch", () => {
    expect(seatView(block("107"), 1, 9).toPitch).toBe(8);
  });

  it("puts every seat further from the pitch than the Row in front", () => {
    const b = block("107");
    expect(seatView(b, 20, 9).toPitch).toBeGreaterThan(seatView(b, 2, 9).toPitch);
  });
});

describe("mini-map", () => {
  it("draws every Block as a closed outline inside the map", () => {
    for (const b of map.blocks) {
      const path = blockOutline(b);
      expect(path.startsWith("M")).toBe(true);
      expect(path.endsWith("Z")).toBe(true);
      for (const pair of path.slice(1, -1).split("L")) {
        const [x, y] = pair.split(" ").map(Number);
        expect(Math.abs(x)).toBeLessThan(MAP_BOUNDS.halfWidth);
        expect(Math.abs(y)).toBeLessThan(MAP_BOUNDS.halfHeight);
      }
    }
  });

  it("puts north at the top: a Block behind the north goal is above the middle", () => {
    const [, y] = blockOutline(block("116")).slice(1).split("L")[0].split(" ").map(Number);
    expect(y).toBeLessThan(0);
  });
});

describe("view", () => {
  it("can go straight back to the stadium from a seat", () => {
    const seated = { kind: "seat", blockId: "214", row: 7, seat: 12 } as const;
    expect(viewReducer(seated, { type: "stadium" })).toEqual({ kind: "stadium" });
  });
});
