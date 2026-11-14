"use client";

import type { ThreeEvent } from "@react-three/fiber";
import { useMemo } from "react";
import { DoubleSide } from "three";
import { COLOR } from "@/lib/design/tokens";
import type { Level } from "@/lib/domain/types";
import { levelBack, sweep, terraceProfile, type ProfilePoint } from "@/lib/stadium/geometry";
import { FACADE_HEIGHT, LEVEL_PROFILE, OUTER_DEPTH } from "@/lib/stadium/layout";

// The building: three stepped Levels, the outer wall and the roof ring.
// Every part is a cross-section swept around the ring (lib/stadium/geometry).

const LEVELS: Level[] = ["LOWER", "CLUB", "UPPER"];

/** Height of the white band along the front edge of the club and upper Levels. */
const FASCIA = 2.2;

/** How far in from the outer wall the roof reaches, as a depth. */
const ROOF_INNER_DEPTH = 46;

/** A click on a stand: the point on the concrete, and the line of sight that hit it. */
export interface StandClick {
  point: [number, number, number];
  origin: [number, number, number];
  direction: [number, number, number];
}

/** A press that moved further than this, in pixels, was a drag and not a click. */
const DRAG_PIXELS = 5;

export function Bowl({
  rows,
  onStandClick,
}: {
  rows: Record<Level, number>;
  onStandClick: (click: StandClick) => void;
}) {
  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > DRAG_PIXELS) return;
    // Only the nearest stand counts, not the one behind it.
    event.stopPropagation();
    onStandClick({
      point: event.point.toArray(),
      origin: event.ray.origin.toArray(),
      direction: event.ray.direction.toArray(),
    });
  };

  const parts = useMemo(() => {
    const terraces = LEVELS.map((level) =>
      // The lower Level stands on the ground; the others hang, so their front
      // wall is only as tall as the step itself.
      sweep(terraceProfile(level, rows[level], level === "LOWER" ? LEVEL_PROFILE.LOWER.startHeight : 0)),
    );

    // The white band and the dark underside of the two hanging Levels.
    const hanging = (["CLUB", "UPPER"] as const).map((level) => {
      const { startDepth, startHeight } = LEVEL_PROFILE[level];
      const back = levelBack(level, rows[level]);
      return {
        fascia: sweep([
          { depth: startDepth, y: startHeight - FASCIA },
          { depth: startDepth, y: startHeight },
        ]),
        underside: sweep([
          { depth: startDepth, y: startHeight - FASCIA },
          { depth: back.depth, y: back.y - FASCIA },
        ]),
      };
    });

    const upperBack = levelBack("UPPER", rows.UPPER);
    const wall: ProfilePoint[] = [
      { depth: upperBack.depth, y: upperBack.y + 1.1 },
      { depth: OUTER_DEPTH, y: FACADE_HEIGHT },
      { depth: OUTER_DEPTH, y: 0 },
    ];

    // Three floor edges wrapped around the outside, like stacked balconies.
    const balconies = [12, 22, 32].map((y) =>
      sweep([
        { depth: OUTER_DEPTH, y: y + 0.6 },
        { depth: OUTER_DEPTH + 2.4, y: y + 0.6 },
        { depth: OUTER_DEPTH + 2.4, y: y - 0.6 },
        { depth: OUTER_DEPTH, y: y - 0.6 },
      ]),
    );

    // A shallow canopy over the back Rows of the upper Level. It stops well
    // short of the front so the seats stay visible from above.
    const roof = sweep([
      { depth: OUTER_DEPTH + 4, y: FACADE_HEIGHT + 2.5 },
      { depth: ROOF_INNER_DEPTH, y: FACADE_HEIGHT + 6 },
    ]);
    const roofEdge = sweep([
      { depth: ROOF_INNER_DEPTH, y: FACADE_HEIGHT + 6 },
      { depth: ROOF_INNER_DEPTH, y: FACADE_HEIGHT + 4.8 },
    ]);

    return { terraces, hanging, wall: sweep(wall), balconies, roof, roofEdge };
  }, [rows]);

  return (
    <group>
      {parts.terraces.map((geometry, i) => (
        <mesh key={LEVELS[i]} geometry={geometry} onClick={handleClick}>
          <meshStandardMaterial color={COLOR.sceneConcrete} roughness={0.95} flatShading side={DoubleSide} />
        </mesh>
      ))}

      {parts.hanging.map(({ fascia, underside }, i) => (
        <group key={i}>
          <mesh geometry={fascia}>
            <meshStandardMaterial color={COLOR.flood50} roughness={0.7} side={DoubleSide} />
          </mesh>
          <mesh geometry={underside}>
            <meshStandardMaterial color={COLOR.sceneFacade} roughness={1} side={DoubleSide} />
          </mesh>
        </group>
      ))}

      <mesh geometry={parts.wall}>
        <meshStandardMaterial color={COLOR.sceneFacade} roughness={0.9} flatShading side={DoubleSide} />
      </mesh>
      {parts.balconies.map((geometry, i) => (
        <mesh key={i} geometry={geometry}>
          <meshStandardMaterial color={COLOR.sceneRoof} roughness={0.6} flatShading side={DoubleSide} />
        </mesh>
      ))}

      <mesh geometry={parts.roof}>
        <meshStandardMaterial
          color={COLOR.sceneRoof}
          roughness={0.4}
          transparent
          opacity={0.32}
          side={DoubleSide}
          depthWrite={false}
        />
      </mesh>
      <mesh geometry={parts.roofEdge}>
        <meshStandardMaterial color={COLOR.sceneRoof} roughness={0.5} side={DoubleSide} />
      </mesh>
    </group>
  );
}
