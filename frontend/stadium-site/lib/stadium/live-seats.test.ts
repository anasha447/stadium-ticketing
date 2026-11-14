import { describe, expect, it } from "vitest";
import type { Block } from "@/lib/domain/types";
import { applyDeltas, countSeats, takenSeats } from "./live-seats";

// Two small Blocks: 101 has Rows of 3 and 4 seats, 102 one Row of 2.
const block = (id: string, rowSeats: number[]): Block => ({
  id,
  level: "LOWER",
  position: 0,
  side: "WEST",
  tier: "CATEGORY_1",
  basePrice: "320.00",
  rowSeats,
});
const blocks = new Map([
  ["101", block("101", [3, 4])],
  ["102", block("102", [2])],
]);

describe("applyDeltas", () => {
  const states = { "101": "AAASSAA", "102": "AA" };

  it("puts each changed seat in its new state", () => {
    const next = applyDeltas(
      states,
      [
        { state: "H", seatIds: ["101-R01-02", "101-R02-04"] },
        { state: "S", seatIds: ["102-R01-01"] },
      ],
      blocks,
    );
    expect(next).toEqual({ "101": "AHASSAH", "102": "SA" });
  });

  it("applies changes in order, so the last one wins", () => {
    const next = applyDeltas(
      states,
      [
        { state: "H", seatIds: ["101-R01-01"] },
        { state: "S", seatIds: ["101-R01-01"] },
      ],
      blocks,
    );
    expect(next["101"]).toBe("SAASSAA");
  });

  it("leaves the states it was given untouched", () => {
    applyDeltas(states, [{ state: "H", seatIds: ["101-R01-01"] }], blocks);
    expect(states).toEqual({ "101": "AAASSAA", "102": "AA" });
  });

  it("keeps the strings of Blocks that did not change", () => {
    const next = applyDeltas(states, [{ state: "H", seatIds: ["101-R01-01"] }], blocks);
    expect(next["102"]).toBe(states["102"]);
  });

  it("returns the same object when nothing ends up different", () => {
    expect(applyDeltas(states, [], blocks)).toBe(states);
    // Already sold, and held then let go again.
    const same = applyDeltas(
      states,
      [
        { state: "S", seatIds: ["101-R02-01"] },
        { state: "H", seatIds: ["102-R01-02"] },
        { state: "A", seatIds: ["102-R01-02"] },
      ],
      blocks,
    );
    expect(same).toBe(states);
  });

  it("skips Blocks that have not been read, and seats that do not exist", () => {
    const onlyOne = { "101": "AAASSAA" };
    const next = applyDeltas(
      onlyOne,
      [{ state: "H", seatIds: ["102-R01-01", "101-R09-01", "101-R01-09", "140-R01-01", "nonsense"] }],
      blocks,
    );
    expect(next).toBe(onlyOne);
  });
});

describe("takenSeats", () => {
  const chosen = ["101-R01-01", "101-R01-02", "101-R01-03"];

  it("names the chosen seats that were held or sold", () => {
    const taken = takenSeats(
      [
        { state: "H", seatIds: ["101-R01-02", "102-R01-01"] },
        { state: "S", seatIds: ["101-R01-03"] },
      ],
      chosen,
    );
    expect(taken).toEqual(["101-R01-02", "101-R01-03"]);
  });

  it("does not count a seat that was let go again", () => {
    const taken = takenSeats(
      [
        { state: "H", seatIds: ["101-R01-01"] },
        { state: "A", seatIds: ["101-R01-01"] },
      ],
      chosen,
    );
    expect(taken).toEqual([]);
  });

  it("is empty when nothing chosen changed", () => {
    expect(takenSeats([{ state: "H", seatIds: ["102-R01-01"] }], chosen)).toEqual([]);
    expect(takenSeats([{ state: "A", seatIds: ["101-R01-01"] }], chosen)).toEqual([]);
  });
});

describe("countSeats", () => {
  it("counts available, held and sold seats per Block", () => {
    expect(countSeats({ "101": "AHASSAH", "102": "SS" })).toEqual({
      "101": { available: 3, held: 2, sold: 2 },
      "102": { available: 0, held: 0, sold: 2 },
    });
  });
});
