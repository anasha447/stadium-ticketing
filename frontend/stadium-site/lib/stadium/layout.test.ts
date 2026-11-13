import { describe, expect, it } from "vitest";
import { generateSeatMap } from "@/lib/api/mock/seat-map";
import { LEVEL_PROFILE, OUTER_DEPTH, PITCH, ringPoint, rowPlace, seatPlace } from "./layout";

const map = generateSeatMap(1);
const block = (id: string) => map.blocks.find((b) => b.id === id)!;
const distance = (a: { x: number; z: number }, b: { x: number; z: number }) =>
  Math.hypot(a.x - b.x, a.z - b.z);

describe("ring", () => {
  it("puts the long sides west and east, and the ends behind the goals", () => {
    const west = ringPoint(6, 0); // middle of the west side
    expect(west.x).toBeCloseTo(-(PITCH.width / 2 + 8));
    expect(west.z).toBeCloseTo(0);
    expect([west.nx, west.nz]).toEqual([expect.closeTo(-1), expect.closeTo(0)]);

    const north = ringPoint(16, 0); // middle of the north end
    expect(north.x).toBeCloseTo(0);
    expect(north.z).toBeCloseTo(-(PITCH.length / 2 + 10));

    expect(ringPoint(26, 0).x).toBeGreaterThan(0); // east
    expect(ringPoint(36, 0).z).toBeGreaterThan(0); // south
  });

  it("is one closed, unbroken loop with no jumps where sides meet", () => {
    const step = 0.01;
    let longest = 0;
    for (let position = 0; position < 40; position += step) {
      longest = Math.max(longest, distance(ringPoint(position, 20), ringPoint(position + step, 20)));
    }
    // 0.01 of a Block is about 12 cm at this depth; a seam would be metres.
    expect(longest).toBeLessThan(0.2);
    expect(distance(ringPoint(0, 20), ringPoint(40, 20))).toBeCloseTo(0);
  });

  it("always points away from the pitch", () => {
    for (let position = 0; position < 40; position += 0.5) {
      const p = ringPoint(position, 10);
      expect(Math.hypot(p.nx, p.nz)).toBeCloseTo(1);
      expect(p.x * p.nx + p.z * p.nz).toBeGreaterThan(0);
    }
  });

  it("never comes closer to the pitch than the run-off", () => {
    for (let position = 0; position < 40; position += 0.25) {
      const p = ringPoint(position, 0);
      const outsideX = Math.abs(p.x) - PITCH.width / 2;
      const outsideZ = Math.abs(p.z) - PITCH.length / 2;
      expect(Math.max(outsideX, outsideZ)).toBeGreaterThan(3);
    }
  });
});

describe("Levels", () => {
  it("stack: each one starts behind and above the one in front", () => {
    const lowerTop = rowPlace("LOWER", 24);
    const clubFront = rowPlace("CLUB", 1);
    const clubTop = rowPlace("CLUB", 12);
    const upperFront = rowPlace("UPPER", 1);
    const upperTop = rowPlace("UPPER", 28);

    expect(clubFront.depth).toBeGreaterThan(lowerTop.depth);
    expect(clubFront.y).toBeGreaterThan(lowerTop.y);
    expect(upperFront.depth).toBeGreaterThan(clubTop.depth);
    expect(upperFront.y).toBeGreaterThan(clubTop.y);
    expect(upperTop.depth).toBeLessThan(OUTER_DEPTH);
  });

  it("get steeper as they go up", () => {
    const slope = (level: keyof typeof LEVEL_PROFILE) =>
      LEVEL_PROFILE[level].riser / LEVEL_PROFILE[level].tread;
    expect(slope("CLUB")).toBeGreaterThan(slope("LOWER"));
    expect(slope("UPPER")).toBeGreaterThan(slope("CLUB"));
  });
});

describe("seats", () => {
  it("sit about half a metre apart in every Block and Row", () => {
    for (const b of map.blocks) {
      for (const row of [1, b.rowSeats.length]) {
        const gap = distance(seatPlace(b, row, 1), seatPlace(b, row, 2));
        expect(gap).toBeGreaterThan(0.4);
        expect(gap).toBeLessThan(0.7);
      }
    }
  });

  it("leave an aisle between neighbouring Blocks", () => {
    const a = block("107");
    const b = block("108");
    const lastOfA = seatPlace(a, 1, a.rowSeats[0]);
    const firstOfB = seatPlace(b, 1, 1);
    const within = distance(seatPlace(a, 1, 1), seatPlace(a, 1, 2));
    expect(distance(lastOfA, firstOfB)).toBeGreaterThan(within * 2);
  });

  it("rise Row by Row and move away from the pitch", () => {
    const b = block("107");
    const front = seatPlace(b, 1, 5);
    const back = seatPlace(b, 24, 5);
    expect(back.y).toBeGreaterThan(front.y);
    expect(Math.abs(back.x)).toBeGreaterThan(Math.abs(front.x));
  });

  it("are all in different places", () => {
    const b = block("301");
    const seen = new Set<string>();
    b.rowSeats.forEach((seats, r) => {
      for (let seat = 1; seat <= seats; seat++) {
        const p = seatPlace(b, r + 1, seat);
        seen.add(`${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`);
      }
    });
    expect(seen.size).toBe(b.rowSeats.reduce((sum, n) => sum + n, 0));
  });
});
