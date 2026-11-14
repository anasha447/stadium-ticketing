import { PITCH } from "./layout";

// The match on the pitch: 22 players, a referee and a ball. It is a loop
// made of sums, not a simulation: where everyone is depends only on the
// time, so it is the same on every screen and can be tested. Nobody scores,
// and there is no scoreboard to read a result from.

export type Kit = "home" | "away" | "keeper" | "referee";

export interface Figure {
  kit: Kit;
  x: number;
  z: number;
  /** Which way they face, as a turn about the vertical. They watch the ball. */
  turn: number;
}

export interface MatchMoment {
  /** 11 home players, 11 away players, then the referee. */
  figures: Figure[];
  ball: { x: number; y: number; z: number };
}

const HALF_W = PITCH.width / 2;
const HALF_L = PITCH.length / 2;
/** Nobody stands on a line. */
const MARGIN = 0.6;

// Where each player stands with the ball in the centre circle, for a side
// defending the north goal. x is across the pitch (-1 to 1), z along it
// (-1 is their own goal line). The keeper is first.
const HOME_SHAPE: [number, number][] = [
  [0, -0.92],
  [-0.7, -0.55], [-0.25, -0.62], [0.25, -0.62], [0.7, -0.55],
  [-0.45, -0.2], [0, -0.3], [0.45, -0.2],
  [-0.6, 0.25], [0, 0.35], [0.6, 0.25],
];
const AWAY_SHAPE: [number, number][] = [
  [0, -0.92],
  [-0.7, -0.55], [-0.25, -0.62], [0.25, -0.62], [0.7, -0.55],
  [-0.7, -0.15], [-0.25, -0.25], [0.25, -0.25], [0.7, -0.15],
  [-0.25, 0.3], [0.25, 0.3],
];

const clamp = (value: number, limit: number) => Math.max(-limit, Math.min(limit, value));

/** The ball wanders the pitch on slow waves that never quite line up, so play does not visibly repeat. */
function ballAt(t: number) {
  const x = HALF_W * 0.84 * (0.7 * Math.sin(0.21 * t) + 0.3 * Math.sin(0.37 * t + 1));
  const z = HALF_L * 0.9 * (0.75 * Math.sin(0.13 * t + 2) + 0.25 * Math.sin(0.29 * t));
  // Mostly on the grass, now and then a lofted pass.
  const lift = Math.max(0, Math.sin(0.5 * t));
  return { x, y: 0.3 + 2.4 * lift ** 6, z };
}

function player(
  index: number,
  shape: [number, number],
  side: 1 | -1,
  ball: { x: number; z: number },
  t: number,
): { x: number; z: number } {
  const keeper = shape[1] < -0.9;
  // The side's shape, turned round for the team defending the south goal.
  let x = side * shape[0] * HALF_W * 0.9;
  let z = side * shape[1] * HALF_L;

  // The whole side slides towards the ball; a keeper barely leaves the goal.
  x += ball.x * (keeper ? 0.08 : 0.25);
  z += ball.z * (keeper ? 0.04 : 0.35);

  // Everyone keeps moving a little.
  x += 2.5 * Math.sin(0.31 * t + index * 1.7);
  z += 2.5 * Math.sin(0.27 * t + index * 2.3);

  // Whoever is near the ball goes to it, each to their own side of it.
  if (!keeper) {
    const distance = Math.hypot(ball.x - x, ball.z - z);
    const pull = 0.85 * Math.exp(-((distance / 9) ** 2));
    x += (ball.x + 0.9 * Math.cos(index * 2.4) - x) * pull;
    z += (ball.z + 0.9 * Math.sin(index * 2.4) - z) * pull;
  }

  return { x: clamp(x, HALF_W - MARGIN), z: clamp(z, HALF_L - MARGIN) };
}

/** Where everyone is `seconds` into the loop. */
export function matchAt(seconds: number): MatchMoment {
  const ball = ballAt(seconds);
  const figures: Figure[] = [];
  const add = (kit: Kit, at: { x: number; z: number }) =>
    figures.push({ kit, ...at, turn: Math.atan2(ball.x - at.x, ball.z - at.z) });

  HOME_SHAPE.forEach((shape, i) =>
    add(i === 0 ? "keeper" : "home", player(i, shape, 1, ball, seconds)),
  );
  AWAY_SHAPE.forEach((shape, i) =>
    add(i === 0 ? "keeper" : "away", player(i + 11, shape, -1, ball, seconds)),
  );

  // The referee trails the play, circling a few metres off the ball.
  add("referee", {
    x: clamp(ball.x * 0.8 + 7 * Math.cos(0.17 * seconds), HALF_W - MARGIN),
    z: clamp(ball.z * 0.8 + 7 * Math.sin(0.17 * seconds), HALF_L - MARGIN),
  });

  return { figures, ball };
}

/** With reduced motion the match is a still picture: this moment of it. */
export const STILL_MOMENT = 12;
