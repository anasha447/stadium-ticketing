"use client";

import { useMemo } from "react";
import { ShapeGeometry } from "three";
import { COLOR } from "@/lib/design/tokens";
import { ringShape } from "@/lib/stadium/geometry";
import { PITCH } from "@/lib/stadium/layout";

// The pitch: mowing stripes, the markings at their real measurements, and two
// goals. The lines are drawn three times too wide (0.35 m, not 0.12 m) so
// they still read from the top of the stadium.

const HALF_W = PITCH.width / 2;
const HALF_L = PITCH.length / 2;
const LINE = 0.35;
const STRIPES = 18;

const PENALTY_DEPTH = 16.5;
const PENALTY_HALF_WIDTH = 20.16;
const GOAL_AREA_DEPTH = 5.5;
const GOAL_AREA_HALF_WIDTH = 9.16;
const PENALTY_SPOT = 11;
const CIRCLE_RADIUS = 9.15;
const GOAL_HALF_WIDTH = 3.66;
const GOAL_HEIGHT = 2.44;

const FLAT: [number, number, number] = [-Math.PI / 2, 0, 0];

/** A straight line on the grass, from one point to another. */
function Line({ from, to }: { from: [number, number]; to: [number, number] }) {
  const alongX = from[1] === to[1];
  const length = Math.hypot(to[0] - from[0], to[1] - from[1]) + LINE;
  return (
    <mesh
      rotation={FLAT}
      position={[(from[0] + to[0]) / 2, 0.04, (from[1] + to[1]) / 2]}
    >
      <planeGeometry args={alongX ? [length, LINE] : [LINE, length]} />
      <meshBasicMaterial color={COLOR.flood50} />
    </mesh>
  );
}

/** Part of a circle on the grass. Angles are in the ground plane, from +x towards -z. */
function Arc({
  at,
  radius,
  start = 0,
  sweep = Math.PI * 2,
}: {
  at: [number, number];
  radius: number;
  start?: number;
  sweep?: number;
}) {
  return (
    <mesh rotation={FLAT} position={[at[0], 0.04, at[1]]}>
      <ringGeometry args={[radius - LINE / 2, radius + LINE / 2, 64, 1, start, sweep]} />
      <meshBasicMaterial color={COLOR.flood50} />
    </mesh>
  );
}

function Spot({ at }: { at: [number, number] }) {
  return (
    <mesh rotation={FLAT} position={[at[0], 0.04, at[1]]}>
      <circleGeometry args={[0.45, 20]} />
      <meshBasicMaterial color={COLOR.flood50} />
    </mesh>
  );
}

/** Everything at one end. `end` is -1 for the north goal, +1 for the south. */
function End({ end }: { end: -1 | 1 }) {
  const goalLine = end * HALF_L;
  const boxLine = end * (HALF_L - PENALTY_DEPTH);
  const smallBoxLine = end * (HALF_L - GOAL_AREA_DEPTH);
  const spot = end * (HALF_L - PENALTY_SPOT);
  // The arc is the part of the circle around the spot that lies outside the box.
  const cut = Math.asin((PENALTY_DEPTH - PENALTY_SPOT) / CIRCLE_RADIUS);
  const arcStart = end === -1 ? Math.PI + cut : cut;

  return (
    <group>
      <Line from={[-PENALTY_HALF_WIDTH, boxLine]} to={[PENALTY_HALF_WIDTH, boxLine]} />
      <Line from={[-PENALTY_HALF_WIDTH, boxLine]} to={[-PENALTY_HALF_WIDTH, goalLine]} />
      <Line from={[PENALTY_HALF_WIDTH, boxLine]} to={[PENALTY_HALF_WIDTH, goalLine]} />

      <Line from={[-GOAL_AREA_HALF_WIDTH, smallBoxLine]} to={[GOAL_AREA_HALF_WIDTH, smallBoxLine]} />
      <Line from={[-GOAL_AREA_HALF_WIDTH, smallBoxLine]} to={[-GOAL_AREA_HALF_WIDTH, goalLine]} />
      <Line from={[GOAL_AREA_HALF_WIDTH, smallBoxLine]} to={[GOAL_AREA_HALF_WIDTH, goalLine]} />

      <Spot at={[0, spot]} />
      <Arc at={[0, spot]} radius={CIRCLE_RADIUS} start={arcStart} sweep={Math.PI - 2 * cut} />

      <Goal z={goalLine} end={end} />
    </group>
  );
}

function Goal({ z, end }: { z: number; end: -1 | 1 }) {
  const depth = 2;
  const post = 0.09;
  return (
    <group position={[0, 0, z]}>
      {[-GOAL_HALF_WIDTH, GOAL_HALF_WIDTH].map((x) => (
        <mesh key={x} position={[x, GOAL_HEIGHT / 2, 0]}>
          <cylinderGeometry args={[post, post, GOAL_HEIGHT, 10]} />
          <meshStandardMaterial color={COLOR.flood50} roughness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, GOAL_HEIGHT, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[post, post, GOAL_HALF_WIDTH * 2, 10]} />
        <meshStandardMaterial color={COLOR.flood50} roughness={0.4} />
      </mesh>
      {/* The net, as a faint box behind the line. */}
      <mesh position={[0, GOAL_HEIGHT / 2, (end * depth) / 2]}>
        <boxGeometry args={[GOAL_HALF_WIDTH * 2, GOAL_HEIGHT, depth, 12, 5, 4]} />
        <meshBasicMaterial color={COLOR.flood50} wireframe transparent opacity={0.28} />
      </mesh>
    </group>
  );
}

export function Pitch() {
  const surround = useMemo(() => new ShapeGeometry(ringShape(0)), []);
  const stripe = PITCH.length / STRIPES;

  return (
    <group>
      {/* The run-off between the pitch and the front Row. */}
      <mesh geometry={surround} rotation={FLAT} position={[0, 0.005, 0]}>
        <meshStandardMaterial color={COLOR.sceneTurfEdge} roughness={1} />
      </mesh>

      {Array.from({ length: STRIPES }, (_, i) => (
        <mesh key={i} rotation={FLAT} position={[0, 0.02, -HALF_L + stripe * (i + 0.5)]}>
          <planeGeometry args={[PITCH.width, stripe]} />
          <meshStandardMaterial
            color={i % 2 === 0 ? COLOR.sceneTurfLight : COLOR.sceneTurfDark}
            roughness={1}
          />
        </mesh>
      ))}

      <Line from={[-HALF_W, -HALF_L]} to={[-HALF_W, HALF_L]} />
      <Line from={[HALF_W, -HALF_L]} to={[HALF_W, HALF_L]} />
      <Line from={[-HALF_W, -HALF_L]} to={[HALF_W, -HALF_L]} />
      <Line from={[-HALF_W, HALF_L]} to={[HALF_W, HALF_L]} />
      <Line from={[-HALF_W, 0]} to={[HALF_W, 0]} />
      <Arc at={[0, 0]} radius={CIRCLE_RADIUS} />
      <Spot at={[0, 0]} />

      <End end={-1} />
      <End end={1} />
    </group>
  );
}
