import { BufferGeometry, Float32BufferAttribute, Shape } from "three";
import { BLOCKS_PER_LEVEL } from "@/lib/domain/stadium";
import type { Level } from "@/lib/domain/types";
import { LEVEL_PROFILE, ringPoint } from "./layout";

// Turns the layout numbers into meshes. Almost every part of the bowl is the
// same move: take a cross-section (a line of depth/height points, as if you
// had sliced the stand with a knife) and sweep it once around the ring.

export interface ProfilePoint {
  depth: number;
  y: number;
}

/** Points around the ring per Block. Corners need the detail, straights don't mind it. */
const SAMPLES_PER_BLOCK = 6;
const RING_SAMPLES = BLOCKS_PER_LEVEL * SAMPLES_PER_BLOCK;

/** Sweeps a cross-section around the whole bowl. */
export function sweep(profile: ProfilePoint[]): BufferGeometry {
  const positions: number[] = [];
  for (let i = 0; i <= RING_SAMPLES; i++) {
    for (const { depth, y } of profile) {
      const { x, z } = ringPoint(i / SAMPLES_PER_BLOCK, depth);
      positions.push(x, y, z);
    }
  }

  const indices: number[] = [];
  const across = profile.length;
  for (let i = 0; i < RING_SAMPLES; i++) {
    for (let k = 0; k < across - 1; k++) {
      const a = i * across + k;
      const b = a + across;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Depth and height at the back of a Level's last Row. */
export function levelBack(level: Level, rows: number): ProfilePoint {
  const { startDepth, startHeight, tread, riser } = LEVEL_PROFILE[level];
  return { depth: startDepth + rows * tread, y: startHeight + (rows - 1) * riser };
}

/**
 * The stepped cross-section of a Level: up a riser, back along a tread, once
 * per Row, with a wall in front and a low wall behind the last Row.
 */
export function terraceProfile(level: Level, rows: number, frontWall: number): ProfilePoint[] {
  const { startDepth, startHeight, tread, riser } = LEVEL_PROFILE[level];
  const profile: ProfilePoint[] = [{ depth: startDepth, y: startHeight - frontWall }];
  for (let row = 0; row < rows; row++) {
    const y = startHeight + row * riser;
    profile.push({ depth: startDepth + row * tread, y });
    profile.push({ depth: startDepth + (row + 1) * tread, y });
  }
  const back = levelBack(level, rows);
  profile.push({ depth: back.depth, y: back.y + 1.1 });
  return profile;
}

/** The outline of the bowl at a given depth, as a flat shape seen from above. */
export function ringShape(depth: number): Shape {
  const shape = new Shape();
  for (let i = 0; i <= RING_SAMPLES; i++) {
    const { x, z } = ringPoint(i / SAMPLES_PER_BLOCK, depth);
    // A Shape is drawn in x/y; laid flat, its y becomes -z.
    if (i === 0) shape.moveTo(x, -z);
    else shape.lineTo(x, -z);
  }
  return shape;
}
