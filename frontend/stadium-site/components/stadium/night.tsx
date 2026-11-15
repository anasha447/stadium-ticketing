"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  type InstancedMesh,
  Object3D,
  SphereGeometry,
} from "three";
import { BLOCKS_PER_LEVEL } from "@/lib/domain/stadium";
import { COLOR } from "@/lib/design/tokens";
import { FACADE_HEIGHT, ringPoint, ROOF_INNER_DEPTH } from "@/lib/stadium/layout";
import { randomFrom } from "@/lib/stadium/random";
import { glowTexture } from "./painted";
import { horizonColour } from "./skyline";

// The night around the stadium: a dark sky with stars, and the floodlights
// under the edge of the roof. Nothing here moves, so it costs the same with
// reduced motion as without.

const SKY_RADIUS = 2600;
const STARS = 1600;

/** The sky as the inside of a ball: a faint glow along the horizon, black overhead. */
function skyDome() {
  const dome = new SphereGeometry(SKY_RADIUS, 32, 24);
  // The same colour the fog fades the city to, so ground and sky meet without a line.
  const horizon = horizonColour();
  const overhead = new Color(COLOR.night950);
  const below = horizon;
  const positions = dome.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  const colour = new Color();
  for (let i = 0; i < positions.count; i++) {
    const height = positions.getY(i) / SKY_RADIUS;
    if (height < 0) colour.copy(below);
    else colour.copy(horizon).lerp(overhead, Math.min(1, height * 3) ** 0.6);
    colour.toArray(colours, i * 3);
  }
  dome.setAttribute("color", new Float32BufferAttribute(colours, 3));
  return dome;
}

/** Stars over the upper half of the sky, some brighter than others. */
function starField() {
  const random = randomFrom(1899);
  const positions = new Float32Array(STARS * 3);
  const colours = new Float32Array(STARS * 3);
  const white = new Color(COLOR.flood50);
  for (let i = 0; i < STARS; i++) {
    // Even over the dome, and kept off the horizon where the glow is.
    const height = 0.06 + 0.94 * random();
    const around = random() * Math.PI * 2;
    const flat = Math.sqrt(1 - height * height);
    const radius = SKY_RADIUS * 0.95;
    positions.set(
      [Math.cos(around) * flat * radius, height * radius, Math.sin(around) * flat * radius],
      i * 3,
    );
    // Most stars are faint; a few stand out.
    const brightness = 0.25 + 0.75 * random() ** 3;
    colours.set([white.r * brightness, white.g * brightness, white.b * brightness], i * 3);
  }
  const stars = new BufferGeometry();
  stars.setAttribute("position", new Float32BufferAttribute(positions, 3));
  stars.setAttribute("color", new Float32BufferAttribute(colours, 3));
  return stars;
}

export function Sky() {
  const dome = useMemo(() => skyDome(), []);
  const stars = useMemo(() => starField(), []);
  return (
    <group>
      <mesh geometry={dome} raycast={() => null}>
        <meshBasicMaterial vertexColors side={BackSide} depthWrite={false} toneMapped={false} fog={false} />
      </mesh>
      <points geometry={stars} raycast={() => null}>
        <pointsMaterial
          vertexColors
          size={2.4}
          sizeAttenuation={false}
          transparent
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </points>
    </group>
  );
}

/** Height of the lamps: just under the edge of the roof. */
const LAMP_HEIGHT = FACADE_HEIGHT + 4.1;
const LAMP_DEPTH = ROOF_INNER_DEPTH - 0.8;

/**
 * One bank of lamps over each Block position, all the way round, as on the
 * real roof. Each is a bright bar with a glow around it. The light that
 * falls on the stadium comes from the scene's own lights.
 */
export function Floodlights() {
  const bars = useRef<InstancedMesh>(null);
  const glow = useMemo(() => glowTexture(), []);

  const lamps = useMemo(
    () =>
      Array.from({ length: BLOCKS_PER_LEVEL }, (_, i) => ringPoint(i + 0.5, LAMP_DEPTH)),
    [],
  );
  const glowPoints = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        lamps.flatMap(({ x, z, nx, nz }) => [x - nx * 0.6, LAMP_HEIGHT, z - nz * 0.6]),
        3,
      ),
    );
    return geometry;
  }, [lamps]);

  useLayoutEffect(() => {
    const instanced = bars.current;
    if (!instanced) return;
    const bar = new Object3D();
    lamps.forEach(({ x, z, nx, nz }, i) => {
      bar.position.set(x, LAMP_HEIGHT, z);
      // Long side along the roof edge, face towards the pitch.
      bar.rotation.set(0, Math.atan2(-nx, -nz), 0);
      bar.updateMatrix();
      instanced.setMatrixAt(i, bar.matrix);
    });
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingSphere();
  }, [lamps]);

  return (
    <group>
      <instancedMesh ref={bars} args={[undefined, undefined, lamps.length]} raycast={() => null}>
        <boxGeometry args={[7, 0.9, 0.5]} />
        <meshBasicMaterial color={COLOR.flood50} toneMapped={false} />
      </instancedMesh>
      <points geometry={glowPoints} raycast={() => null}>
        <pointsMaterial
          map={glow}
          color={COLOR.flood50}
          size={22}
          sizeAttenuation
          transparent
          opacity={0.55}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </points>
    </group>
  );
}
