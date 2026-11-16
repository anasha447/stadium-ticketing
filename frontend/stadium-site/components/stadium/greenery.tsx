"use client";

import { useMemo } from "react";
import { type BufferGeometry, CylinderGeometry, DoubleSide, IcosahedronGeometry, PlaneGeometry } from "three";
import { placeAll } from "@/lib/stadium/placing";
import { buildTrees } from "@/lib/stadium/surroundings";
import { Instances } from "./instances";
import { join, paint } from "./painted";

// The trees of a Barcelona street: stone pines with a flat umbrella of a
// crown on a bare trunk, and tall palms. Two low models, each drawn a few
// hundred times with its own size and turn.

/** A stone pine, about 10 m tall: a trunk and three flattened clumps of needles. */
function pineShape() {
  const clump = (wide: number, tall: number, x: number, y: number, z: number, shade: number) =>
    paint(new IcosahedronGeometry(1, 0).scale(wide, tall, wide).translate(x, y, z), "sceneFoliage", shade);
  return join([
    paint(new CylinderGeometry(0.22, 0.36, 7.6, 6, 1, true).translate(0, 3.8, 0), "sceneBark"),
    clump(4.2, 1.5, 0, 8.5, 0, 1),
    clump(2.8, 1.2, 1.5, 9.4, -0.8, 1.2),
    clump(2.5, 1.1, -1.7, 9.1, 1, 0.85),
  ]);
}

/** A palm, about 12 m tall: a thin trunk and a crown of fronds that droop at the tip. */
function palmShape() {
  const top = 10.6;
  const parts: BufferGeometry[] = [
    paint(new CylinderGeometry(0.2, 0.32, top, 6, 1, true).translate(0, top / 2, 0), "sceneBark", 1.25),
  ];
  /** A flat blade from the middle of the crown outwards, tilted down by `droop`. */
  const blade = (long: number, wide: number, droop: number, turn: number, shade: number) =>
    paint(
      new PlaneGeometry(wide, long)
        .rotateX(-Math.PI / 2)
        .translate(0, 0, long / 2)
        .rotateX(droop)
        .rotateY(turn)
        .translate(0, top, 0),
      "sceneFoliageLight",
      shade,
    );
  for (let i = 0; i < 9; i++) {
    const turn = (i / 9) * Math.PI * 2;
    parts.push(blade(3.8, 0.9, 0.42, turn, i % 2 === 0 ? 1 : 0.8));
  }
  // Younger fronds standing up in the middle.
  for (let i = 0; i < 5; i++) {
    parts.push(blade(2.6, 0.7, -0.55, (i / 5) * Math.PI * 2 + 0.3, 1.15));
  }
  return join(parts);
}

export function Greenery() {
  const shapes = useMemo(() => ({ pine: pineShape(), palm: palmShape() }), []);
  const trees = useMemo(() => {
    const { pines, palms } = buildTrees();
    return { pines: placeAll(pines), palms: placeAll(palms) };
  }, []);

  return (
    <group>
      <Instances geometry={shapes.pine} matrices={trees.pines}>
        <meshLambertMaterial vertexColors flatShading side={DoubleSide} />
      </Instances>
      <Instances geometry={shapes.palm} matrices={trees.palms}>
        <meshLambertMaterial vertexColors flatShading side={DoubleSide} />
      </Instances>
    </group>
  );
}
