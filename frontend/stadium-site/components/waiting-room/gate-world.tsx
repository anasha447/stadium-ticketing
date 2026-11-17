"use client";

import { useMemo } from "react";
import { AdditiveBlending, Color, PlaneGeometry } from "three";
import { COLOR } from "@/lib/design/tokens";
import { placeAll } from "@/lib/stadium/placing";
import { pavingTexture } from "../stadium/ground";
import { Instances } from "../stadium/instances";
import { box, drawn, glowTexture, join } from "../stadium/painted";

// The place the Waiting Room stands in: a stretch of the stadium's outer
// wall with one gate in it, the turnstiles, and the dark plaza in front. The
// way in is lit warm from inside, and that light spills out onto the paving,
// so the eye goes to the gate. The gate faces +z; the plaza runs out along it.

/** How far the plaza reaches, in metres. Fog has taken it well before its edge. */
const PLAZA_SIZE = 220;
const PAVING_TILE = 8;

/** The outer wall: how wide the stretch is, and how tall. */
const WALL_WIDTH = 150;
const WALL_HEIGHT = 34;

/** Half the width of the way in, and how deep the passage behind it runs. */
const DOOR_HALF = 7.4;
const DOOR_HEIGHT = 9.6;
const PASSAGE = 10;

/** Turnstiles across the way in. The line comes through the lane in the middle. */
export const TURNSTILES = [-6.2, -3.8, -1.3, 1.3, 3.8, 6.2];
const TURNSTILE_Z = 1.2;

/** Street lamps on the plaza, either side of the line. */
const LAMPS = [
  [-13, 9],
  [13, 9],
  [-15, 25],
  [15, 25],
  [-13, 41],
  [13, 41],
];

/** The wall either side of the way in, with concrete ribs, a plinth and the roof's edge on top. */
function wallShape() {
  const side = (WALL_WIDTH - DOOR_HALF * 2) / 2;
  const parts = [
    box("sceneFacade", [side, WALL_HEIGHT, 2], [-(DOOR_HALF + side / 2), WALL_HEIGHT / 2, -1]),
    box("sceneFacade", [side, WALL_HEIGHT, 2], [DOOR_HALF + side / 2, WALL_HEIGHT / 2, -1]),
    // Above the way in, the wall closes over it.
    box("sceneFacade", [DOOR_HALF * 2, WALL_HEIGHT - DOOR_HEIGHT, 2], [0, (WALL_HEIGHT + DOOR_HEIGHT) / 2, -1]),
    box("sceneConcrete", [WALL_WIDTH, 1.2, 0.7], [0, 0.6, 0.2]),
    box("sceneRoof", [WALL_WIDTH, 1.4, 4], [0, WALL_HEIGHT + 0.7, 0], undefined, 0.8),
  ];
  // Ribs every seven metres, clear of the gate.
  for (let x = -70; x <= 70; x += 7) {
    if (Math.abs(x) < 11) continue;
    parts.push(box("sceneConcrete", [0.9, WALL_HEIGHT, 1.3], [x, WALL_HEIGHT / 2, 0.4], undefined, 0.85));
  }
  return join(parts);
}

/** The gate: two piers, the beam over them, the passage walls, and the turnstiles. */
function gateShape() {
  return join([
    box("sceneConcrete", [1.6, 10.4, 2.8], [-(DOOR_HALF + 0.8), 5.2, 1.4]),
    box("sceneConcrete", [1.6, 10.4, 2.8], [DOOR_HALF + 0.8, 5.2, 1.4]),
    box("sceneRoof", [18.4, 1.6, 3.2], [0, 10.4, 1.4]),
    // The passage through the wall: two side walls and a ceiling, dark so the light at its end shows.
    box("night900", [0.4, DOOR_HEIGHT, PASSAGE], [-DOOR_HALF, DOOR_HEIGHT / 2, -PASSAGE / 2]),
    box("night900", [0.4, DOOR_HEIGHT, PASSAGE], [DOOR_HALF, DOOR_HEIGHT / 2, -PASSAGE / 2]),
    box("night900", [DOOR_HALF * 2, 0.4, PASSAGE], [0, DOOR_HEIGHT, -PASSAGE / 2]),
    ...TURNSTILES.flatMap((x) => [
      box("flood500", [0.45, 1.05, 1.6], [x, 0.53, TURNSTILE_Z]),
      box("night900", [0.5, 0.08, 1.64], [x, 1.08, TURNSTILE_Z]),
      // The arms reach into the lane on the line's side.
      box("flood300", [0.9, 0.06, 0.06], [x + (x < 0 ? 0.6 : -0.6), 0.95, TURNSTILE_Z + 0.3]),
    ]),
  ]);
}

/** What glows: the strip of light under the beam, and a small lamp on each turnstile. */
function litShape() {
  return join([
    box("sceneLamp", [DOOR_HALF * 2 - 0.4, 0.14, 2.2], [0, 9.55, 1.4]),
    ...TURNSTILES.map((x) => box("sceneLamp", [0.22, 0.05, 0.22], [x, 1.14, TURNSTILE_Z - 0.5])),
  ]);
}

/** A street lamp: a pole, an arm and the lamp head. The head is drawn lit. */
function lampShape() {
  return {
    solid: join([
      box("sceneConcrete", [0.22, 7, 0.22], [0, 3.5, 0]),
      box("sceneConcrete", [0.14, 0.14, 1.4], [0, 7, 0.6]),
    ]),
    lit: box("sceneLamp", [0.5, 0.18, 0.7], [0, 6.86, 1.2]),
  };
}

/**
 * Warm light lying on the paving in front of the gate: brightest at the way
 * in, fading out over the plaza. Drawn as a texture, not a light, so it
 * costs nothing per pixel.
 */
function spillTexture() {
  return drawn(128, 256, (context) => {
    const light = context.createRadialGradient(64, 0, 0, 64, 0, 256);
    light.addColorStop(0, `${COLOR.sceneLamp}cc`);
    light.addColorStop(0.35, `${COLOR.sceneLamp}44`);
    light.addColorStop(1, `${COLOR.sceneLamp}00`);
    context.fillStyle = light;
    context.fillRect(0, 0, 128, 256);
  });
}

/** The light at the end of the passage: the inside of the stadium, warm and bright. */
function insideTexture() {
  return drawn(64, 128, (context) => {
    const light = context.createLinearGradient(0, 128, 0, 0);
    light.addColorStop(0, COLOR.flood50);
    light.addColorStop(0.5, COLOR.sceneLamp);
    light.addColorStop(1, COLOR.sceneFacade);
    context.fillStyle = light;
    context.fillRect(0, 0, 64, 128);
  });
}

export function GateWorld() {
  const shapes = useMemo(() => {
    const paving = pavingTexture();
    paving.repeat.set(PLAZA_SIZE / PAVING_TILE, PLAZA_SIZE / PAVING_TILE);
    const floor = new PlaneGeometry(PLAZA_SIZE, PLAZA_SIZE).rotateX(-Math.PI / 2);
    floor.translate(0, 0, PLAZA_SIZE / 2 - PASSAGE - 2);
    const spill = new PlaneGeometry(26, 30).rotateX(-Math.PI / 2).translate(0, 0.02, 14);
    const pool = new PlaneGeometry(12, 12).rotateX(-Math.PI / 2);
    const wash = new PlaneGeometry(11, 16);
    return {
      paving,
      floor,
      spill,
      spillTexture: spillTexture(),
      inside: insideTexture(),
      glow: glowTexture(),
      wall: wallShape(),
      gate: gateShape(),
      lit: litShape(),
      lamp: lampShape(),
      pool,
      wash,
    };
  }, []);

  // Lamps face the line in the middle of the plaza.
  const lamps = useMemo(
    () => placeAll(LAMPS.map(([x, z]) => ({ x, y: 0, z, fx: -Math.sign(x), fz: 0 }))),
    [],
  );
  const pools = useMemo(
    () => placeAll(LAMPS.map(([x, z]) => ({ x: x - Math.sign(x) * 1.2, y: 0.03, z, fx: 0, fz: 1 }))),
    [],
  );
  // Uplights wash the wall from its foot, as on the stadium itself.
  const washes = useMemo(
    () =>
      placeAll(
        [-63, -49, -35, -21, 21, 35, 49, 63].map((x) => ({ x, y: 7, z: 1.15, fx: 0, fz: 1 })),
      ),
    [],
  );
  const lampColour = useMemo(() => new Color(COLOR.sceneLamp), []);

  return (
    <group>
      <mesh geometry={shapes.floor} raycast={() => null}>
        <meshLambertMaterial map={shapes.paving} />
      </mesh>
      <mesh geometry={shapes.spill} raycast={() => null}>
        <meshBasicMaterial
          map={shapes.spillTexture}
          transparent
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </mesh>

      <mesh geometry={shapes.wall} raycast={() => null}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh geometry={shapes.gate} raycast={() => null}>
        <meshLambertMaterial vertexColors />
      </mesh>
      <mesh geometry={shapes.lit} raycast={() => null}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </mesh>

      {/* The inside of the stadium at the end of the passage. */}
      <mesh position={[0, DOOR_HEIGHT / 2, -PASSAGE + 0.3]} raycast={() => null}>
        <planeGeometry args={[DOOR_HALF * 2, DOOR_HEIGHT]} />
        <meshBasicMaterial map={shapes.inside} toneMapped={false} fog={false} />
      </mesh>

      <Instances geometry={shapes.lamp.solid} matrices={lamps}>
        <meshLambertMaterial vertexColors />
      </Instances>
      <Instances geometry={shapes.lamp.lit} matrices={lamps}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </Instances>
      <Instances geometry={shapes.pool} matrices={pools}>
        <meshBasicMaterial
          map={shapes.glow}
          color={lampColour}
          transparent
          opacity={0.32}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </Instances>
      <Instances geometry={shapes.wash} matrices={washes}>
        <meshBasicMaterial
          map={shapes.glow}
          color={lampColour}
          transparent
          opacity={0.16}
          depthWrite={false}
          blending={AdditiveBlending}
          toneMapped={false}
        />
      </Instances>

      {/* The real light: warm out of the gate onto the line, and two of the lamps. */}
      <pointLight position={[0, 4, -1]} color={COLOR.sceneLamp} intensity={40} distance={30} decay={1.4} />
      <pointLight position={[-12, 6.8, 25]} color={COLOR.sceneLamp} intensity={18} distance={16} decay={1.4} />
      <pointLight position={[12, 6.8, 25]} color={COLOR.sceneLamp} intensity={18} distance={16} decay={1.4} />
    </group>
  );
}
