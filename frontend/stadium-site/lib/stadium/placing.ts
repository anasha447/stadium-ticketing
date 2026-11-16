// Writes the transform of one instance straight into the array an instanced
// mesh keeps: 16 numbers each, column by column. Everything outside the
// stadium stands upright and only turns about the vertical, so the transform
// is a place, a direction along the ground and a size, with no trigonometry.

/**
 * Stands instance `index` at a place, with its front (+z) turned to face the
 * unit vector (fx, fz). `wide`, `tall` and `deep` scale it along its own
 * x, y and z.
 */
export function place(
  matrices: Float32Array,
  index: number,
  x: number,
  y: number,
  z: number,
  fx: number,
  fz: number,
  wide = 1,
  tall = wide,
  deep = wide,
): void {
  const o = index * 16;
  matrices[o] = fz * wide;
  matrices[o + 1] = 0;
  matrices[o + 2] = -fx * wide;
  matrices[o + 3] = 0;
  matrices[o + 4] = 0;
  matrices[o + 5] = tall;
  matrices[o + 6] = 0;
  matrices[o + 7] = 0;
  matrices[o + 8] = fx * deep;
  matrices[o + 9] = 0;
  matrices[o + 10] = fz * deep;
  matrices[o + 11] = 0;
  matrices[o + 12] = x;
  matrices[o + 13] = y;
  matrices[o + 14] = z;
  matrices[o + 15] = 1;
}

/** The transforms of a whole list of things that stand still. */
export function placeAll(
  things: { x: number; y: number; z: number; fx: number; fz: number; size?: number }[],
): Float32Array {
  const matrices = new Float32Array(things.length * 16);
  things.forEach(({ x, y, z, fx, fz, size = 1 }, i) => place(matrices, i, x, y, z, fx, fz, size));
  return matrices;
}
