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
    expect(yellowIn(on("NORTH"))).toBeGreaterThan(1800);
    expect(yellowIn(on("SOUTH"))).toBe(0);
  });

  it("puts the words on the east side of the upper Level only", () => {
    expect(yellowIn((b) => b.side === "EAST" && b.level === "UPPER")).toBeGreaterThan(1000);
    expect(yellowIn((b) => b.side === "EAST" && b.level !== "UPPER")).toBe(0);
  });

  it("leaves most seats blue or garnet", () => {
    const yellow = yellowIn(() => true);
    expect(yellow / seats.count).toBeGreaterThan(0.04);
    expect(yellow / seats.count).toBeLessThan(0.3);
  });

  /** For each Row of the upper east side that has yellow seats: the leftmost one, in metres from the middle. */
  function wordRows(): { row: number; left: number; right: number }[] {
    const east = map.blocks.filter((b) => b.side === "EAST" && b.level === "UPPER");
    const found = [];
    for (let row = 1; row <= 28; row++) {
      const { depth } = rowPlace("UPPER", row);
      let left = Infinity;
      let right = -Infinity;
      for (const block of east) {
        for (let seat = 1; seat <= block.rowSeats[row - 1]; seat++) {
          if (seatColour(block, row, seat) !== "seatOr") continue;
          const metres =
            (block.position + seatAcross(block, row, seat) - 26) * blockWidth(26, depth);
          left = Math.min(left, metres);
          right = Math.max(right, metres);
        }
      }
      if (left !== Infinity) found.push({ row, left, right });
    }
    return found;
  }

  /** Yellow seats of the words between two distances from the middle, in metres. */
  function wordSeatsBetween(from: number, to: number): number {
    const east = map.blocks.filter((b) => b.side === "EAST" && b.level === "UPPER");
    let yellow = 0;
    for (let row = 1; row <= 28; row++) {
      const { depth } = rowPlace("UPPER", row);
      for (const block of east) {
        for (let seat = 1; seat <= block.rowSeats[row - 1]; seat++) {
          const metres =
            (block.position + seatAcross(block, row, seat) - 26) * blockWidth(26, depth);
          if (metres >= from && metres <= to && seatColour(block, row, seat) === "seatOr") yellow++;
        }
      }
    }
    return yellow;
  }

  it("sets the words the right way round: the gap after FC is on the left", () => {
    // Left, seen from the pitch, is the low-numbered end of the east side.
    // The only gap between words comes after "FC", near the left end. The
    // same distance to the right of the middle falls inside "ONA".
    const dot = 132 / 68; // metres per dot of the lettering
    const gapFrom = -66 + 11 * dot + 0.4;
    const gapTo = -66 + 14 * dot - 0.4;
    expect(wordSeatsBetween(gapFrom, gapTo)).toBe(0);
    expect(wordSeatsBetween(-gapTo, -gapFrom)).toBeGreaterThan(20);
  });

  it("centres the words on the east side, up and down and side to side", () => {
    const rows = wordRows();
    // As many clear Rows in front of the words as behind them, give or take one.
    const clearInFront = rows[0].row - 1;
    const clearBehind = 28 - rows.at(-1)!.row;
    expect(Math.abs(clearInFront - clearBehind)).toBeLessThanOrEqual(1);
    // And the words reach as far left of the middle as right of it.
    const left = Math.min(...rows.map((r) => r.left));
    const right = Math.max(...rows.map((r) => r.right));
    expect(Math.abs(left + right)).toBeLessThan(3);
    expect(right - left).toBeGreaterThan(120);
    expect(right - left).toBeLessThan(134);
  });

  it("centres the crest and the Spotify symbol on their sides", () => {
    for (const [side, centre] of [["WEST", 6], ["NORTH", 16]] as const) {
      let weighted = 0;
      let yellow = 0;
      for (const block of map.blocks.filter((b) => b.side === side)) {
        block.rowSeats.forEach((seatCount, r) => {
          for (let seat = 1; seat <= seatCount; seat++) {
            if (seatColour(block, r + 1, seat) !== "seatOr") continue;
            weighted += block.position + seatAcross(block, r + 1, seat) - centre;
            yellow++;
          }
        });
      }
      // The average yellow seat sits on the middle of the side. The crest is
      // not perfectly symmetrical, so allow a fifth of a Block.
      expect(Math.abs(weighted / yellow)).toBeLessThan(0.2);
    }
  });

  it("leaves the front and back Rows of each side clear of the marks", () => {
    const clear = (b: Block, row: number) =>
      b.rowSeats[row - 1] ===
      Array.from({ length: b.rowSeats[row - 1] }, (_, i) => seatColour(b, row, i + 1)).filter(
        (c) => c !== "seatOr",
      ).length;
    for (const b of map.blocks.filter((x) => x.side === "WEST" || x.side === "NORTH")) {
      if (b.level === "LOWER") expect(clear(b, 1)).toBe(true);
      if (b.level === "UPPER") expect(clear(b, 28)).toBe(true);
    }
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
