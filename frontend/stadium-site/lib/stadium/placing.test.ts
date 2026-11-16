import { describe, expect, it } from "vitest";
import { place, placeAll } from "./placing";

/** Where a point of the shape ends up once the instance's transform is applied. */
function moved(matrices: Float32Array, index: number, [x, y, z]: [number, number, number]) {
  const m = matrices.subarray(index * 16, index * 16 + 16);
  return [
    m[0] * x + m[4] * y + m[8] * z + m[12],
    m[1] * x + m[5] * y + m[9] * z + m[13],
    m[2] * x + m[6] * y + m[10] * z + m[14],
  ];
}

describe("placing an instance", () => {
  it("puts it where it was told", () => {
    const matrices = new Float32Array(32);
    place(matrices, 1, 10, -2, 30, 0, 1);
    expect(moved(matrices, 1, [0, 0, 0])).toEqual([10, -2, 30]);
    // The first instance is untouched.
    expect([...matrices.subarray(0, 16)]).toEqual(new Array(16).fill(0));
  });

  it("turns its front to face the way it was given", () => {
    const matrices = new Float32Array(16);
    // Facing east: one metre in front of it is one metre east.
    place(matrices, 0, 0, 0, 0, 1, 0);
    const ahead = moved(matrices, 0, [0, 0, 1]);
    expect(ahead[0]).toBeCloseTo(1);
    expect(ahead[2]).toBeCloseTo(0);
    // And its right-hand side (-x for something facing +z) stays on its right: south when facing east.
    const right = moved(matrices, 0, [-1, 0, 0]);
    expect(right[0]).toBeCloseTo(0);
    expect(right[2]).toBeCloseTo(1);
  });

  it("keeps it upright and the right size", () => {
    const matrices = new Float32Array(16);
    place(matrices, 0, 0, 0, 0, Math.SQRT1_2, Math.SQRT1_2, 2, 5, 3);
    expect(moved(matrices, 0, [0, 1, 0])).toEqual([0, 5, 0]);
    expect(Math.hypot(...moved(matrices, 0, [1, 0, 0]))).toBeCloseTo(2);
    expect(Math.hypot(...moved(matrices, 0, [0, 0, 1]))).toBeCloseTo(3);
  });

  it("places a whole list, one transform each", () => {
    const matrices = placeAll([
      { x: 1, y: 0, z: 2, fx: 0, fz: 1 },
      { x: 3, y: 0, z: 4, fx: 1, fz: 0, size: 2 },
    ]);
    expect(matrices).toHaveLength(32);
    expect(moved(matrices, 1, [0, 1, 0])).toEqual([3, 2, 4]);
  });
});
