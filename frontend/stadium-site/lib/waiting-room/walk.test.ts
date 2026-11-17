import { describe, expect, it } from "vitest";
import type { WaitingRoomStatus } from "@/lib/domain/types";
import {
  arrange,
  crowdSpot,
  fanSpot,
  INSIDE,
  inSight,
  LINE_FRONT,
  linePoint,
  OTHERS,
  otherSpot,
  type Spot,
} from "./line";
import { fadeAt, PACE, step, TOP_PACE, type Walker } from "./walk";

const queued = (position: number, drawnPosition: number): WaitingRoomStatus => ({
  phase: "QUEUED",
  position,
  drawnPosition,
  waiting: 3_600,
  admittedPerSecond: 200,
});

const key = ({ x, z }: Spot) => `${x.toFixed(3)},${z.toFixed(3)}`;

describe("sharing the line with this Fan", () => {
  it("gives every other figure a place of its own, and never this Fan's", () => {
    for (const status of [queued(1_800, 1_800), queued(40, 1_800), queued(3_600, 3_600), queued(1, 1)]) {
      const line = arrange(status, null);
      const mine = key(fanSpot(line, false));
      const taken = new Set<string>();
      for (let k = 0; k < OTHERS; k++) {
        const spot = otherSpot(k, line);
        // Figures that have gone through all walk the same way in; only count those outside.
        if (spot.z < LINE_FRONT) continue;
        expect(key(spot)).not.toBe(mine);
        expect(taken.has(key(spot))).toBe(false);
        taken.add(key(spot));
      }
    }
  });

  it("keeps the line unbroken behind and ahead of this Fan", () => {
    const line = arrange(queued(1_800, 1_800), null);
    if (line.kind !== "line") throw new Error("expected a line");
    const slots = new Set<string>([key(fanSpot(line, false))]);
    for (let k = 0; k < OTHERS; k++) slots.add(key(otherSpot(k, line)));
    for (let slot = 0; slot < OTHERS + 1; slot++) expect(slots.has(key(linePoint(slot)))).toBe(true);
  });

  it("stands this Fan in the crowd before the Draw, and sends them down the passage when they go in", () => {
    const crowd = arrange(undefined, null);
    expect(fanSpot(crowd, false)).toEqual(crowdSpot(OTHERS));
    expect(fanSpot(arrange(queued(10, 10), null), true)).toEqual(INSIDE);
    expect(inSight(INSIDE)).toBe(false);
  });
});

describe("walking", () => {
  const at = (x: number, z: number): Walker => ({ x, z, fx: 0, fz: -1, walking: false });
  const to: Spot = { x: 0, z: 0, fx: 0, fz: -1 };

  it("walks at the walking pace over a short way", () => {
    const walker = at(0, 0.5);
    step(walker, to, 0.1, PACE, false);
    expect(walker.z).toBeCloseTo(0.5 - PACE * 0.1);
    expect(walker.walking).toBe(true);
  });

  it("hurries over a long way, but no faster than the top pace", () => {
    const walker = at(0, 40);
    step(walker, to, 0.1, PACE, false);
    expect(40 - walker.z).toBeCloseTo(TOP_PACE * 0.1);
  });

  it("arrives and stops without overshooting, however long the frame", () => {
    const walker = at(0, 0.3);
    step(walker, to, 5, PACE, false);
    expect(walker).toMatchObject({ x: 0, z: 0, walking: false });
  });

  it("gets across the plaza in a few seconds at the Draw", () => {
    const walker = at(14, 36);
    let seconds = 0;
    while ((walker.x !== to.x || walker.z !== to.z) && seconds < 20) {
      step(walker, to, 1 / 60, PACE, false);
      seconds += 1 / 60;
    }
    expect(seconds).toBeLessThan(8);
  });

  it("faces where it walks, turning a little each frame", () => {
    const walker = at(0, 0);
    walker.fx = 0;
    walker.fz = 1;
    step(walker, { x: 10, z: 0, fx: 0, fz: 1 }, 1 / 60, PACE, false);
    // Turning towards +x, but not all the way in one frame.
    expect(walker.fx).toBeGreaterThan(0);
    expect(walker.fx).toBeLessThan(1);
    expect(Math.hypot(walker.fx, walker.fz)).toBeCloseTo(1);
  });

  it("jumps straight there with reduced motion", () => {
    const walker = at(14, 36);
    step(walker, { x: 1, z: 5, fx: 1, fz: 0 }, 1 / 60, PACE, true);
    expect(walker).toEqual({ x: 1, z: 5, fx: 1, fz: 0, walking: false });
  });
});

describe("going in", () => {
  it("fades a figure into the light of the way in, and not before the turnstiles", () => {
    expect(fadeAt(LINE_FRONT)).toBe(0);
    expect(fadeAt(0)).toBeGreaterThan(0);
    expect(fadeAt(0)).toBeLessThan(1);
    expect(fadeAt(INSIDE.z)).toBe(1);
  });
});
