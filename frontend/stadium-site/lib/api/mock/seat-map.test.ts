import { describe, expect, it } from "vitest";
import { blockSeatCount, formatSeatId, parseSeatId, seatOffset } from "@/lib/domain/seat-id";
import { generateSeatMap, tierOf } from "./seat-map";
import { soldSeats } from "./sold-seats";

describe("Seat Map", () => {
  const map = generateSeatMap(1);

  it("has 40 Blocks on each of the three Levels, numbered 101-140, 201-240, 301-340", () => {
    expect(map.blocks).toHaveLength(120);
    expect(map.blocks[0].id).toBe("101");
    expect(map.blocks[39].id).toBe("140");
    expect(map.blocks[40].id).toBe("201");
    expect(map.blocks[119].id).toBe("340");
    expect(new Set(map.blocks.map((b) => b.id)).size).toBe(120);
  });

  it("holds about 60,000 seats", () => {
    const counted = map.blocks.reduce((sum, b) => sum + blockSeatCount(b), 0);
    expect(map.seatCount).toBe(counted);
    expect(map.seatCount).toBeGreaterThan(58_000);
    expect(map.seatCount).toBeLessThan(62_000);
  });

  it("is the same every time", () => {
    expect(generateSeatMap(1)).toEqual(map);
  });

  it("puts the best Tiers on the long sides and the cheapest behind the goals", () => {
    expect(tierOf("CLUB", 6)).toBe("CLUB_PREMIUM"); // middle of the west side
    expect(tierOf("LOWER", 26)).toBe("CATEGORY_1"); // middle of the east side
    expect(tierOf("LOWER", 0)).toBe("CATEGORY_2"); // corner
    expect(tierOf("LOWER", 16)).toBe("CATEGORY_3"); // behind the north goal
    expect(tierOf("UPPER", 36)).toBe("CATEGORY_3"); // behind the south goal
    expect(new Set(map.blocks.map((b) => b.tier)).size).toBe(4);
  });
});

describe("seat ids", () => {
  it("round-trip through format and parse", () => {
    const id = formatSeatId({ blockId: "214", row: 7, seat: 12 });
    expect(id).toBe("214-R07-12");
    expect(parseSeatId(id)).toEqual({ blockId: "214", row: 7, seat: 12 });
  });

  it("reject anything that is not a seat id", () => {
    expect(parseSeatId("W-S03-R07-12")).toBeNull();
    expect(parseSeatId("414-R01-01")).toBeNull();
  });

  it("find a seat inside the state string of its Block", () => {
    const block = generateSeatMap(1).blocks[0];
    expect(seatOffset(block, 1, 1)).toBe(0);
    expect(seatOffset(block, 2, 1)).toBe(block.rowSeats[0]);
    expect(seatOffset(block, 1, block.rowSeats[0] + 1)).toBe(-1);
    expect(seatOffset(block, 99, 1)).toBe(-1);
  });
});

describe("sold seats", () => {
  it("are about half the stadium for a Match selling at 50%", () => {
    const { counts } = soldSeats(1, 0.5);
    const sold = Object.values(counts).reduce((sum, c) => sum + c.sold, 0);
    const share = sold / generateSeatMap(1).seatCount;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });

  it("come in clumps: a sold seat usually has a sold neighbour", () => {
    const { blocks } = soldSeats(1, 0.5);
    const block = generateSeatMap(1).blocks[0];
    const states = blocks[block.id];
    let sold = 0;
    let withSoldNeighbour = 0;
    let offset = 0;
    for (const seats of block.rowSeats) {
      for (let s = 0; s < seats; s++) {
        if (states[offset + s] !== "S") continue;
        sold++;
        const left = s > 0 && states[offset + s - 1] === "S";
        const right = s < seats - 1 && states[offset + s + 1] === "S";
        if (left || right) withSoldNeighbour++;
      }
      offset += seats;
    }
    expect(withSoldNeighbour / sold).toBeGreaterThan(0.8);
  });

  it("are the same on every load, and differ between Matches", () => {
    expect(soldSeats(1, 0.5).blocks["101"]).toBe(soldSeats(1, 0.5).blocks["101"]);
    expect(soldSeats(1, 0.5).blocks["101"]).not.toBe(soldSeats(7, 0.5).blocks["101"]);
  });

  it("are none at all for a Match that has not opened", () => {
    const { counts } = soldSeats(2, 0);
    expect(Object.values(counts).every((c) => c.sold === 0)).toBe(true);
  });
});
