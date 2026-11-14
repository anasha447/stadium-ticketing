import { describe, expect, it } from "vitest";
import { generateSeatMap } from "@/lib/api/mock/seat-map";
import { blockPose, easeInOut, flightSeconds, seatPose, stadiumPose } from "./camera";
import { locate, ringPoint, seatAtPoint, seatOnRay, seatPlace } from "./layout";
import {
  availableCount,
  isAvailable,
  nextAvailableRow,
  nextAvailableSeat,
  STADIUM,
  viewReducer,
} from "./view";

const map = generateSeatMap(1);
const block = (id: string) => map.blocks.find((b) => b.id === id)!;

describe("view", () => {
  it("goes in a step at a time and comes back the same way", () => {
    const inBlock = viewReducer(STADIUM, { type: "openBlock", blockId: "214" });
    expect(inBlock).toEqual({ kind: "block", blockId: "214" });

    const seated = viewReducer(inBlock, { type: "sit", blockId: "214", row: 7, seat: 12 });
    expect(seated).toEqual({ kind: "seat", blockId: "214", row: 7, seat: 12 });

    expect(viewReducer(seated, { type: "back" })).toEqual(inBlock);
    expect(viewReducer(inBlock, { type: "back" })).toEqual(STADIUM);
    expect(viewReducer(STADIUM, { type: "back" })).toEqual(STADIUM);
  });
});

describe("stepping between seats", () => {
  // A small made-up Block: three Rows of 4, 4 and 5 seats.
  const small = { ...block("101"), rowSeats: [4, 4, 5] };
  //             Row 1   Row 2   Row 3
  const states = "ASAA" + "SSSS" + "AASAA";

  it("knows which seats are available", () => {
    expect(isAvailable(small, states, 1, 1)).toBe(true);
    expect(isAvailable(small, states, 1, 2)).toBe(false);
    expect(isAvailable(small, states, 9, 1)).toBe(false);
    expect(availableCount(states)).toBe(7);
  });

  it("skips sold seats when moving along a Row", () => {
    expect(nextAvailableSeat(small, states, 1, 1, 1)).toBe(3);
    expect(nextAvailableSeat(small, states, 1, 3, -1)).toBe(1);
    expect(nextAvailableSeat(small, states, 1, 4, 1)).toBeNull();
  });

  it("skips a full Row and lands on the seat most nearly straight behind", () => {
    // From Row 1 seat 4 (far right): Row 2 is sold out, so Row 3, far right.
    expect(nextAvailableRow(small, states, 1, 4, 1)).toEqual({ row: 3, seat: 5 });
    expect(nextAvailableRow(small, states, 3, 1, -1)).toEqual({ row: 1, seat: 1 });
    expect(nextAvailableRow(small, states, 1, 1, -1)).toBeNull();
  });
});

describe("finding a seat from a point", () => {
  it("undoes ringPoint, all the way round and at every depth", () => {
    for (let position = 0.05; position < 40; position += 0.37) {
      for (const depth of [0.5, 12, 30, 55]) {
        const { x, z } = ringPoint(position, depth);
        const found = locate(x, z);
        expect(found.position).toBeCloseTo(position, 4);
        expect(found.depth).toBeCloseTo(depth, 4);
      }
    }
  });

  it("finds each seat from the spot it stands on", () => {
    for (const b of [block("101"), block("214"), block("316"), block("340")]) {
      for (const [row, seat] of [[1, 1], [5, 9], [b.rowSeats.length, b.rowSeats.at(-1)!]]) {
        const { x, z } = seatPlace(b, row, seat);
        const found = seatAtPoint(map.blocks, x, z)!;
        expect([found.block.id, found.row, found.seat]).toEqual([b.id, row, seat]);
      }
    }
  });

  it("finds nothing on the pitch or outside the wall", () => {
    expect(seatAtPoint(map.blocks, 0, 0)).toBeNull();
    expect(seatAtPoint(map.blocks, 250, 0)).toBeNull();
  });

  it("picks the seat a line of sight passes through, not the step behind it", () => {
    const b = block("107");
    const aimed = seatPlace(b, 10, 8);
    const eye: [number, number, number] = [0, 60, 0];
    const to = [aimed.x - eye[0], aimed.y + 0.55 - eye[1], aimed.z - eye[2]];
    const length = Math.hypot(...to);
    const direction = to.map((v) => v / length) as [number, number, number];
    // The click lands on the step one Row back.
    const guess = { block: b, row: 11, seat: 8 };
    const found = seatOnRay(guess, eye, direction);
    expect([found.row, found.seat]).toEqual([10, 8]);
  });
});

describe("camera", () => {
  it("stands further back on a tall screen", () => {
    const wide = Math.hypot(...stadiumPose(16 / 9).position);
    const tall = Math.hypot(...stadiumPose(9 / 19).position);
    expect(tall).toBeGreaterThan(wide * 2);
  });

  it("looks at a Block from the pitch side, above it", () => {
    const b = block("107"); // west side
    const pose = blockPose(b);
    expect(pose.position[0]).toBeGreaterThan(pose.target[0]); // nearer the pitch
    expect(pose.position[1]).toBeGreaterThan(pose.target[1]);
  });

  it("sits at eye height in the seat, looking towards the pitch and down at it", () => {
    const b = block("316"); // behind the north goal, upper Level
    const place = seatPlace(b, 20, 10);
    const pose = seatPose(b, 20, 10);
    expect(pose.position[1]).toBeCloseTo(place.y + 1.15);
    expect(pose.target[2]).toBeGreaterThan(pose.position[2]); // south, towards the pitch
    expect(pose.target[1]).toBeLessThan(pose.position[1]); // looking down
  });

  it("flies for 1.2 to 1.8 seconds", () => {
    expect(flightSeconds([0, 0, 0], [5, 0, 0])).toBe(1.2);
    expect(flightSeconds([0, 0, 0], [400, 0, 0])).toBe(1.8);
  });

  it("eases in and out", () => {
    expect(easeInOut(0)).toBe(0);
    expect(easeInOut(1)).toBe(1);
    expect(easeInOut(0.5)).toBeCloseTo(0.5);
    expect(easeInOut(0.1)).toBeLessThan(0.1);
    expect(easeInOut(0.9)).toBeGreaterThan(0.9);
  });
});
