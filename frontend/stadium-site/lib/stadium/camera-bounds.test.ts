import { describe, expect, it } from "vitest";
import { generateSeatMap } from "@/lib/api/mock/seat-map";
import type { Level } from "@/lib/domain/types";
import { blockPose, seatPose, stadiumFitDistance, stadiumPose } from "./camera";
import {
  flightLift,
  flightPoint,
  holdClear,
  isClear,
  OUTSIDE_FLOOR,
  STADIUM_MIN_DISTANCE,
  stadiumMaxDistance,
  standTop,
} from "./camera-bounds";
import { FACADE_HEIGHT, OUTER_DEPTH, PITCH } from "./layout";

const blocks = generateSeatMap(1).blocks;
const rows = {} as Record<Level, number>;
for (const block of blocks) rows[block.level] = block.rowSeats.length;

const STADIUM = { margin: 4 };
const BLOCK = { margin: 1.5, inside: true };

/** The x of a point on the east side at a given depth, level with the centre line. */
const east = (depth: number) => PITCH.width / 2 + 8 + depth;

describe("the concrete", () => {
  it("is flat over the pitch and climbs with every Row", () => {
    expect(standTop(rows, -20)).toBe(0);
    expect(standTop(rows, 1)).toBeLessThan(standTop(rows, 10));
    expect(standTop(rows, 10)).toBeLessThan(standTop(rows, 25));
    expect(standTop(rows, 25)).toBeLessThan(standTop(rows, 50));
  });

  it("reaches the top of the outer wall", () => {
    expect(standTop(rows, OUTER_DEPTH)).toBeCloseTo(FACADE_HEIGHT);
  });
});

describe("where the camera may be", () => {
  it("is free over the pitch and high above the stadium", () => {
    expect(isClear(rows, [0, 30, 0], STADIUM)).toBe(true);
    expect(isClear(rows, [150, 200, 250], STADIUM)).toBe(true);
  });

  it("is never under the ground or skimming it", () => {
    expect(isClear(rows, [0, -5, 0], STADIUM)).toBe(false);
    expect(isClear(rows, [0, 1, 0], STADIUM)).toBe(false);
    expect(isClear(rows, [400, -1, 0], STADIUM)).toBe(false);
  });

  it("is never inside the terraces", () => {
    // Half way up the lower, club and upper Levels, a metre under the steps.
    for (const depth of [10, 26, 45]) {
      expect(isClear(rows, [east(depth), standTop(rows, depth) - 1, 0], STADIUM)).toBe(false);
      expect(isClear(rows, [east(depth), standTop(rows, depth) + 0.5, 0], BLOCK)).toBe(false);
    }
  });

  it("is never in the roof, the outer wall or the gap just outside it", () => {
    expect(isClear(rows, [east(52), FACADE_HEIGHT + 4, 0], STADIUM)).toBe(false);
    expect(isClear(rows, [east(OUTER_DEPTH), 20, 0], STADIUM)).toBe(false);
    expect(isClear(rows, [east(OUTER_DEPTH + 5), 30, 0], STADIUM)).toBe(false);
  });

  it("stays above the trees, lamps and footbridges outside", () => {
    expect(isClear(rows, [east(100), OUTSIDE_FLOOR - 1, 0], STADIUM)).toBe(false);
    expect(isClear(rows, [east(100), OUTSIDE_FLOOR + 1, 0], STADIUM)).toBe(true);
  });

  it("keeps a Block's camera inside the bowl", () => {
    expect(isClear(rows, [east(100), 60, 0], BLOCK)).toBe(false);
    expect(isClear(rows, [east(52), FACADE_HEIGHT + 20, 0], BLOCK)).toBe(false);
    expect(isClear(rows, [east(10), 30, 0], BLOCK)).toBe(true);
  });
});

describe("the views the camera lands in", () => {
  it("opens on a clear view of the stadium, on a wide screen and on a phone", () => {
    for (const aspect of [2.2, 16 / 9, 1, 0.46]) {
      const { position } = stadiumPose(aspect);
      expect(isClear(rows, position, STADIUM)).toBe(true);
      const distance = Math.hypot(position[0], position[1] - 10, position[2]);
      expect(distance).toBeGreaterThan(STADIUM_MIN_DISTANCE);
      expect(distance).toBeLessThan(stadiumMaxDistance(stadiumFitDistance(aspect)));
    }
  });

  it("looks at every Block from inside the bowl", () => {
    for (const block of blocks) {
      expect(isClear(rows, blockPose(block).position, BLOCK), `Block ${block.id}`).toBe(true);
    }
  });
});

describe("a solid stadium", () => {
  const target: [number, number, number] = [0, 10, 0];
  const far = (p: [number, number, number]) => Math.hypot(p[0] - target[0], p[1] - target[1], p[2] - target[2]);

  it("leaves a clear camera where it is", () => {
    const position: [number, number, number] = [150, 200, 250];
    const held = holdClear(rows, target, position, far(position), STADIUM, 70, 600)!;
    held.forEach((value, i) => expect(value).toBeCloseTo(position[i]));
  });

  it("stops a camera zooming in low from outside at the outer wall, however far it jumps", () => {
    // Low in the east, 200 m out. In one go it asks for the upper Level,
    // then the lower Level, then the far side of the pitch.
    for (const wanted of [east(40), east(8), 20]) {
      const pushed: [number, number, number] = [wanted, 10 + (14 * wanted) / 90, 0];
      const held = holdClear(rows, target, pushed, 200, STADIUM, 20, 600)!;
      expect(isClear(rows, held, STADIUM)).toBe(true);
      // Still outside the wall: not in the stand, and not through it.
      expect(held[0]).toBeGreaterThan(east(OUTER_DEPTH));
    }
  });

  it("stops a camera inside the bowl at the terraces when it backs into them", () => {
    const pushed: [number, number, number] = [east(30), 13, 0];
    const held = holdClear(rows, target, pushed, 30, STADIUM, 20, 600)!;
    expect(isClear(rows, held, STADIUM)).toBe(true);
    expect(held[0]).toBeLessThan(east(16));
    expect(held[0]).toBeGreaterThan(30);
  });

  it("lets the camera through the open roof, where nothing is in the way", () => {
    // From high outside to the air over the pitch, on one steep line of sight.
    const inside: [number, number, number] = [30, 50, 40];
    const held = holdClear(rows, target, inside, 300, STADIUM, 20, 600)!;
    held.forEach((value, i) => expect(value).toBeCloseTo(inside[i]));
  });

  it("takes the nearest clear distance when turning swings the view into the stadium", () => {
    // 125 m out is clear of the long sides but inside the south end.
    const swung: [number, number, number] = [0, 10 + 125 * 0.2, 125 * 0.98];
    const held = holdClear(rows, target, swung, 125, STADIUM, 70, 600)!;
    expect(isClear(rows, held, STADIUM)).toBe(true);
    expect(far(held)).toBeGreaterThan(125);
    expect(far(held)).toBeLessThan(160);
  });

  it("has no answer for a line of sight that runs into the concrete", () => {
    // From the middle of a Block, down and back into the stand.
    const onStand: [number, number, number] = [east(10), standTop(rows, 10), 0];
    const below: [number, number, number] = [east(40), standTop(rows, 10) - 20, 0];
    expect(holdClear(rows, onStand, below, 36, BLOCK, 10, 110)).toBeNull();
  });

  it("respects the zoom limits", () => {
    const tooClose = holdClear(rows, target, [0.5, 10.5, 0.7], 100, STADIUM, 70, 600)!;
    expect(far(tooClose)).toBeCloseTo(70);
    const tooFar = holdClear(rows, target, [1500, 1600, 2100], 400, STADIUM, 70, 600)!;
    expect(far(tooFar)).toBeCloseTo(600);
  });
});

describe("flights", () => {
  /** Every point of a flight that is not right at an end. */
  const middle = (from: [number, number, number], to: [number, number, number], lift: number) =>
    Array.from({ length: 199 }, (_, i) => flightPoint(from, to, lift, (i + 1) / 200)).filter(
      (p) =>
        Math.hypot(p[0] - from[0], p[1] - from[1], p[2] - from[2]) > 8 &&
        Math.hypot(p[0] - to[0], p[1] - to[1], p[2] - to[2]) > 8,
    );

  it("starts and ends where it was asked to", () => {
    expect(flightPoint([1, 2, 3], [7, 8, 9], 40, 0)).toEqual([1, 2, 3]);
    const end = flightPoint([1, 2, 3], [7, 8, 9], 40, 1);
    expect(end[0]).toBe(7);
    expect(end[1]).toBeCloseTo(8);
    expect(end[2]).toBe(9);
  });

  it("goes straight when nothing is in the way", () => {
    const [a, b] = [blocks[3], blocks[4]].map((block) => blockPose(block).position);
    expect(flightLift(rows, a, b)).toBe(0);
  });

  it("reaches every Block from the opening view without passing through the stadium", () => {
    const from = stadiumPose(16 / 9).position;
    for (const block of blocks) {
      const to = blockPose(block).position;
      const lift = flightLift(rows, from, to);
      for (const point of middle(from, to, lift)) {
        expect(isClear(rows, point, { margin: 0.5 }), `Block ${block.id}`).toBe(true);
      }
    }
  });

  it("arcs over the roof when it starts low outside the wall", () => {
    const from: [number, number, number] = [east(120), OUTSIDE_FLOOR + 2, 0];
    // A Block in the east stand: the straight line there goes through the wall.
    const block = blocks.find((b) => b.id === "119")!;
    const to = blockPose(block).position;
    const lift = flightLift(rows, from, to);
    expect(lift).toBeGreaterThan(0);
    for (const point of middle(from, to, lift)) {
      expect(isClear(rows, point, { margin: 0.5 })).toBe(true);
    }
  });

  it("leaves a seat for the opening view without cutting through the stand above it", () => {
    const block = blocks.find((b) => b.id === "107")!;
    const from = seatPose(block, 12, 6).position;
    const to = stadiumPose(16 / 9).position;
    const lift = flightLift(rows, from, to);
    for (const point of middle(from, to, lift)) {
      expect(isClear(rows, point, { margin: 0.5 })).toBe(true);
    }
  });
});
