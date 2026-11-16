import { describe, expect, it } from "vitest";
import { locate, OUTER_DEPTH } from "./layout";
import {
  acrossWalkway,
  BRIDGE,
  buildCity,
  buildLamps,
  buildSkyline,
  buildStanders,
  buildTraffic,
  buildTrees,
  buildWalkers,
  carAt,
  FAN_ZONE,
  FAN_ZONES,
  groundHeight,
  LANES,
  loopLength,
  loopPoint,
  PLAZA,
  ROAD,
  SPOTS,
  STEPS_END,
  STREET_Y,
  TEAM_BUSES,
  walkerAt,
  WALK_FROM,
  WALKWAY_WIDTH,
  WALKWAYS,
  walkwayHeight,
  walkwayPoint,
} from "./surroundings";

const depthOf = (x: number, z: number) => locate(x, z).depth;
const onCarriageway = (depth: number) =>
  (depth > ROAD.inner && depth < ROAD.medianFrom) || (depth > ROAD.medianTo && depth < ROAD.outer);

describe("the loop round the stadium", () => {
  it("stays at its depth all the way round", () => {
    const total = loopLength(136);
    for (let d = 0; d < total; d += 7) {
      const { x, z } = loopPoint(136, d);
      expect(depthOf(x, z)).toBeCloseTo(136, 6);
    }
  });

  it("comes back to where it started", () => {
    const start = loopPoint(136, 0);
    const again = loopPoint(136, loopLength(136));
    expect(again.x).toBeCloseTo(start.x);
    expect(again.z).toBeCloseTo(start.z);
  });

  it("is measured in metres: a step along it is a step on the ground", () => {
    const total = loopLength(136);
    for (let d = 0; d < total; d += 11) {
      const a = loopPoint(136, d);
      const b = loopPoint(136, d + 0.5);
      expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(0.5, 3);
      expect(Math.hypot(a.dx, a.dz)).toBeCloseTo(1);
    }
  });
});

describe("the ground", () => {
  it("is level with the pitch on the plaza and steps down to the street", () => {
    expect(groundHeight(OUTER_DEPTH + 10)).toBe(0);
    expect(groundHeight(PLAZA.edge + 0.1)).toBeLessThan(0);
    expect(groundHeight(STEPS_END)).toBe(STREET_Y);
    expect(groundHeight(400)).toBe(STREET_Y);
  });
});

describe("traffic", () => {
  const cars = buildTraffic();
  const MINUTES = 300;

  it("flows in both directions", () => {
    const ways = new Set(cars.map((car) => LANES[car.lane].direction));
    expect(ways).toEqual(new Set([1, -1]));
  });

  it("keeps every car on the road", () => {
    for (let t = 0; t < MINUTES; t += 1.7) {
      for (const car of cars) {
        const { x, z } = carAt(car, t);
        expect(onCarriageway(depthOf(x, z))).toBe(true);
      }
    }
  });

  it("drives on the right: the middle of the road is on the driver's left", () => {
    const middle = (ROAD.medianFrom + ROAD.medianTo) / 2;
    for (const car of cars) {
      const { x, z, fx, fz } = carAt(car, 12);
      const { depth } = locate(x, z);
      // Towards the middle of the road is outwards for the inner carriageway.
      const { nx, nz } = outward(x, z);
      const toMiddle = Math.sign(middle - depth);
      // Left of a heading (fx, fz), seen from above, is (fz, -fx).
      expect(Math.sign(nx * toMiddle * fz + nz * toMiddle * -fx)).toBe(1);
    }
  });

  it("moves each car at its lane's speed, with no jumps", () => {
    for (const car of cars) {
      for (let t = 0; t < MINUTES; t += 13.3) {
        const a = carAt(car, t);
        const b = carAt(car, t + 0.1);
        expect(Math.hypot(b.x - a.x, b.z - a.z)).toBeCloseTo(LANES[car.lane].speed * 0.1, 2);
      }
    }
  });

  it("points each car the way it is going", () => {
    for (const car of cars) {
      const a = carAt(car, 40);
      const b = carAt(car, 40.2);
      const moved = Math.hypot(b.x - a.x, b.z - a.z);
      expect(((b.x - a.x) * a.fx + (b.z - a.z) * a.fz) / moved).toBeGreaterThan(0.99);
    }
  });

  it("never lets two cars in a lane touch", () => {
    for (const t of [0, 97, 211]) {
      for (let lane = 0; lane < LANES.length; lane++) {
        const inLane = cars.filter((car) => car.lane === lane).map((car) => carAt(car, t));
        for (let i = 0; i < inLane.length; i++) {
          for (let k = i + 1; k < inLane.length; k++) {
            expect(Math.hypot(inLane[i].x - inLane[k].x, inLane[i].z - inLane[k].z)).toBeGreaterThan(10);
          }
        }
      }
    }
  });

  it("is the same at the same time", () => {
    expect(carAt(cars[5], 33.3)).toEqual(carAt(cars[5], 33.3));
    expect(buildTraffic()).toEqual(cars);
  });
});

/** The unit vector pointing away from the stadium at a ground point. */
function outward(x: number, z: number): { nx: number; nz: number } {
  const here = depthOf(x, z);
  const step = 0.01;
  const gx = (depthOf(x + step, z) - here) / step;
  const gz = (depthOf(x, z + step) - here) / step;
  const length = Math.hypot(gx, gz);
  return { nx: gx / length, nz: gz / length };
}

describe("fans walking in", () => {
  const walkers = buildWalkers();

  it("come down all eight walkways", () => {
    expect(new Set(walkers.map((w) => w.walkway)).size).toBe(WALKWAYS.length);
  });

  it("walk from the edge of the map to a gate in the outer wall", () => {
    const walker = { ...walkers[0], lead: 0 };
    expect(walkerAt(walker, 0).depth).toBe(WALK_FROM);
    const walk = WALK_FROM - OUTER_DEPTH - 1.5;
    const atGate = walkerAt(walker, (walk - 0.01) / walker.speed);
    expect(atGate.depth).toBeCloseTo(OUTER_DEPTH + 1.5, 1);
    // And through the gate they start again at the far end.
    expect(walkerAt(walker, (walk + 1) / walker.speed).depth).toBeGreaterThan(WALK_FROM - 2);
  });

  it("only ever walk towards the stadium", () => {
    for (const walker of walkers.slice(0, 80)) {
      for (let t = 0; t < 600; t += 9) {
        const now = walkerAt(walker, t).depth;
        const next = walkerAt(walker, t + 1).depth;
        // Further out only when they have gone through the gate and started again.
        if (next > now) expect(now).toBeLessThan(OUTER_DEPTH + 4);
      }
    }
  });

  it("stay on their walkway", () => {
    for (const walker of walkers) {
      expect(Math.abs(walker.across)).toBeLessThan(WALKWAY_WIDTH / 2);
    }
  });

  it("cross the road on the footbridge, above the traffic", () => {
    for (const walker of walkers) {
      for (let t = 0; t < 400; t += 2.3) {
        const { depth, y } = walkerAt(walker, t);
        const point = walkwayPoint(WALKWAYS[walker.walkway], depth, walker.across);
        const at = depthOf(point.x, point.z);
        if (at > ROAD.inner - 1 && at < ROAD.outer + 1) expect(y).toBe(BRIDGE.deckY);
      }
    }
  });

  it("are on the plaza before the bridge and on the street after it", () => {
    expect(walkwayHeight(OUTER_DEPTH + 5)).toBe(0);
    expect(walkwayHeight(BRIDGE.to + 5)).toBe(STREET_Y);
    expect(walkwayHeight((BRIDGE.from + BRIDGE.deckFrom) / 2)).toBeCloseTo(BRIDGE.deckY / 2);
  });

  it("grow in as they appear and shrink away at the gate, so nobody pops", () => {
    const walker = { ...walkers[0], lead: 0 };
    expect(walkerAt(walker, 0).size).toBe(0);
    expect(walkerAt(walker, 60).size).toBe(1);
  });
});

describe("the plaza", () => {
  const standers = buildStanders();

  it("has food trucks and stalls on the plaza, clear of the walkways", () => {
    expect(SPOTS.filter((s) => s.kind === "truck").length).toBeGreaterThanOrEqual(4);
    expect(SPOTS.filter((s) => s.kind === "stall").length).toBeGreaterThanOrEqual(4);
    for (const { x, z } of SPOTS) {
      const depth = depthOf(x, z);
      expect(depth).toBeGreaterThan(OUTER_DEPTH + 10);
      expect(depth).toBeLessThan(BRIDGE.from);
      expect(acrossWalkway(x, z)).toBeGreaterThan(WALKWAY_WIDTH / 2 + 4);
    }
  });

  it("gathers standing fans at a counter or in a fan zone, and nowhere else", () => {
    for (const { x, z } of standers) {
      const atCounter = SPOTS.some((s) => Math.hypot(x - s.x, z - s.z) < 12);
      const inZone = FAN_ZONES.some((zone) => Math.hypot(x - zone.x, z - zone.z) < FAN_ZONE.wide);
      expect(atCounter || inZone).toBe(true);
      expect(acrossWalkway(x, z)).toBeGreaterThan(WALKWAY_WIDTH / 2);
    }
  });

  it("has a group at every counter and a crowd in each fan zone", () => {
    for (const s of SPOTS) {
      expect(standers.filter(({ x, z }) => Math.hypot(x - s.x, z - s.z) < 12).length).toBeGreaterThanOrEqual(8);
    }
    for (const zone of FAN_ZONES) {
      const crowd = standers.filter(({ x, z }) => Math.hypot(x - zone.x, z - zone.z) < FAN_ZONE.wide);
      expect(crowd.length).toBeGreaterThanOrEqual(40);
      // They are looking at the screen, which is on the stadium side.
      for (const fan of crowd) expect(fan.fx * zone.nx + fan.fz * zone.nz).toBeCloseTo(-1);
    }
  });

  it("parks the two team buses by the west wall, off the walkway", () => {
    expect(TEAM_BUSES.map((bus) => bus.team).sort()).toEqual(["away", "home"]);
    for (const { x, z } of TEAM_BUSES) {
      expect(x).toBeLessThan(0);
      expect(depthOf(x, z)).toBeLessThan(OUTER_DEPTH + 20);
      expect(acrossWalkway(x, z)).toBeGreaterThan(WALKWAY_WIDTH / 2 + 6);
    }
  });
});

describe("trees and lamps", () => {
  const { pines, palms } = buildTrees();
  const lamps = buildLamps();

  it("plants both pines and palms, in numbers", () => {
    expect(pines.length).toBeGreaterThan(200);
    expect(palms.length).toBeGreaterThan(200);
  });

  it("puts nothing on a carriageway, on the steps or on a walkway", () => {
    for (const { x, z } of [...pines, ...palms, ...lamps]) {
      const depth = depthOf(x, z);
      expect(onCarriageway(depth)).toBe(false);
      expect(depth > PLAZA.edge && depth < STEPS_END).toBe(false);
      expect(acrossWalkway(x, z)).toBeGreaterThan(WALKWAY_WIDTH / 2);
      expect(depth).toBeGreaterThan(OUTER_DEPTH + 4);
    }
  });

  it("stands every tree and lamp on the ground", () => {
    for (const { x, y, z } of [...pines, ...palms, ...lamps]) {
      expect(y).toBe(groundHeight(depthOf(x, z)));
    }
  });

  it("keeps trees and lamps out of the food trucks, the fan zones and the buses", () => {
    for (const { x, z } of [...pines, ...lamps]) {
      for (const s of SPOTS) expect(Math.hypot(x - s.x, z - s.z)).toBeGreaterThan(8);
      for (const bus of TEAM_BUSES) expect(Math.hypot(x - bus.x, z - bus.z)).toBeGreaterThan(8);
      for (const zone of FAN_ZONES) expect(Math.hypot(x - zone.x, z - zone.z)).toBeGreaterThan(16);
    }
  });

  it("never stands a lamp inside a tree", () => {
    for (const lamp of lamps) {
      for (const tree of [...pines, ...palms]) {
        expect(Math.hypot(lamp.x - tree.x, lamp.z - tree.z)).toBeGreaterThan(2);
      }
    }
  });

  it("is the same on every visit", () => {
    expect(buildTrees()).toEqual({ pines, palms });
    expect(buildLamps()).toEqual(lamps);
  });
});

describe("the city", () => {
  const city = buildCity();
  const skyline = buildSkyline();

  it("starts beyond the trees and leaves the walkways open", () => {
    expect(city.length).toBeGreaterThan(500);
    for (const { x, z } of city) {
      const depth = depthOf(x, z);
      expect(depth).toBeGreaterThanOrEqual(250);
      if (depth < 880) expect(acrossWalkway(x, z)).toBeGreaterThan(WALKWAY_WIDTH);
    }
  });

  it("rings the horizon with a skyline on every side", () => {
    const quarters = new Set(skyline.map(({ x, z }) => `${Math.sign(x)},${Math.sign(z)}`));
    expect(quarters.size).toBe(4);
    for (const { x, z, tall } of skyline) {
      expect(Math.hypot(x, z)).toBeGreaterThan(1900);
      expect(tall).toBeGreaterThan(20);
    }
  });
});
