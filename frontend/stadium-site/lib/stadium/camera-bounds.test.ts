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
  overTheStadium,
  STADIUM_COME_IN,
  STADIUM_LOWEST_TILT,
  STADIUM_MIN_DISTANCE,
  stadiumMaxDistance,
  standTop,
} from "./camera-bounds";
import { FACADE_HEIGHT, locate, OUTER_DEPTH, PITCH } from "./layout";
import { randomFrom } from "./random";
import { buildCity } from "./surroundings";

type Point = [number, number, number];

const blocks = generateSeatMap(1).blocks;
const rows = {} as Record<Level, number>;
for (const block of blocks) rows[block.level] = block.rowSeats.length;

/** How the rig checks the stadium view, a Block's view, and a flight. */
const STADIUM = { margin: 4, comeIn: STADIUM_COME_IN };
const BLOCK = { margin: 1.5, inside: true };
const SOLID = { margin: 0.5 };

/** The stadium view looks at this point, and its zoom is measured from it. */
const target: Point = [0, 10, 0];
const max = stadiumMaxDistance(stadiumFitDistance(16 / 9));
const far = (p: Point) => Math.hypot(p[0] - target[0], p[1] - target[1], p[2] - target[2]);

/** The x of a point on the east side at a given depth, level with the centre line. */
const east = (depth: number) => PITCH.width / 2 + 8 + depth;
const insideTheWall = ([x, , z]: Point) => locate(x, z).depth < OUTER_DEPTH;
/** True for a camera that is down outside the wall, looking at the outside of it. */
const downOutside = ([x, y, z]: Point) => locate(x, z).depth > OUTER_DEPTH && y < FACADE_HEIGHT + 6;

/** The point at a distance from the target, on the line of sight through `p`. */
const onLine = (p: Point, distance: number): Point => {
  const scale = distance / far(p);
  return [p[0] * scale, 10 + (p[1] - 10) * scale, p[2] * scale];
};

/** A point round the stadium: `turn` from the south, `tilt` above level, `distance` from the target. */
const around = (turn: number, tilt: number, distance: number): Point => [
  Math.sin(turn) * Math.cos(tilt) * distance,
  10 + Math.sin(tilt) * distance,
  Math.cos(turn) * Math.cos(tilt) * distance,
];

/** What the rig does with a move: where the camera ends up, or where it was if it has nowhere to go. */
const move = (asked: Point, was: Point): Point =>
  holdClear(rows, target, asked, was, STADIUM, STADIUM_MIN_DISTANCE, max) ?? was;

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
    for (const clearance of [STADIUM, SOLID]) {
      expect(isClear(rows, [east(52), FACADE_HEIGHT + 4, 0], clearance)).toBe(false);
      expect(isClear(rows, [east(OUTER_DEPTH), 20, 0], clearance)).toBe(false);
    }
    expect(isClear(rows, [east(OUTER_DEPTH + 5), 30, 0], STADIUM)).toBe(false);
  });

  it("stays above the trees, lamps and footbridges outside", () => {
    expect(isClear(rows, [east(170), OUTSIDE_FLOOR - 1, 0], STADIUM)).toBe(false);
    expect(isClear(rows, [east(170), OUTSIDE_FLOOR + 1, 0], STADIUM)).toBe(true);
  });

  it("keeps a Block's camera inside the bowl", () => {
    expect(isClear(rows, [east(100), 60, 0], BLOCK)).toBe(false);
    expect(isClear(rows, [east(52), FACADE_HEIGHT + 20, 0], BLOCK)).toBe(false);
    expect(isClear(rows, [east(10), 30, 0], BLOCK)).toBe(true);
  });
});

describe("coming in to the stadium", () => {
  it("lets a camera that is close be only in the air over the stadium", () => {
    // 150 m from the middle of the pitch, 40 m up, out over the plaza: open air, but not allowed.
    const overPlaza: Point = [147, 40, 0];
    expect(far(overPlaza)).toBeLessThan(STADIUM_COME_IN);
    expect(isClear(rows, overPlaza, SOLID)).toBe(true);
    expect(isClear(rows, overPlaza, STADIUM)).toBe(false);
    // The same height from further back is the view from outside.
    expect(isClear(rows, [210, 40, 0], STADIUM)).toBe(true);
  });

  it("counts the bowl, the open roof and a widening funnel above the roof as over the stadium", () => {
    expect(overTheStadium([0, 20, 0], 4)).toBe(true);
    expect(overTheStadium([0, 300, 0], 4)).toBe(true);
    expect(overTheStadium([east(50), 36, 0], 4)).toBe(true);
    // Just over the roof ring, and further out the higher it is.
    expect(overTheStadium([east(60), FACADE_HEIGHT + 11, 0], 4)).toBe(true);
    expect(overTheStadium([east(100), FACADE_HEIGHT + 11, 0], 4)).toBe(false);
    expect(overTheStadium([east(100), FACADE_HEIGHT + 40, 0], 4)).toBe(true);
    // Down beside the wall is not over the stadium at any distance.
    expect(overTheStadium([east(80), 30, 0], 4)).toBe(false);
  });

  it("is open all the way in along the opening view's line of sight", () => {
    for (const aspect of [16 / 9, 0.46]) {
      const opening = stadiumPose(aspect).position;
      for (let distance = far(opening); distance >= STADIUM_MIN_DISTANCE; distance -= 2) {
        expect(isClear(rows, onLine(opening, distance), STADIUM), `${distance} m`).toBe(true);
      }
    }
  });

  it("stops a low zoom from outside where the whole wall still fits the view", () => {
    const low = around(0.7, STADIUM_LOWEST_TILT, 320);
    const held = move(onLine(low, 60), low);
    expect(far(held)).toBeGreaterThanOrEqual(STADIUM_COME_IN - 0.5);
    expect(far(held)).toBeLessThan(STADIUM_COME_IN + 1);
  });
});

describe("the views the camera lands in", () => {
  it("opens on a clear view of the stadium, on a wide screen and on a phone", () => {
    for (const aspect of [2.2, 16 / 9, 1, 0.46]) {
      const { position } = stadiumPose(aspect);
      expect(isClear(rows, position, STADIUM)).toBe(true);
      expect(far(position)).toBeGreaterThan(STADIUM_MIN_DISTANCE);
      expect(far(position)).toBeLessThan(stadiumMaxDistance(stadiumFitDistance(aspect)));
    }
  });

  it("looks at every Block from inside the bowl", () => {
    for (const block of blocks) {
      expect(isClear(rows, blockPose(block).position, BLOCK), `Block ${block.id}`).toBe(true);
    }
  });
});

describe("the city under the camera", () => {
  it("is always below the lowest the stadium view can go", () => {
    // The view looks at a point 10 m over the pitch and tilts no lower than
    // STADIUM_LOWEST_TILT, so its height grows with its distance.
    for (const { x, z, wide, deep, tall } of buildCity()) {
      const nearest = Math.hypot(x, z) - Math.hypot(wide, deep) / 2;
      const lowest = 10 + nearest * Math.sin(STADIUM_LOWEST_TILT);
      expect(lowest).toBeGreaterThan(tall + 4);
    }
  });
});

describe("a solid stadium", () => {
  it("leaves a clear camera where it is", () => {
    const position: Point = [150, 200, 250];
    const held = holdClear(rows, target, position, position, STADIUM, 30, 600)!;
    held.forEach((value, i) => expect(value).toBeCloseTo(position[i]));
  });

  it("stops a camera zooming in low from outside before the outer wall, however far it jumps", () => {
    // Low in the east, 260 m out. In one go it asks for the upper Level,
    // then the lower Level, then the far side of the pitch.
    for (const wanted of [east(40), east(8), 20]) {
      const pushed: Point = [wanted, 10 + (14 * wanted) / 90, 0];
      const held = holdClear(rows, target, pushed, onLine(pushed, 260), STADIUM, 20, 600)!;
      expect(isClear(rows, held, STADIUM)).toBe(true);
      // Still outside the wall: not in the stand, and not through it.
      expect(held[0]).toBeGreaterThan(east(OUTER_DEPTH));
    }
  });

  it("stops a camera inside the bowl at the terraces when it backs into them", () => {
    const pushed: Point = [east(30), 13, 0];
    const held = holdClear(rows, target, pushed, onLine(pushed, 30), STADIUM, 20, 600)!;
    expect(isClear(rows, held, STADIUM)).toBe(true);
    expect(held[0]).toBeLessThan(east(16));
    expect(held[0]).toBeGreaterThan(30);
  });

  it("lets the camera through the open roof, where nothing is in the way", () => {
    // From high outside to the air over the pitch, on one steep line of sight.
    const inside: Point = [30, 50, 40];
    const held = holdClear(rows, target, inside, onLine(inside, 300), STADIUM, 20, 600)!;
    held.forEach((value, i) => expect(value).toBeCloseTo(inside[i]));
  });

  it("brings a camera in the bowl in towards the pitch when turning swings it into a stand", () => {
    // 75 m from the middle is over the goal at the ends, but in the stand at the sides.
    const was: Point = [0, 16, 75];
    const swung: Point = [75, 16, 0];
    expect(isClear(rows, was, STADIUM)).toBe(true);
    expect(isClear(rows, swung, STADIUM)).toBe(false);
    const held = holdClear(rows, target, swung, was, STADIUM, 20, 600)!;
    expect(isClear(rows, held, STADIUM)).toBe(true);
    expect(far(held)).toBeLessThan(75);
  });

  it("leaves a camera in the bowl where it was, sooner than put it outside", () => {
    // Side on and low, with a zoom limit that will not let it in over the pitch.
    const was: Point = [0, 16, 75];
    const swung: Point = [75, 16, 0];
    expect(holdClear(rows, target, swung, was, STADIUM, 70, 600)).toBeNull();
  });

  it("has no answer for a line of sight that runs into the concrete", () => {
    // From the middle of a Block, down and back into the stand.
    const onStand: Point = [east(10), standTop(rows, 10), 0];
    const above: Point = [east(10) - 25, standTop(rows, 10) + 25, 0];
    const below: Point = [east(40), standTop(rows, 10) - 20, 0];
    expect(holdClear(rows, onStand, below, above, BLOCK, 10, 110)).toBeNull();
  });

  it("respects the zoom limits", () => {
    const close: Point = [0.5, 10.5, 0.7];
    const tooClose = holdClear(rows, target, close, onLine(close, 100), STADIUM, 70, 600)!;
    expect(far(tooClose)).toBeCloseTo(70);
    const distant: Point = [1500, 1600, 2100];
    const tooFar = holdClear(rows, target, distant, onLine(distant, 400), STADIUM, 70, 600)!;
    expect(far(tooFar)).toBeCloseTo(600);
  });
});

describe("turning the stadium view", () => {
  /**
   * Spins the camera once round the stadium the way dragging does: each
   * small turn asks for the same distance in a new direction, and the rig
   * holds it clear. Returns every place the camera stood.
   */
  function spin(from: Point, tilt: number): Point[] {
    const stood: Point[] = [];
    let was = from;
    const turn0 = Math.atan2(from[0], from[2]);
    for (let step = 1; step <= 240; step++) {
      was = move(around(turn0 + (step / 240) * Math.PI * 2, tilt, far(was)), was);
      stood.push(was);
    }
    return stood;
  }

  /** Tilts the camera from where it is down to level, a little at a time, as a slow drag does. */
  function tiltDown(from: Point): Point[] {
    const stood: Point[] = [];
    let was = from;
    const turn = Math.atan2(from[0], from[2]);
    const tilt0 = Math.asin((from[1] - 10) / far(from));
    for (let step = 1; step <= 120; step++) {
      const tilt = tilt0 + (STADIUM_LOWEST_TILT - tilt0) * (step / 120);
      was = move(around(turn, tilt, far(was)), was);
      stood.push(was);
    }
    return stood;
  }

  it("keeps a camera that is in the bowl in the bowl, all the way round, at every tilt", () => {
    // Over the south goal, as far back as the stand allows, from nearly level to steep.
    for (const tilt of [STADIUM_LOWEST_TILT, 0.15, 0.3, 0.5, 0.8]) {
      for (const distance of [45, 60, 72]) {
        const from = around(0, tilt, distance);
        if (!isClear(rows, from, STADIUM)) continue;
        for (const point of spin(from, tilt)) {
          expect(isClear(rows, point, STADIUM)).toBe(true);
          expect(insideTheWall(point), `tilt ${tilt}, from ${distance} m`).toBe(true);
        }
      }
    }
  });

  it("comes in towards the pitch when a stand is in the way, and looks across at the far stand", () => {
    // Nearly level, 72 m back over the south goal. Side on, 72 m is inside the club Level.
    const tilt = STADIUM_LOWEST_TILT;
    const from = around(0, tilt, 72);
    expect(isClear(rows, from, STADIUM)).toBe(true);
    // 240 steps to a full turn, so the 60th is a quarter of the way round.
    const sideOn = spin(from, tilt)[59];
    expect(Math.abs(sideOn[2])).toBeLessThan(1);
    // Closer in than it was, and still at least the zoom limit from the middle.
    expect(far(sideOn)).toBeLessThan(65);
    expect(far(sideOn)).toBeGreaterThanOrEqual(STADIUM_MIN_DISTANCE);
    expect(insideTheWall(sideOn)).toBe(true);
  });

  it("comes down into the bowl when a zoomed-in camera tilts down, slowly or in one move", () => {
    // Zoomed in along the opening view until the bowl fills the screen, on
    // every side: the camera is over the roof, or just outside it. Then down.
    for (let i = 0; i < 24; i++) {
      const turn = (i / 24) * Math.PI * 2;
      for (const distance of [90, 110, 130, 150, 173, 190]) {
        const from = around(turn, 0.54, distance);
        expect(isClear(rows, from, STADIUM), `side ${i}, ${distance} m`).toBe(true);

        const slowly = tiltDown(from);
        for (const point of slowly) {
          expect(isClear(rows, point, STADIUM)).toBe(true);
          expect(downOutside(point), `side ${i}, ${distance} m`).toBe(false);
        }
        expect(insideTheWall(slowly[slowly.length - 1]), `side ${i}, ${distance} m`).toBe(true);

        const atOnce = move(around(turn, STADIUM_LOWEST_TILT, distance), from);
        expect(isClear(rows, atOnce, STADIUM)).toBe(true);
        expect(insideTheWall(atOnce), `side ${i}, ${distance} m, in one move`).toBe(true);
      }
    }
  });

  it("never puts a camera that has come in down outside the wall, whatever it does", () => {
    const random = randomFrom(2026);
    let tried = 0;
    while (tried < 3000) {
      // Anywhere the stadium view can be, close in.
      const was = around(random() * Math.PI * 2, 0.08 + random() * 1.4, 30 + random() * 169);
      if (!isClear(rows, was, STADIUM)) continue;
      tried++;
      // A turn of any size at the same distance, as dragging gives.
      const asked = around(random() * Math.PI * 2, 0.08 + random() * 1.49, far(was));
      const held = move(asked, was);
      expect(isClear(rows, held, STADIUM)).toBe(true);
      expect(downOutside(held)).toBe(false);
      expect(far(held)).toBeLessThan(STADIUM_COME_IN);
    }
  });

  it("lets a camera in the bowl out by zooming out through the open roof, and only that way", () => {
    // Low over the south goal, looking up the pitch: zooming out runs into the stand behind it.
    const low: Point = [0, 16, 60];
    expect(insideTheWall(move([0, 40, 300], low))).toBe(true);
    // Steeply over the pitch, the same zoom goes up and out through the roof.
    const out = move([0, 300, 180], [0, 44, 20]);
    expect(isClear(rows, out, STADIUM)).toBe(true);
    expect(out[1]).toBeGreaterThan(250);
  });

  it("lets a camera outside go all the way round low, and never pulls it in", () => {
    for (const tilt of [STADIUM_LOWEST_TILT, 0.2, 0.35]) {
      for (const distance of [STADIUM_COME_IN + 1, 240, 400]) {
        const from = around(0, tilt, distance);
        expect(isClear(rows, from, STADIUM)).toBe(true);
        for (const point of spin(from, tilt)) {
          expect(far(point)).toBeCloseTo(distance, 3);
          expect(insideTheWall(point)).toBe(false);
        }
      }
    }
  });

  it("does not pull in a camera that is high above the stadium when it turns", () => {
    // Straight down from 300 m, then round to the opening view's angle in one move.
    const above: Point = [0, 310, 5];
    const asked = onLine(stadiumPose(16 / 9).position, far(above));
    const held = move(asked, above);
    held.forEach((value, i) => expect(value).toBeCloseTo(asked[i]));
  });
});

describe("flights", () => {
  /** Every point of a flight that is not right at an end. */
  const middle = (from: Point, to: Point, lift: number) =>
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
        expect(isClear(rows, point, SOLID), `Block ${block.id}`).toBe(true);
      }
    }
  });

  it("arcs over the roof when it starts low outside the wall", () => {
    const from: Point = [east(170), OUTSIDE_FLOOR + 2, 0];
    // A Block in the east stand: the straight line there goes through the wall.
    const block = blocks.find((b) => b.id === "119")!;
    const to = blockPose(block).position;
    const lift = flightLift(rows, from, to);
    expect(lift).toBeGreaterThan(0);
    for (const point of middle(from, to, lift)) {
      expect(isClear(rows, point, SOLID)).toBe(true);
    }
  });

  it("leaves a seat for the opening view without cutting through the stand above it", () => {
    const block = blocks.find((b) => b.id === "107")!;
    const from = seatPose(block, 12, 6).position;
    const to = stadiumPose(16 / 9).position;
    const lift = flightLift(rows, from, to);
    for (const point of middle(from, to, lift)) {
      expect(isClear(rows, point, SOLID)).toBe(true);
    }
  });
});
