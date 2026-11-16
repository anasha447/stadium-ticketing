"use client";

import { type ReactNode, useLayoutEffect, useRef } from "react";
import { type BufferGeometry, InstancedBufferAttribute, type InstancedMesh } from "three";

/**
 * One shape drawn many times: trees, lamps, parked things. The shape and its
 * material go to the graphics card once, with a transform per copy
 * (lib/stadium/placing.ts), so a thousand trees cost one draw call.
 *
 * Nothing drawn this way is ever clicked, so it is left out of pointer tests.
 */
export function Instances({
  geometry,
  matrices,
  colours,
  children,
}: {
  geometry: BufferGeometry;
  /** 16 numbers per copy. */
  matrices: Float32Array;
  /** Optional: three numbers per copy, a tint laid over the shape's own colours. */
  colours?: Float32Array;
  /** The material. */
  children: ReactNode;
}) {
  const mesh = useRef<InstancedMesh>(null);
  const count = matrices.length / 16;

  useLayoutEffect(() => {
    const instanced = mesh.current;
    if (!instanced) return;
    (instanced.instanceMatrix.array as Float32Array).set(matrices);
    instanced.instanceMatrix.needsUpdate = true;
    if (colours) instanced.instanceColor = new InstancedBufferAttribute(colours, 3);
    // Copies are spread wide, so the mesh needs to know how far they reach.
    instanced.computeBoundingSphere();
  }, [matrices, colours]);

  return (
    <instancedMesh ref={mesh} args={[geometry, undefined, count]} raycast={() => null}>
      {children}
    </instancedMesh>
  );
}
