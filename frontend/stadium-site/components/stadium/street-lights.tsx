"use client";

import { useMemo } from "react";
import {
  AdditiveBlending,
  BufferGeometry,
  ConeGeometry,
  DoubleSide,
  Float32BufferAttribute,
  PlaneGeometry,
} from "three";
import { COLOR } from "@/lib/design/tokens";
import { loopBand } from "@/lib/stadium/geometry";
import { OUTER_DEPTH } from "@/lib/stadium/layout";
import { place, placeAll } from "@/lib/stadium/placing";
import {
  loopPoint,
  type Placed,
  UPLIGHT_GAP,
  UPLIGHTS,
  uplightScallop,
} from "@/lib/stadium/surroundings";
import { Instances } from "./instances";
import { box, glowTexture, join } from "./painted";

// Light outside the stadium. None of it is a real light source: a few
// hundred of those would cost more than the stadium. A lamp is a post with a
// bright head, a soft warm disc laid on the ground under it and a faint cone
// of haze between the two; the wash on the outer wall is a band of light
// drawn on it. They only add brightness, so they are cheap and never hide
// anything.

/** How high a lamp's heads are. */
const LAMP_HEIGHT = 8.9;

/** A street lamp: a post with an arm and a head at each end of it. */
function lampShapes() {
  const post = join([
    box("flood500", [0.2, LAMP_HEIGHT + 0.1, 0.2], [0, (LAMP_HEIGHT + 0.1) / 2, 0], undefined, 0.5),
    box("flood500", [2.6, 0.1, 0.12], [0, LAMP_HEIGHT + 0.12, 0], undefined, 0.5),
    box("flood500", [0.8, 0.14, 0.36], [-1.2, LAMP_HEIGHT + 0.02, 0], undefined, 0.5),
    box("flood500", [0.8, 0.14, 0.36], [1.2, LAMP_HEIGHT + 0.02, 0], undefined, 0.5),
  ]);
  const heads = join([
    box("sceneLamp", [0.7, 0.06, 0.3], [-1.2, LAMP_HEIGHT - 0.07, 0]),
    box("sceneLamp", [0.7, 0.06, 0.3], [1.2, LAMP_HEIGHT - 0.07, 0]),
  ]);
  return { post, heads };
}

/** The haze under a lamp: a cone that is brightest at the head and gone by the ground. */
function hazeShape() {
  const cone = new ConeGeometry(6.5, LAMP_HEIGHT, 10, 1, true).translate(0, LAMP_HEIGHT / 2, 0);
  const positions = cone.getAttribute("position");
  const colours = new Float32Array(positions.count * 3);
  for (let i = 0; i < positions.count; i++) {
    const brightness = (positions.getY(i) / LAMP_HEIGHT) ** 1.6;
    colours.fill(brightness, i * 3, i * 3 + 3);
  }
  cone.setAttribute("color", new Float32BufferAttribute(colours, 3));
  return cone;
}

export interface Pool {
  x: number;
  y: number;
  z: number;
  /** How wide the pool of light is, in metres. */
  size: number;
}

/**
 * The street lamps, and every warm pool of light on the ground: one under
 * each lamp, plus the ones handed in for the gates, the food trucks, the
 * stalls and the fan zones.
 */
export function StreetLamps({ lamps, pools }: { lamps: Placed[]; pools: Pool[] }) {
  const shapes = useMemo(
    () => ({
      ...lampShapes(),
      haze: hazeShape(),
      pool: new PlaneGeometry(1, 1).rotateX(-Math.PI / 2),
    }),
    [],
  );
  const glow = useMemo(() => glowTexture(), []);
  const standing = useMemo(() => placeAll(lamps), [lamps]);

  const onGround = useMemo(() => {
    const all = [...lamps.map(({ x, y, z }) => ({ x, y, z, size: 26 })), ...pools];
    const matrices = new Float32Array(all.length * 16);
    all.forEach(({ x, y, z, size }, i) => place(matrices, i, x, y + 0.1, z, 0, 1, size));
    return matrices;
  }, [lamps, pools]);

  const heads = useMemo(() => {
    const geometry = new BufferGeometry();
    geometry.setAttribute(
      "position",
      new Float32BufferAttribute(
        lamps.flatMap(({ x, y, z }) => [x, y + LAMP_HEIGHT, z]),
        3,
      ),
    );
    return geometry;
  }, [lamps]);

  return (
    <group>
      <Instances geometry={shapes.post} matrices={standing}>
        <meshLambertMaterial vertexColors />
      </Instances>
      <Instances geometry={shapes.heads} matrices={standing}>
        <meshBasicMaterial vertexColors toneMapped={false} fog={false} />
      </Instances>
      <Instances geometry={shapes.haze} matrices={standing}>
        <meshBasicMaterial
          color={COLOR.sceneLamp}
          vertexColors
          transparent
          opacity={0.1}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </Instances>
      <Instances geometry={shapes.pool} matrices={onGround}>
        <meshBasicMaterial
          map={glow}
          color={COLOR.sceneLamp}
          transparent
          opacity={0.34}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
          polygonOffset
          polygonOffsetFactor={-3}
          polygonOffsetUnits={-6}
        />
      </Instances>
      <points geometry={heads} raycast={() => null}>
        <pointsMaterial
          map={glow}
          color={COLOR.sceneLamp}
          size={9}
          sizeAttenuation
          transparent
          opacity={0.8}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
        />
      </points>
    </group>
  );
}

/**
 * The outer wall lit from below: a row of uplights at its foot and a scallop
 * of light climbing the wall above each one. The same light on the paving is
 * part of the plaza's own colour (components/stadium/ground.tsx).
 */
export function FacadeWash() {
  const { wash, fixtures, fixture } = useMemo(() => {
    const depth = OUTER_DEPTH + 0.25;
    const wash = loopBand(
      [
        { depth, y: 41, glow: 0 },
        { depth, y: 27, glow: 0.14 },
        { depth, y: 11, glow: 0.5 },
        { depth, y: 0.2, glow: 1 },
      ],
      { step: 1.5, follow: OUTER_DEPTH, glow: (distance, point) => point * uplightScallop(distance) },
    );

    const matrices = new Float32Array(UPLIGHTS * 16);
    for (let i = 0; i < UPLIGHTS; i++) {
      const { x, z, nx, nz } = loopPoint(OUTER_DEPTH, (i + 0.5) * UPLIGHT_GAP);
      place(matrices, i, x + nx * 4.4, 0, z + nz * 4.4, nx, nz);
    }
    return { wash, fixtures: matrices, fixture: box("sceneRoof", [0.9, 0.3, 0.5], [0, 0.15, 0]) };
  }, []);

  return (
    <group>
      <mesh geometry={wash} raycast={() => null}>
        <meshBasicMaterial
          color={COLOR.sceneRoof}
          vertexColors
          transparent
          opacity={0.5}
          blending={AdditiveBlending}
          depthWrite={false}
          toneMapped={false}
          fog={false}
          side={DoubleSide}
        />
      </mesh>
      <Instances geometry={fixture} matrices={fixtures}>
        <meshBasicMaterial vertexColors toneMapped={false} />
      </Instances>
    </group>
  );
}
