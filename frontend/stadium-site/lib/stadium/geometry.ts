import { BufferGeometry, Float32BufferAttribute, Shape } from "three";
import { BLOCKS_PER_LEVEL } from "@/lib/domain/stadium";
import type { Level } from "@/lib/domain/types";
import { LEVEL_PROFILE, ringPoint } from "./layout";
import { loopLength, loopPoint } from "./surroundings";

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

export interface BandPoint {
  depth: number;
  y: number;
  /** Where the point is across the band, 0 to 1, for a texture. Spread evenly if left out. */
  v?: number;
  /** How bright the band is here, for bands that are lit or made of light. */
  glow?: number;
}

/**
 * A band that runs right round the stadium outside the wall: the plaza, the
 * steps, a carriageway. Like `sweep`, but it follows the loop in metres, so a
 * texture laid along it (lane markings) keeps its length all the way round.
 *
 * `tile` is how many metres one repeat of the texture covers. `follow` is the
 * depth the distance round the loop is measured at (the middle of the band
 * if left out); two bands that follow the same depth stay in step. `glow`
 * gives the brightness of a corner from how far round the loop it is and the
 * `glow` of its point; with it, or with a `glow` on any point, the band
 * carries a colour per corner.
 */
export function loopBand(
  profile: BandPoint[],
  {
    step = 5,
    tile = 1,
    follow,
    glow,
  }: { step?: number; tile?: number; follow?: number; glow?: (distance: number, point: number) => number } = {},
): BufferGeometry {
  const middle = follow ?? (profile[0].depth + profile[profile.length - 1].depth) / 2;
  const total = loopLength(middle);
  const samples = Math.ceil(total / step);
  const lit = glow !== undefined || profile.some((point) => point.glow !== undefined);

  const positions: number[] = [];
  const uvs: number[] = [];
  const colours: number[] = [];
  for (let i = 0; i <= samples; i++) {
    const distance = (i / samples) * total;
    const { x, z, nx, nz } = loopPoint(middle, distance);
    profile.forEach((point, k) => {
      const out = point.depth - middle;
      positions.push(x + nx * out, point.y, z + nz * out);
      uvs.push(distance / tile, point.v ?? k / (profile.length - 1));
      if (lit) {
        const brightness = glow ? glow(distance, point.glow ?? 1) : (point.glow ?? 1);
        colours.push(brightness, brightness, brightness);
      }
    });
  }

  // The loop runs clockwise seen from above, so this order faces the band up.
  const indices: number[] = [];
  const across = profile.length;
  for (let i = 0; i < samples; i++) {
    for (let k = 0; k < across - 1; k++) {
      const a = i * across + k;
      const b = a + across;
      indices.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  if (lit) geometry.setAttribute("color", new Float32BufferAttribute(colours, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

/** Lays a texture over a shape by where it is on the ground: one repeat every `size` metres. */
export function groundUv(geometry: BufferGeometry, size: number): BufferGeometry {
  const positions = geometry.getAttribute("position");
  const uvs = new Float32Array(positions.count * 2);
  for (let i = 0; i < positions.count; i++) {
    uvs[i * 2] = positions.getX(i) / size;
    uvs[i * 2 + 1] = positions.getZ(i) / size;
  }
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  return geometry;
}
