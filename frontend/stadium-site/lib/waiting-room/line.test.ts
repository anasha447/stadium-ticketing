import { PerspectiveCamera, Vector3 } from "three";
import { describe, expect, it } from "vitest";
import type { WaitingRoomStatus } from "@/lib/domain/types";
import {
  arrange,
  crowdSpot,
  FAN_TOP,
  fansAdmitted,
  fansPerFigure,
  figureSpot,
  framing,
  GATE_BOX,
  inSight,
  LINE_FIGURES,
  LINE_FRONT,
  linePoint,
  slotOf,
  SPACING,
} from "./line";

const queued = (position: number, drawnPosition = 1_800, waiting = 3_600): WaitingRoomStatus => ({
  phase: "QUEUED",
  position,
  drawnPosition,
  waiting,
  admittedPerSecond: 200,
});

describe("the line", () => {
  it("starts at the turnstile, facing the gate", () => {
    const front = linePoint(0);
    expect(front).toMatchObject({ x: 0, z: LINE_FRONT });
    expect(front.fz).toBeCloseTo(-1);
  });

  it("keeps the figures about one spacing apart", () => {
    for (let slot = 1; slot < LINE_FIGURES; slot++) {
      const a = linePoint(slot - 1);
      const b = linePoint(slot);
      const gap = Math.hypot(b.x - a.x, b.z - a.z);
      expect(gap).toBeGreaterThan(SPACING * 0.95);
      expect(gap).toBeLessThan(SPACING * 1.05);
    }
  });

  it("winds to both sides on the way out", () => {
    const xs = Array.from({ length: LINE_FIGURES }, (_, slot) => linePoint(slot).x);
    expect(Math.min(...xs)).toBeLessThan(-1);
    expect(Math.max(...xs)).toBeGreaterThan(1);
  });

  it("faces every figure along the line, towards the one ahead", () => {
    for (let slot = 1; slot < LINE_FIGURES; slot++) {
      const { x, z, fx, fz } = linePoint(slot);
      const ahead = linePoint(slot - 1);
      const toAhead = (ahead.x - x) * fx + (ahead.z - z) * fz;
      expect(toAhead).toBeGreaterThan(0);
      expect(Math.hypot(fx, fz)).toBeCloseTo(1);
    }
  });

  it("walks figures who have gone through straight into the gate, out of sight", () => {
    expect(linePoint(-1)).toMatchObject({ x: 0, fz: -1 });
    expect(linePoint(-1).z).toBeLessThan(LINE_FRONT);
    expect(inSight(linePoint(-1))).toBe(true);
    expect(inSight(linePoint(-12))).toBe(false);
  });

  it("scatters the crowd over the plaza before the Draw, clear of the turnstiles", () => {
    for (let i = 0; i < LINE_FIGURES; i++) {
      const spot = crowdSpot(i);
      expect(spot.z).toBeGreaterThan(LINE_FRONT + 3);
      expect(Math.abs(spot.x)).toBeLessThanOrEqual(15);
      expect(crowdSpot(i)).toEqual(spot);
    }
  });
});

describe("figures and places", () => {
  it("fits the whole Waiting Room into the line", () => {
    expect(fansPerFigure(3_600)).toBe(75);
    expect(slotOf(3_600, fansPerFigure(3_600))).toBe(LINE_FIGURES - 1);
    expect(fansPerFigure(10)).toBe(1);
  });

  it("puts place 1 at the front", () => {
    expect(slotOf(1, 75)).toBe(0);
    expect(slotOf(75, 75)).toBe(0);
    expect(slotOf(76, 75)).toBe(1);
  });

  it("stands everyone about on the plaza until the Draw", () => {
    expect(arrange(undefined, null)).toEqual({ kind: "crowd" });
    expect(arrange({ phase: "NOT_JOINED", waiting: 3_600 }, null)).toEqual({ kind: "crowd" });
    expect(
      arrange({ phase: "WAITING", waiting: 3_600, drawAt: "2026-11-17T10:00:00Z" }, null),
    ).toEqual({ kind: "crowd" });
  });

  it("gives this Fan the figure of the place they drew, the further back the further out", () => {
    const near = arrange(queued(50, 50), null);
    const far = arrange(queued(3_000, 3_000), null);
    expect(near).toEqual({ kind: "line", fan: 0, gone: 0 });
    expect(far).toEqual({ kind: "line", fan: 39, gone: 0 });
  });

  it("moves the line up as the place counts down, this Fan with it", () => {
    const start = arrange(queued(1_800), null);
    const later = arrange(queued(900), null);
    if (start.kind !== "line" || later.kind !== "line") throw new Error("expected a line");
    expect(later.fan).toBe(start.fan);
    expect(later.gone).toBe(12);
    expect(figureSpot(later.fan, later)).toEqual(linePoint(slotOf(900, 75)));
  });

  it("sends the front figures through the gate as Fans ahead are let in", () => {
    const line = arrange(queued(900), null);
    expect(figureSpot(0, line).z).toBeLessThan(LINE_FRONT);
    expect(figureSpot(0, line).fz).toBe(-1);
  });

  it("keeps an admitted Fan at the turnstile", () => {
    const admitted: WaitingRoomStatus = {
      phase: "ADMITTED",
      drawnPosition: 1_800,
      admissionExpiresAt: "2026-11-17T10:30:00Z",
    };
    expect(figureSpot(23, arrange(admitted, 23))).toEqual(linePoint(0));
    // Arriving already admitted there was no Draw to watch: they are at the front.
    expect(arrange(admitted, null)).toEqual({ kind: "line", fan: 0, gone: 0 });
  });
});

describe("the gate board", () => {
  it("counts the Fans ahead who have gone in, and nothing before the Draw", () => {
    expect(fansAdmitted(undefined)).toBeNull();
    expect(fansAdmitted({ phase: "NOT_JOINED", waiting: 3_600 })).toBeNull();
    expect(fansAdmitted(queued(1_800))).toBe(0);
    expect(fansAdmitted(queued(1_200))).toBe(600);
    expect(
      fansAdmitted({ phase: "ADMITTED", drawnPosition: 1_800, admissionExpiresAt: "2026-11-17T10:30:00Z" }),
    ).toBe(1_800);
  });
});

describe("the camera", () => {
  /** True when every point lands inside the picture the camera takes. */
  function inFrame(aspect: number, fan: { x: number; z: number }): boolean {
    const fov = 40;
    const { position, target } = framing(fan, aspect, fov);
    const camera = new PerspectiveCamera(fov, aspect, 0.5, 2_000);
    camera.position.set(...position);
    camera.lookAt(...target);
    camera.updateMatrixWorld();
    const points = [...GATE_BOX, [fan.x, 0, fan.z], [fan.x, FAN_TOP, fan.z]];
    return points.every(([x, y, z]) => {
      const p = new Vector3(x, y, z).project(camera);
      return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && p.z < 1;
    });
  }

  it.each([16 / 10, 4 / 3, 9 / 16])("keeps the gate and this Fan in frame at aspect %f", (aspect) => {
    for (const slot of [0, 10, 24, LINE_FIGURES - 1]) {
      expect(inFrame(aspect, linePoint(slot))).toBe(true);
    }
  });

  it("comes closer as this Fan nears the gate", () => {
    const distance = (slot: number) => {
      const { position, target } = framing(linePoint(slot), 16 / 10, 40);
      return Math.hypot(...position.map((v, i) => v - target[i]));
    };
    expect(distance(0)).toBeLessThan(distance(24));
    expect(distance(24)).toBeLessThan(distance(LINE_FIGURES - 1));
  });

  it("looks down on the plaza from in front", () => {
    const { position, target } = framing(linePoint(10), 16 / 10, 40);
    expect(position[1]).toBeGreaterThan(target[1]);
    expect(position[2]).toBeGreaterThan(target[2]);
  });
});
