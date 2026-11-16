"use client";

import { useMemo } from "react";
import { type BufferGeometry, RepeatWrapping } from "three";
import { COLOR } from "@/lib/design/tokens";
import { groundUv, loopBand } from "@/lib/stadium/geometry";
import { OUTER_DEPTH, RING_CORNER } from "@/lib/stadium/layout";
import { place } from "@/lib/stadium/placing";
import {
  BRIDGE,
  FAN_ZONE,
  FAN_ZONES,
  PAVEMENT_END,
  PLAYERS_ENTRANCE,
  PLAZA,
  ROAD,
  ROAD_Y,
  STEPS,
  STEPS_END,
  STREET_Y,
  TEAM_BUSES,
  uplightScallop,
  WALKWAY_END,
  WALKWAY_WIDTH,
  WALKWAYS,
  walkwayPoint,
  WASH_REACH,
  WORLD_EDGE,
} from "@/lib/stadium/surroundings";
import { Instances } from "./instances";
import { box, drawn, join, patch } from "./painted";

// What the stadium stands on: a paved plaza level with the pitch, steps down
// to the street, a ring road with a planted strip down the middle, and the
// dark ground of the city beyond. Eight walkways cross it to the gates, each
// over the road on a footbridge.

/** Metres one repeat of the paving covers, and of the lane markings. */
const PAVING_TILE = 8;
const LANE_TILE = 12;

/** Big square slabs, every other one a shade lighter, with dark joints. */
function pavingTexture() {
  const texture = drawn(256, 256, (context) => {
    context.fillStyle = COLOR.scenePaving;
    context.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 4; i++) {
      for (let k = 0; k < 4; k++) {
        context.globalAlpha = (i + k) % 2 === 0 ? 0.22 : 0.06;
        context.fillStyle = COLOR.scenePavingLight;
        context.fillRect(i * 64 + 2, k * 64 + 2, 60, 60);
      }
    }
    context.globalAlpha = 0.5;
    context.fillStyle = COLOR.night900;
    for (let i = 0; i < 4; i++) {
      context.fillRect(i * 64 - 1, 0, 2, 256);
      context.fillRect(0, i * 64 - 1, 256, 2);
    }
  });
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** One carriageway: a line along each edge and a broken line between its two lanes. */
function roadTexture() {
  const texture = drawn(128, 64, (context) => {
    context.fillStyle = COLOR.sceneAsphalt;
    context.fillRect(0, 0, 128, 64);
    context.fillStyle = COLOR.flood300;
    context.globalAlpha = 0.55;
    context.fillRect(0, 2, 128, 2);
    context.fillRect(0, 60, 128, 2);
    context.globalAlpha = 0.8;
    context.fillRect(0, 31, 44, 2);
  });
  texture.wrapS = RepeatWrapping;
  texture.anisotropy = 8;
  return texture;
}

/** The steps from the plaza down to the street, as a cross-section. */
function stepsProfile() {
  const profile = [{ depth: PLAZA.edge, y: 0 }];
  for (let i = 0; i < STEPS.count; i++) {
    const y = -STEPS.rise * (i + 1);
    profile.push({ depth: PLAZA.edge + i * STEPS.tread, y });
    profile.push({ depth: PLAZA.edge + (i + 1) * STEPS.tread, y });
  }
  return profile;
}

/** The lighter paving of the walkways, the fan zones, the bus bay and the carpet to the players' entrance. */
function pathsShape() {
  const parts: BufferGeometry[] = [];
  for (const walkway of WALKWAYS) {
    const { nx, nz } = walkway;
    const onPlaza = walkwayPoint(walkway, (OUTER_DEPTH + PLAZA.edge) / 2);
    parts.push(
      patch("scenePavingLight", WALKWAY_WIDTH, PLAZA.edge - OUTER_DEPTH, [onPlaza.x, 0.05, onPlaza.z], nx, nz),
    );
    const from = BRIDGE.to - 3;
    const beyond = walkwayPoint(walkway, (from + WALKWAY_END) / 2);
    parts.push(
      patch("scenePavingLight", WALKWAY_WIDTH, WALKWAY_END - from, [beyond.x, STREET_Y + 0.05, beyond.z], nx, nz, 0.85),
    );
  }
  for (const { x, z, nx, nz } of FAN_ZONES) {
    parts.push(patch("sceneFacade", FAN_ZONE.wide, FAN_ZONE.deep, [x, 0.05, z], nx, nz));
  }
  const [first, second] = TEAM_BUSES;
  parts.push(
    patch(
      "sceneAsphalt",
      7,
      36,
      [(first.x + second.x) / 2, 0.05, (first.z + second.z) / 2],
      first.fx,
      first.fz,
      1.6,
    ),
  );
  const { x, z, nx, nz } = PLAYERS_ENTRANCE;
  parts.push(patch("seatGrana", 3, 8.5, [x + nx * 4.6, 0.07, z + nz * 4.6], nx, nz, 0.8));
  return join(parts);
}

/** One footbridge, with the stadium behind it: z is depth, out from the front of the bowl. */
function bridgeShape() {
  const { from, deckFrom, deckTo, to, deckY } = BRIDGE;
  const edge = WALKWAY_WIDTH / 2 - 0.15;
  const parts: BufferGeometry[] = [];
  /** A stretch of the bridge between two depths, level or sloping, with a wall along each side. */
  const stretch = (a: number, b: number, ya: number, yb: number) => {
    const long = Math.hypot(b - a, yb - ya);
    const tilt: [number, number, number] = [-Math.atan2(yb - ya, b - a), 0, 0];
    const y = (ya + yb) / 2;
    const z = (a + b) / 2;
    parts.push(box("scenePavingLight", [WALKWAY_WIDTH, 0.5, long], [0, y - 0.25, z], tilt));
    for (const side of [-1, 1]) {
      parts.push(box("sceneConcrete", [0.3, 1.1, long], [side * edge, y + 0.55, z], tilt));
    }
  };
  stretch(from, deckFrom, 0, deckY);
  stretch(deckFrom, deckTo, deckY, deckY);
  stretch(deckTo, to, deckY, STREET_Y);
  // Legs on both pavements and on the planted strip.
  const under = deckY - 0.5;
  for (const depth of [125.2, (ROAD.medianFrom + ROAD.medianTo) / 2, 146.8]) {
    for (const side of [-1, 1]) {
      parts.push(box("sceneConcrete", [0.9, under - STREET_Y, 0.9], [side * 4.4, (under + STREET_Y) / 2, depth]));
    }
  }
  return join(parts);
}

/** One gate in the outer wall: two piers, a beam across, turnstiles, and the dark way in. */
function gateShape() {
  const wall = OUTER_DEPTH;
  const solid = join([
    box("sceneConcrete", [1.4, 9, 2.6], [-7.2, 4.5, wall + 1.5]),
    box("sceneConcrete", [1.4, 9, 2.6], [7.2, 4.5, wall + 1.5]),
    box("sceneRoof", [16.4, 1.8, 3], [0, 9.9, wall + 1.6]),
    box("night950", [13, 7.8, 0.5], [0, 3.9, wall + 0.35]),
    ...[-4.8, -2.4, 0, 2.4, 4.8].map((x) => box("flood500", [0.5, 1.1, 1.4], [x, 0.55, wall + 2.6])),
  ]);
  const lit = join([
    box("flood50", [10, 0.7, 0.1], [0, 9.9, wall + 3.16]),
    box("sceneLamp", [12.4, 0.12, 1.8], [0, 8.94, wall + 1.6]),
  ]);
  return { solid, lit };
}

export function Ground() {
  const paving = useMemo(() => pavingTexture(), []);
  const lanes = useMemo(() => roadTexture(), []);

  const shapes = useMemo(() => {
    // The uplights at the foot of the wall also light the paving in front of
    // them. That light is part of the plaza's own colour, brightest at the
    // wall and under each uplight, so it costs nothing extra to draw.
    const plaza = groundUv(
      loopBand(
        [
          { depth: PLAZA.from, y: 0, glow: 1 },
          { depth: OUTER_DEPTH + 1, y: 0, glow: 1 },
          { depth: 70, y: 0, glow: 0.35 },
          { depth: WASH_REACH, y: 0, glow: 0 },
          { depth: PLAZA.edge, y: 0, glow: 0 },
        ],
        { step: 1.5, follow: OUTER_DEPTH, glow: (distance, point) => 1 + 1.1 * point * uplightScallop(distance) },
      ),
      PAVING_TILE,
    );
    // Two lighter rings in the paving, as a plaza has.
    const rings = join(
      [74, 100].map((depth) =>
        loopBand([
          { depth, y: 0.03 },
          { depth: depth + 1.4, y: 0.03 },
        ]),
      ),
    );
    const steps = loopBand(stepsProfile());
    // Both pavements and the planted strip, each with a kerb down to the road.
    const pavements = groundUv(
      join([
        loopBand([
          { depth: STEPS_END, y: STREET_Y },
          { depth: ROAD.inner, y: STREET_Y },
          { depth: ROAD.inner, y: ROAD_Y },
        ]),
        loopBand([
          { depth: ROAD.medianFrom, y: ROAD_Y },
          { depth: ROAD.medianFrom, y: STREET_Y },
          { depth: ROAD.medianTo, y: STREET_Y },
          { depth: ROAD.medianTo, y: ROAD_Y },
        ]),
        loopBand([
          { depth: ROAD.outer, y: ROAD_Y },
          { depth: ROAD.outer, y: STREET_Y },
          { depth: PAVEMENT_END, y: STREET_Y },
        ]),
      ]),
      PAVING_TILE,
    );
    const road = join(
      [
        [ROAD.inner, ROAD.medianFrom],
        [ROAD.medianTo, ROAD.outer],
      ].map(([from, to]) =>
        loopBand(
          [
            { depth: from, y: ROAD_Y },
            { depth: to, y: ROAD_Y },
          ],
          { tile: LANE_TILE },
        ),
      ),
    );
    const city = loopBand(
      [
        { depth: PAVEMENT_END, y: STREET_Y },
        { depth: WORLD_EDGE, y: STREET_Y },
      ],
      { step: 60 },
    );
    return { plaza, rings, steps, pavements, road, city, paths: pathsShape(), bridge: bridgeShape(), gate: gateShape() };
  }, []);

  /** A footbridge and a gate per walkway, each turned to face out along it. */
  const atWalkways = useMemo(() => {
    const matrices = new Float32Array(WALKWAYS.length * 16);
    WALKWAYS.forEach(({ ox, oz, nx, nz }, i) => {
      place(matrices, i, ox + nx * RING_CORNER.radius, 0, oz + nz * RING_CORNER.radius, nx, nz);
    });
    return matrices;
  }, []);

  return (
    <group>
      <mesh geometry={shapes.plaza} raycast={() => null}>
        <meshLambertMaterial map={paving} vertexColors />
      </mesh>
      <mesh geometry={shapes.rings} raycast={() => null}>
        <meshLambertMaterial
          color={COLOR.scenePavingLight}
          polygonOffset
          polygonOffsetFactor={-1}
          polygonOffsetUnits={-2}
        />
      </mesh>
      <mesh geometry={shapes.steps} raycast={() => null}>
        <meshLambertMaterial color={COLOR.scenePavingLight} flatShading />
      </mesh>
      <mesh geometry={shapes.pavements} raycast={() => null}>
        <meshLambertMaterial map={paving} flatShading />
      </mesh>
      <mesh geometry={shapes.road} raycast={() => null}>
        <meshLambertMaterial map={lanes} />
      </mesh>
      <mesh geometry={shapes.city} raycast={() => null}>
        <meshLambertMaterial color={COLOR.night900} />
      </mesh>
      <mesh geometry={shapes.paths} raycast={() => null}>
        <meshLambertMaterial
          vertexColors
          polygonOffset
          polygonOffsetFactor={-2}
          polygonOffsetUnits={-4}
        />
      </mesh>

      <Instances geometry={shapes.bridge} matrices={atWalkways}>
        <meshLambertMaterial vertexColors flatShading />
      </Instances>
      <Instances geometry={shapes.gate.solid} matrices={atWalkways}>
        <meshLambertMaterial vertexColors flatShading />
      </Instances>
      <Instances geometry={shapes.gate.lit} matrices={atWalkways}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </Instances>
    </group>
  );
}
