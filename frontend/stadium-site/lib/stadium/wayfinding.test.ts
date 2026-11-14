import { describe, expect, it } from "vitest";
import { generateSeatMap } from "@/lib/api/mock/seat-map";
import { blockOutline, MAP_BOUNDS, mapStep } from "./minimap";
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

describe("mini-map arrow keys", () => {
  const step = (from: string, key: Parameters<typeof mapStep>[2]) => mapStep(map.blocks, from, key);

  it("go round the ring to the next Block on the same Level", () => {
    const next = block(step("107", "ArrowRight"));
    const before = block(step("107", "ArrowLeft"));
    expect(next.level).toBe("LOWER");
    expect(before.level).toBe("LOWER");
    expect(next.position).toBe(block("107").position + 1);
    expect(before.position).toBe(block("107").position - 1);
  });

  it("wrap round at the end of the ring", () => {
    const last = map.blocks.find((b) => b.level === "CLUB" && b.position === 39)!;
    const first = map.blocks.find((b) => b.level === "CLUB" && b.position === 0)!;
    expect(step(last.id, "ArrowRight")).toBe(first.id);
    expect(step(first.id, "ArrowLeft")).toBe(last.id);
  });

  it("reach every Block of a Level in 40 steps", () => {
    const seen = new Set<string>();
    let at = "101";
    for (let i = 0; i < 40; i++) {
      seen.add(at);
      at = step(at, "ArrowRight");
    }
    expect(seen.size).toBe(40);
    expect(at).toBe("101");
  });

  it("move out and in between Levels at the same place", () => {
    const club = block(step("107", "ArrowUp"));
    expect(club.level).toBe("CLUB");
    expect(club.position).toBe(block("107").position);
    expect(block(step(club.id, "ArrowUp")).level).toBe("UPPER");
    expect(step(club.id, "ArrowDown")).toBe("107");
  });

  it("stay put past the outer and inner Levels, or from an unknown Block", () => {
    const upper = step(step("107", "ArrowUp"), "ArrowUp");
    expect(step(upper, "ArrowUp")).toBe(upper);
    expect(step("107", "ArrowDown")).toBe("107");
    expect(step("999", "ArrowRight")).toBe("999");
  });
});
