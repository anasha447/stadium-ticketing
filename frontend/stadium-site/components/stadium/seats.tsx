"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import {
  BoxGeometry,
  Color,
  InstancedBufferAttribute,
  type InstancedMesh,
} from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { COLOR } from "@/lib/design/tokens";
import type { Block } from "@/lib/domain/types";
import { buildSeats, SEAT_COLOURS } from "@/lib/stadium/seats";

// Every seat in the stadium, drawn as one instanced mesh: the seat shape is
// sent to the graphics card once and repeated 60,000 times, each copy with
// its own place and colour. That is what keeps it smooth.

/** One seat: a pan and a backrest. Its front faces +z, its feet are at y = 0. */
function seatShape() {
  const pan = new BoxGeometry(0.44, 0.07, 0.4).translate(0, 0.42, 0.04);
  const back = new BoxGeometry(0.44, 0.44, 0.06).translate(0, 0.66, -0.19);
  return mergeGeometries([pan, back]);
}

export function Seats({ blocks }: { blocks: Block[] }) {
  const mesh = useRef<InstancedMesh>(null);
  const shape = useMemo(() => seatShape(), []);
  const seats = useMemo(() => buildSeats(blocks), [blocks]);

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;

    instanced.instanceMatrix.array.set(seats.matrices);
    instanced.instanceMatrix.needsUpdate = true;

    // Three.js lights in linear colour, so the tokens are converted once here.
    const palette = SEAT_COLOURS.map((name) => new Color(COLOR[name]));
    const colours = new Float32Array(seats.count * 3);
    for (let i = 0; i < seats.count; i++) {
      palette[seats.colours[i]].toArray(colours, i * 3);
    }
    instanced.instanceColor = new InstancedBufferAttribute(colours, 3);

    // The mesh's own bounds are one seat; tell it how big the stadium is so
    // it is not hidden when that one seat leaves the view.
    instanced.computeBoundingSphere();
  }, [seats]);

  return (
    <instancedMesh ref={mesh} args={[shape, undefined, seats.count]}>
      <meshStandardMaterial roughness={0.55} />
    </instancedMesh>
  );
}
