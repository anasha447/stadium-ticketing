import { FAN_SHIRTS } from "./fans";
import { locate, OUTER_DEPTH, RING_CORNER } from "./layout";
import { randomFrom } from "./random";

// What is outside the stadium, in metres: a plaza, a ring road with traffic,
// walkways to the gates, trees, lamps, fans and the city beyond. Pure maths,
// no Three.js, so the things drawn and the tests work from the same numbers.
//
// Depth is measured as in layout.ts: how far out from the front of the lower
// Level. The outer wall is at depth 59, so everything here is further out.
// Nothing here is random at run time: every list is built from a fixed seed,
// and where a car or a walking fan is depends only on the time.

const { x: CX, z: CZ, radius: R } = RING_CORNER;

/** The plaza is level with the pitch. The street is a flight of steps below it. */
export const STREET_Y = -1.8;
/** The plaza starts under the stands, so no gap shows at the foot of the wall. */
export const PLAZA = { from: 50, edge: 118 };
export const STEPS = { count: 4, rise: 0.45, tread: 1.1 };
export const STEPS_END = PLAZA.edge + STEPS.count * STEPS.tread;
/** Two carriageways with a planted strip between them. */
export const ROAD = { inner: 128, medianFrom: 135, medianTo: 137, outer: 144, kerb: 0.15 };
export const ROAD_Y = STREET_Y - ROAD.kerb;
export const PAVEMENT_END = 150;
/** Where the paving of a walkway stops, and where the ground does. */
export const WALKWAY_END = 900;
export const WORLD_EDGE = 2450;

// --- The loop ---------------------------------------------------------------

export interface LoopPoint {
  x: number;
  z: number;
  /** Unit vector along the loop, clockwise seen from above. */
  dx: number;
  dz: number;
  /** Unit vector pointing away from the stadium. */
  nx: number;
  nz: number;
}

// The four straights of the bowl's plan, clockwise from the south-west. Each
// starts at a corner centre; the arc after it turns about the next one.
const STRAIGHTS = [
  { x: -CX, z: CZ, dx: 0, dz: -1, length: 2 * CZ }, // west, heading north
  { x: -CX, z: -CZ, dx: 1, dz: 0, length: 2 * CX }, // north, heading east
  { x: CX, z: -CZ, dx: 0, dz: 1, length: 2 * CZ }, // east, heading south
  { x: CX, z: CZ, dx: -1, dz: 0, length: 2 * CX }, // south, heading west
];

/** How long the way round the stadium is at a given depth. */
export function loopLength(depth: number): number {
  return 4 * CX + 4 * CZ + 2 * Math.PI * (R + depth);
}

/**
 * A point on the rounded rectangle that runs round the stadium at a given
 * depth, `distance` metres along it. Unlike ringPoint it is measured in
 * metres all the way, so something moving along it keeps a steady speed.
 */
export function loopPoint(depth: number, distance: number): LoopPoint {
  const radius = R + depth;
  const arc = (Math.PI / 2) * radius;
  const total = loopLength(depth);
  let left = ((distance % total) + total) % total;
  for (let k = 0; k < 4; k++) {
    const { x, z, dx, dz, length } = STRAIGHTS[k];
    const nx = dz;
    const nz = -dx;
    if (left <= length) {
      return { x: x + dx * left + nx * radius, z: z + dz * left + nz * radius, dx, dz, nx, nz };
    }
    left -= length;
    if (left <= arc) {
      const centre = STRAIGHTS[(k + 1) % 4];
      const angle = Math.atan2(nz, nx) + left / radius;
      const ax = Math.cos(angle);
      const az = Math.sin(angle);
      return { x: centre.x + ax * radius, z: centre.z + az * radius, dx: -az, dz: ax, nx: ax, nz: az };
    }
    left -= arc;
  }
  return loopPoint(depth, 0);
}

/** Calls `each` at evenly spaced points round the loop, about `spacing` metres apart. */
function alongLoop(
  depth: number,
  spacing: number,
  each: (point: LoopPoint) => void,
  shift = 0,
) {
  const total = loopLength(depth);
  const count = Math.round(total / spacing);
  for (let i = 0; i < count; i++) each(loopPoint(depth, ((i + shift) / count) * total));
}

/** How high the ground is at a depth: the plaza, the steps down, then the street. */
export function groundHeight(depth: number): number {
  if (depth <= PLAZA.edge) return 0;
  if (depth >= STEPS_END) return STREET_Y;
  return -STEPS.rise * (Math.floor((depth - PLAZA.edge) / STEPS.tread) + 1);
}

// --- Walkways and gates -----------------------------------------------------

export const WALKWAY_WIDTH = 12;

export interface Walkway {
  /** A point on the bowl's plan that the walkway points away from. */
  ox: number;
  oz: number;
  /** Unit vector pointing away from the stadium, along the walkway. */
  nx: number;
  nz: number;
}

const DIAGONAL = Math.SQRT1_2;

/** Eight walkways, one to each gate: the four sides and the four corners. West first, clockwise. */
export const WALKWAYS: Walkway[] = [
  { ox: -CX, oz: 0, nx: -1, nz: 0 },
  { ox: -CX, oz: -CZ, nx: -DIAGONAL, nz: -DIAGONAL },
  { ox: 0, oz: -CZ, nx: 0, nz: -1 },
  { ox: CX, oz: -CZ, nx: DIAGONAL, nz: -DIAGONAL },
  { ox: CX, oz: 0, nx: 1, nz: 0 },
  { ox: CX, oz: CZ, nx: DIAGONAL, nz: DIAGONAL },
  { ox: 0, oz: CZ, nx: 0, nz: 1 },
  { ox: -CX, oz: CZ, nx: -DIAGONAL, nz: DIAGONAL },
];

/** A point on a walkway: `depth` out from the stadium, `across` metres to one side of its middle. */
export function walkwayPoint(walkway: Walkway, depth: number, across = 0): { x: number; z: number } {
  const out = R + depth;
  return {
    x: walkway.ox + walkway.nx * out - walkway.nz * across,
    z: walkway.oz + walkway.nz * out + walkway.nx * across,
  };
}

/** How far a ground point is from the middle line of the nearest walkway. */
export function acrossWalkway(x: number, z: number): number {
  let nearest = Infinity;
  for (const { ox, oz, nx, nz } of WALKWAYS) {
    const out = (x - ox) * nx + (z - oz) * nz;
    // Only the side of the stadium the walkway is on.
    if (out < R + PLAZA.from) continue;
    nearest = Math.min(nearest, Math.abs((z - oz) * nx - (x - ox) * nz));
  }
  return nearest;
}

/**
 * Each walkway crosses the road on a footbridge, so fans and traffic never
 * meet: a ramp up from the plaza, a deck over both carriageways, and a ramp
 * down to the street on the far side.
 */
export const BRIDGE = { from: 106, deckFrom: 122, deckTo: 150, to: 172, deckY: 3.6 };

/** How high a fan on a walkway is, by depth. */
export function walkwayHeight(depth: number): number {
  const { from, deckFrom, deckTo, to, deckY } = BRIDGE;
  if (depth <= from) return 0;
  if (depth < deckFrom) return (deckY * (depth - from)) / (deckFrom - from);
  if (depth <= deckTo) return deckY;
  if (depth < to) return deckY + ((STREET_Y - deckY) * (depth - deckTo)) / (to - deckTo);
  return STREET_Y;
}

// --- Traffic ----------------------------------------------------------------

export interface Lane {
  depth: number;
  /** 1 goes clockwise seen from above, -1 the other way. */
  direction: 1 | -1;
  /** Metres per second. */
  speed: number;
}

// Traffic drives on the right, so the carriageway nearer the stadium goes
// clockwise. In each, the lane beside the planted strip is the faster one.
export const LANES: Lane[] = [
  { depth: 129.75, direction: 1, speed: 10.5 },
  { depth: 133.25, direction: 1, speed: 13.5 },
  { depth: 138.75, direction: -1, speed: 13.5 },
  { depth: 142.25, direction: -1, speed: 10.5 },
];

export const CARS_PER_LANE = 22;
/** How many paint colours there are to choose from. */
export const CAR_PAINTS = 5;

export interface Car {
  lane: number;
  /** Where on the lane it is at time zero, in metres. */
  start: number;
  paint: number;
}

/**
 * Every car in a lane drives at that lane's speed, so the gaps they start
 * with are the gaps they keep and nobody runs into the car in front.
 */
export function buildTraffic(): Car[] {
  const random = randomFrom(1899);
  const cars: Car[] = [];
  LANES.forEach((lane, index) => {
    const gap = loopLength(lane.depth) / CARS_PER_LANE;
    for (let i = 0; i < CARS_PER_LANE; i++) {
      cars.push({
        lane: index,
        start: (i + 0.6 * (random() - 0.5)) * gap,
        paint: Math.floor(random() * CAR_PAINTS),
      });
    }
  });
  return cars;
}

export interface CarPlace {
  x: number;
  z: number;
  /** Unit vector the car is driving along. */
  fx: number;
  fz: number;
}

/** Where a car is at a time, in seconds. */
export function carAt(car: Car, seconds: number): CarPlace {
  const { depth, direction, speed } = LANES[car.lane];
  const point = loopPoint(depth, car.start + direction * speed * seconds);
  return { x: point.x, z: point.z, fx: point.dx * direction, fz: point.dz * direction };
}

// --- Fans walking in --------------------------------------------------------

/** Fans appear this far out and walk to the gate in the outer wall. */
export const WALK_FROM = 420;
export const WALK_TO = OUTER_DEPTH + 1.5;
export const WALKERS_PER_WALKWAY = 100;

export interface Walker {
  walkway: number;
  /** How far to one side of the walkway's middle they keep. */
  across: number;
  /** Metres per second. */
  speed: number;
  /** How far along the walk they are at time zero, in metres. */
  lead: number;
  /** Index into FAN_SHIRTS. */
  shirt: number;
  /** Where in their stride they are at time zero, so nobody walks in step. */
  stride: number;
}

/** Mostly home shirts, with a few visiting fans among them. */
function shirtFor(chance: number): number {
  const token = chance < 0.44 ? "seatBlau" : chance < 0.88 ? "seatGrana" : chance < 0.94 ? "flood50" : "sceneKitAway";
  return FAN_SHIRTS.indexOf(token);
}

export function buildWalkers(): Walker[] {
  const random = randomFrom(1957);
  const walkers: Walker[] = [];
  WALKWAYS.forEach((_, walkway) => {
    for (let i = 0; i < WALKERS_PER_WALKWAY; i++) {
      walkers.push({
        walkway,
        across: (random() - 0.5) * (WALKWAY_WIDTH - 2.4),
        speed: 1.1 + 0.5 * random(),
        lead: random() * (WALK_FROM - WALK_TO),
        shirt: shirtFor(random()),
        stride: random() * Math.PI * 2,
      });
    }
  });
  return walkers;
}

export interface WalkerPlace {
  depth: number;
  y: number;
  /** 0 to 1: a fan grows in as they appear and shrinks away as they go through the gate. */
  size: number;
}

/** Where a walking fan is at a time, in seconds. At the gate they start again from the far end. */
export function walkerAt(walker: Walker, seconds: number): WalkerPlace {
  const walk = WALK_FROM - WALK_TO;
  const gone = (walker.lead + walker.speed * seconds) % walk;
  const depth = WALK_FROM - gone;
  return {
    depth,
    y: walkwayHeight(depth),
    size: Math.min(1, gone / 8, (walk - gone) / 2.5),
  };
}

// --- Food trucks, stalls, fan zones and the team buses ----------------------

export interface Spot {
  kind: "truck" | "stall";
  x: number;
  z: number;
  /** Unit vector the counter faces. */
  fx: number;
  fz: number;
}

function spot(kind: Spot["kind"], walkway: number, across: number, depth: number): Spot {
  const { nx, nz } = WALKWAYS[walkway];
  // The counter faces the walkway, where the fans come past.
  const towards = across > 0 ? -1 : 1;
  return { kind, ...walkwayPoint(WALKWAYS[walkway], depth, across), fx: -nz * towards, fz: nx * towards };
}

/** A food truck and a merchandise stall either side of each corner walkway, and a pair on the east side. */
export const SPOTS: Spot[] = [
  ...[1, 3, 5, 7].flatMap((walkway) => [
    spot("truck", walkway, -21, 93),
    spot("stall", walkway, 21, 93),
  ]),
  spot("truck", 4, 21, 93),
  spot("stall", 4, 35, 93),
];

export interface FanZone {
  /** The middle of the zone. */
  x: number;
  z: number;
  /** Unit vector pointing away from the stadium. The screen stands on the stadium side and faces this way. */
  nx: number;
  nz: number;
}

export const FAN_ZONE = { wide: 26, deep: 18 };

function fanZone(walkway: number, across: number, depth: number): FanZone {
  const { nx, nz } = WALKWAYS[walkway];
  return { ...walkwayPoint(WALKWAYS[walkway], depth, across), nx, nz };
}

/** Two fan zones on the plaza: north of the east walkway and north of the west one. */
export const FAN_ZONES: FanZone[] = [fanZone(4, -28, 97), fanZone(0, 28, 97)];

export interface ParkedBus {
  team: "home" | "away";
  x: number;
  z: number;
  /** Unit vector the bus points along. */
  fx: number;
  fz: number;
}

/** The players' entrance is in the west wall, south of the gate; the two team buses wait outside it. */
export const PLAYERS_ENTRANCE = { ...walkwayPoint(WALKWAYS[0], OUTER_DEPTH, -33), nx: -1, nz: 0 };
export const TEAM_BUSES: ParkedBus[] = [
  { team: "home", ...walkwayPoint(WALKWAYS[0], 71.5, -25), fx: 0, fz: -1 },
  { team: "away", ...walkwayPoint(WALKWAYS[0], 71.5, -41), fx: 0, fz: -1 },
];

/** True where the plaza is free: not on a walkway, at a counter, in a fan zone or in the bus bay. */
function plazaFree(x: number, z: number, room: number): boolean {
  if (acrossWalkway(x, z) < WALKWAY_WIDTH / 2 + room) return false;
  for (const s of SPOTS) if (Math.hypot(x - s.x, z - s.z) < 9 + room) return false;
  for (const zone of FAN_ZONES) if (Math.hypot(x - zone.x, z - zone.z) < 18 + room) return false;
  for (const bus of TEAM_BUSES) if (Math.hypot(x - bus.x, z - bus.z) < 12 + room) return false;
  return Math.hypot(x - PLAYERS_ENTRANCE.x, z - PLAYERS_ENTRANCE.z) > 14 + room;
}

// --- Things that stand still ------------------------------------------------

export interface Placed {
  x: number;
  y: number;
  z: number;
  /** Unit vector it faces, along the ground. */
  fx: number;
  fz: number;
  size: number;
}

export interface Stander extends Placed {
  /** Index into FAN_SHIRTS. */
  shirt: number;
}

/**
 * Fans who are not going anywhere yet: a queue and a couple of groups at
 * every food truck and stall, and a crowd in front of each fan zone screen.
 */
export function buildStanders(): Stander[] {
  const random = randomFrom(1974);
  const standers: Stander[] = [];
  const add = (x: number, z: number, fx: number, fz: number) => {
    const length = Math.hypot(fx, fz) || 1;
    standers.push({
      x,
      y: 0,
      z,
      fx: fx / length,
      fz: fz / length,
      size: 0.92 + 0.16 * random(),
      shirt: shirtFor(random()),
    });
  };

  for (const { x, z, fx, fz } of SPOTS) {
    // The queue, facing the counter.
    for (let i = 0; i < 5; i++) {
      const out = 2.6 + 0.8 * i;
      const drift = 0.25 * (random() - 0.5);
      add(x + fx * out - fz * drift, z + fz * out + fx * drift, -fx, -fz);
    }
    // Two small groups nearby, facing each other.
    for (const side of [-1, 1]) {
      const out = 4.5 + 3 * random();
      const along = side * (2.5 + 2 * random());
      const cx = x + fx * out - fz * along;
      const cz = z + fz * out + fx * along;
      const people = 3 + Math.floor(random() * 2);
      for (let i = 0; i < people; i++) {
        const angle = (i / people) * Math.PI * 2 + random();
        add(cx + Math.cos(angle) * 0.7, cz + Math.sin(angle) * 0.7, -Math.cos(angle), -Math.sin(angle));
      }
    }
  }

  for (const { x, z, nx, nz } of FAN_ZONES) {
    // Rows of fans in front of the screen, looking at it.
    for (let row = 0; row < 5; row++) {
      for (let place = 0; place < 9; place++) {
        const out = -2 + 2 * row + 0.8 * (random() - 0.5);
        const across = (place - 4) * 2.3 + 1.2 * (random() - 0.5);
        add(x + nx * out - nz * across, z + nz * out + nx * across, -nx, -nz);
      }
    }
  }
  return standers;
}

export interface Trees {
  pines: Placed[];
  palms: Placed[];
}

/**
 * Palms line the walkways, the kerb and the planted strip of the road; pines
 * stand along the plaza edge, round the outer pavement and in a belt beyond it.
 */
export function buildTrees(): Trees {
  const random = randomFrom(1992);
  const trees: Trees = { pines: [], palms: [] };
  const plant = (list: Placed[], x: number, z: number, y: number, small: number, large: number) => {
    const turn = random() * Math.PI * 2;
    list.push({ x, y, z, fx: Math.sin(turn), fz: Math.cos(turn), size: small + (large - small) * random() });
  };
  const beside = WALKWAY_WIDTH / 2 + 1.8;

  for (const walkway of WALKWAYS) {
    for (const side of [-1, 1]) {
      for (const depth of [70, 82, 94]) {
        const { x, z } = walkwayPoint(walkway, depth, side * beside);
        plant(trees.palms, x, z, 0, 0.85, 1.2);
      }
      for (let depth = 180; depth < WALK_FROM; depth += 24) {
        const { x, z } = walkwayPoint(walkway, depth, side * (beside + 0.6));
        plant(trees.palms, x, z, STREET_Y, 0.85, 1.25);
      }
    }
  }
  // Along the kerb on the stadium side, and down the middle of the road.
  alongLoop(126.4, 19, ({ x, z }) => {
    if (acrossWalkway(x, z) > 9) plant(trees.palms, x, z, STREET_Y, 0.9, 1.2);
  });
  alongLoop((ROAD.medianFrom + ROAD.medianTo) / 2, 15, ({ x, z }) => {
    if (acrossWalkway(x, z) > 9) plant(trees.palms, x, z, STREET_Y, 0.8, 1.05);
  });

  // Pines in planters near the edge of the plaza.
  alongLoop(110, 14, ({ x, z, nx, nz }) => {
    const out = 3 * (random() - 0.5);
    if (plazaFree(x + nx * out, z + nz * out, 3)) plant(trees.pines, x + nx * out, z + nz * out, 0, 0.8, 1.15);
  });
  alongLoop(147.8, 13, ({ x, z }) => {
    if (acrossWalkway(x, z) > 10) plant(trees.pines, x, z, STREET_Y, 0.9, 1.25);
  });
  // A belt of pines between the road and the first buildings.
  for (let i = 0; i < 320; i++) {
    const depth = 156 + 84 * random();
    const { x, z } = loopPoint(depth, random() * loopLength(depth));
    if (acrossWalkway(x, z) > 11) plant(trees.pines, x, z, STREET_Y, 0.8, 1.3);
  }
  return trees;
}

/** Street lamps: two rings on the plaza, both pavements of the road, and along every walkway. */
export function buildLamps(): Placed[] {
  const lamps: Placed[] = [];
  const stand = (x: number, z: number, y: number, fx: number, fz: number) =>
    lamps.push({ x, y, z, fx, fz, size: 1 });

  alongLoop(86, 30, ({ x, z, dx, dz }) => {
    if (plazaFree(x, z, 2)) stand(x, z, 0, dx, dz);
  });
  alongLoop(114.5, 28, ({ x, z, dx, dz }) => {
    if (acrossWalkway(x, z) > WALKWAY_WIDTH / 2 + 2) stand(x, z, 0, dx, dz);
  });
  // Half a step round from the palms and pines, so a lamp never stands in a tree.
  alongLoop(123.8, 38, ({ x, z, dx, dz }) => {
    if (acrossWalkway(x, z) > 9) stand(x, z, STREET_Y, dx, dz);
  }, 0.5);
  alongLoop(145, 39, ({ x, z, dx, dz }) => {
    if (acrossWalkway(x, z) > 9) stand(x, z, STREET_Y, dx, dz);
  }, 0.5);

  for (const walkway of WALKWAYS) {
    for (const side of [-1, 1]) {
      const across = side * (WALKWAY_WIDTH / 2 + 1.4);
      for (const depth of [76, 100]) {
        const { x, z } = walkwayPoint(walkway, depth, across);
        stand(x, z, 0, walkway.nx, walkway.nz);
      }
      for (let depth = 192; depth < WALK_FROM; depth += 48) {
        const { x, z } = walkwayPoint(walkway, depth, across);
        stand(x, z, STREET_Y, walkway.nx, walkway.nz);
      }
    }
  }
  return lamps;
}

// --- The city ---------------------------------------------------------------

export interface Building {
  x: number;
  z: number;
  /** Width, depth and height in metres. */
  wide: number;
  deep: number;
  tall: number;
}

/** Where the nearest buildings stand, and how far out the neighbourhood runs. */
const CITY = { from: 250, to: 1750, cell: 64 };

/** Low blocks on a loose grid around the stadium, thinning out with distance. */
export function buildCity(): Building[] {
  const random = randomFrom(1714);
  const buildings: Building[] = [];
  const reach = Math.ceil((CITY.to + 150) / CITY.cell);
  for (let i = -reach; i <= reach; i++) {
    for (let k = -reach; k <= reach; k++) {
      const x = (i + 0.2 + 0.6 * random()) * CITY.cell;
      const z = (k + 0.2 + 0.6 * random()) * CITY.cell;
      const wide = 24 + 20 * random();
      const deep = 24 + 20 * random();
      const height = random();
      const keep = random();
      const { depth } = locate(x, z);
      if (depth < CITY.from || depth > CITY.to) continue;
      const far = (depth - CITY.from) / (CITY.to - CITY.from);
      if (keep > 0.8 - 0.4 * far) continue;
      // The walkways stay open all the way to where their paving ends.
      if (depth < WALKWAY_END && acrossWalkway(x, z) < 34) continue;
      buildings.push({ x, z, wide, deep, tall: 9 + 22 * height * height + 16 * far * height });
    }
  }
  return buildings;
}

/** The far skyline: a ring of taller silhouettes that the fog all but swallows. */
export function buildSkyline(): Building[] {
  const random = randomFrom(1888);
  const buildings: Building[] = [];
  for (let i = 0; i < 170; i++) {
    const angle = (i / 170) * Math.PI * 2 + 0.03 * random();
    const radius = 1950 + 330 * random();
    buildings.push({
      x: Math.cos(angle) * radius,
      z: Math.sin(angle) * radius,
      wide: 50 + 80 * random(),
      deep: 50 + 40 * random(),
      tall: 30 + 110 * random() ** 3,
    });
  }
  return buildings;
}
