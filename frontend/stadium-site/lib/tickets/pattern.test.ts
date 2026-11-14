import { describe, expect, it } from "vitest";
import { inCorner, PATTERN_SIZE, ticketPattern } from "./pattern";

describe("the Ticket's code", () => {
  it("is a square of the set size", () => {
    const cells = ticketPattern("t-1");
    expect(cells).toHaveLength(PATTERN_SIZE);
    for (const row of cells) expect(row).toHaveLength(PATTERN_SIZE);
  });

  it("is the same every time for one Ticket, and different for another", () => {
    expect(ticketPattern("t-1")).toEqual(ticketPattern("t-1"));
    expect(ticketPattern("t-1")).not.toEqual(ticketPattern("t-2"));
  });

  it("has the three corner squares, each with a light gap round it", () => {
    const cells = ticketPattern("t-1");
    const last = PATTERN_SIZE - 1;
    for (const [row, col] of [[0, 0], [0, last - 6], [last - 6, 0]]) {
      expect(cells[row][col]).toBe(true); // the ring's corner
      expect(cells[row + 1][col + 1]).toBe(false); // inside the ring
      expect(cells[row + 3][col + 3]).toBe(true); // the centre
    }
    expect(cells[7][0]).toBe(false);
    expect(cells[0][last - 7]).toBe(false);
    // The fourth corner has no square.
    expect(inCorner(last, last)).toBe(false);
  });

  it("fills the rest about half dark", () => {
    const cells = ticketPattern("some-ticket-id");
    let dark = 0;
    let all = 0;
    cells.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (inCorner(r, c)) return;
        all++;
        if (cell) dark++;
      }),
    );
    expect(dark / all).toBeGreaterThan(0.35);
    expect(dark / all).toBeLessThan(0.65);
  });
});
