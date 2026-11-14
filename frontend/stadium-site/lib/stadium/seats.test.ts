import { describe, expect, it } from "vitest";
import { generateSeatMap } from "@/lib/api/mock/seat-map";
import { soldSeats } from "@/lib/api/mock/sold-seats";
import type { Block, Side } from "@/lib/domain/types";
import { blockWidth, rowPlace, seatAcross } from "./layout";
import { seatColour, textBitmap } from "./mosaic";
import { buildSeats, SEAT_COLOURS } from "./seats";

const map = generateSeatMap(1);
const seats = buildSeats(map.blocks);
const OR = SEAT_COLOURS.indexOf("seatOr");

/** Yellow seats of the Blocks that pass the filter. */
function yellowIn(filter: (block: Block) => boolean): number {
  let yellow = 0;
  for (const block of map.blocks.filter(filter)) {
    const start = seats.blockStart[block.id];
    const size = block.rowSeats.reduce((sum, n) => sum + n, 0);
    for (let i = start; i < start + size; i++) if (seats.colours[i] === OR) yellow++;
  }
  return yellow;
}
const on = (side: Side) => (block: Block) => block.side === side;

describe("seats", () => {
  it("are one per seat of the Seat Map", () => {
    expect(seats.count).toBe(map.seatCount);
    expect(seats.matrices).toHaveLength(map.seatCount * 16);
  });

  it("are in the same order as the Seat States strings", () => {
    const states = soldSeats(1, 0.5).blocks;
    let expected = 0;
    for (const block of map.blocks) {
      expect(seats.blockStart[block.id]).toBe(expected);
      expected += states[block.id].length;
    }
    expect(expected).toBe(seats.count);
  });

  it("face the pitch", () => {
    for (let i = 0; i < seats.count; i += 997) {
      const m = seats.matrices.subarray(i * 16, i * 16 + 16);
      const facing = { x: m[8], z: m[10] }; // where the seat's front points
      const toCentre = { x: -m[12], z: -m[14] };
      expect(facing.x * toCentre.x + facing.z * toCentre.z).toBeGreaterThan(0);
      expect(Math.hypot(facing.x, facing.z)).toBeCloseTo(1);
    }
  });
});

describe("mosaic", () => {
  it("uses only blue, garnet and yellow", () => {
    expect(new Set(seats.colours)).toEqual(new Set([0, 1, 2]));
  });

  it("puts the crest on the west side, on all three Levels", () => {
    for (const level of ["LOWER", "CLUB", "UPPER"] as const) {
      expect(yellowIn((b) => b.side === "WEST" && b.level === level)).toBeGreaterThan(200);
    }
  });

  it("puts the Spotify symbol behind the north goal and nothing behind the south", () => {
    expect(yellowIn(on("NORTH"))).toBeGreaterThan(3000);
    expect(yellowIn(on("SOUTH"))).toBe(0);
  });

  it("puts the words on the east side of the upper Level only", () => {
    expect(yellowIn((b) => b.side === "EAST" && b.level === "UPPER")).toBeGreaterThan(1500);
    expect(yellowIn((b) => b.side === "EAST" && b.level !== "UPPER")).toBe(0);
  });

  it("leaves most seats blue or garnet", () => {
    const yellow = yellowIn(() => true);
    expect(yellow / seats.count).toBeGreaterThan(0.08);
    expect(yellow / seats.count).toBeLessThan(0.3);
  });

  it("sets the words the right way round: the F's upright is on the left", () => {
    // Left, seen from the pitch, is the low-numbered end of the east side.
    // The F starts with a full-height upright, so the first yellow seat of
    // every Row of the words lines up. Mirrored, the left edge would be the
    // final A, whose top Row is narrower.
    const east = map.blocks.filter((b) => b.side === "EAST" && b.level === "UPPER");
    const leftEdges: number[] = [];
    for (let row = 5; row <= 25; row++) {
      const { depth } = rowPlace("UPPER", row);
      let leftmost = Infinity;
      for (const block of east) {
        for (let seat = 1; seat <= block.rowSeats[row - 1]; seat++) {
          if (seatColour(block, row, seat) !== "seatOr") continue;
          const metres =
            (block.position + seatAcross(block, row, seat) - 26) * blockWidth(26, depth);
          leftmost = Math.min(leftmost, metres);
        }
      }
      leftEdges.push(leftmost);
    }
    const spread = Math.max(...leftEdges) - Math.min(...leftEdges);
    expect(spread).toBeLessThan(1.5); // within a couple of seats of each other
    expect(leftEdges[0]).toBeLessThan(-80); // and far to the left of the middle
  });
});

describe("text bitmap", () => {
  it("sets letters five dots wide with a gap between them and a wider one between words", () => {
    const rows = textBitmap("FC BARCELONA");
    expect(rows).toHaveLength(7);
    // 11 letters x 5, 9 gaps inside the two words, 3 for the space.
    expect(rows[0]).toHaveLength(11 * 5 + 9 + 3);
    expect(rows.every((row) => row.length === rows[0].length)).toBe(true);
    expect(rows[0].startsWith("#####.")).toBe(true);
  });
});
