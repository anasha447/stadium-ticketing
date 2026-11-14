import { describe, expect, it } from "vitest";
import { generateSeatMap } from "@/lib/api/mock/seat-map";
import { countdown } from "./countdown";
import {
  addSeat,
  isChosen,
  isFull,
  MAX_SEATS,
  removeSeat,
  removeSeatIds,
  seatIdOf,
  seatsTogether,
} from "./selection";

const seat = (n: number) => ({ blockId: "107", row: 3, seat: n });

describe("Your seats", () => {
  it("adds seats in the order they were chosen", () => {
    const chosen = addSeat(addSeat([], seat(5)), seat(6));
    expect(chosen.map(seatIdOf)).toEqual(["107-R03-05", "107-R03-06"]);
    expect(isChosen(chosen, seat(5))).toBe(true);
    expect(isChosen(chosen, seat(7))).toBe(false);
  });

  it("does not add the same seat twice", () => {
    const once = addSeat([], seat(5));
    expect(addSeat(once, seat(5))).toBe(once);
  });

  it("stops at four, the size of a Hold", () => {
    let chosen = [seat(1), seat(2), seat(3)];
    expect(isFull(chosen)).toBe(false);
    chosen = addSeat(chosen, seat(4));
    expect(chosen).toHaveLength(MAX_SEATS);
    expect(isFull(chosen)).toBe(true);
    expect(addSeat(chosen, seat(5))).toBe(chosen);
  });

  it("removes one seat, or the seats the backend says were taken", () => {
    const chosen = [seat(1), seat(2), seat(3)];
    expect(removeSeat(chosen, seat(2)).map((s) => s.seat)).toEqual([1, 3]);
    expect(removeSeatIds(chosen, ["107-R03-01", "107-R03-03"]).map((s) => s.seat)).toEqual([2]);
  });
});

describe("pick seats together", () => {
  // A made-up Block: three Rows of five seats.
  const block = { ...generateSeatMap(1).blocks[0], id: "101", rowSeats: [5, 5, 5] };

  it("finds neighbours in one Row, nearest the middle of the Block", () => {
    //              Row 1    Row 2    Row 3
    const states = "AAAAA" + "SAAAS" + "AAAAA";
    const picked = seatsTogether(block, states, 3)!;
    expect(picked.map((s) => [s.row, s.seat])).toEqual([[2, 2], [2, 3], [2, 4]]);
  });

  it("never spans a sold seat", () => {
    const states = "AASAA" + "SSSSS" + "AASAA";
    expect(seatsTogether(block, states, 3)).toBeNull();
    const pair = seatsTogether(block, states, 2)!;
    expect(pair[0].row).toBe(pair[1].row);
    expect(pair[1].seat).toBe(pair[0].seat + 1);
    expect(pair.every((s) => s.seat !== 3)).toBe(true);
  });

  it("gives up when the Block has no such run", () => {
    expect(seatsTogether(block, "S".repeat(15), 2)).toBeNull();
  });
});

describe("Hold countdown", () => {
  const expiresAt = "2026-11-14T10:08:00.000Z";
  const at = (iso: string) => Date.parse(iso);

  it("counts from the Hold's expiry time, as minutes and seconds", () => {
    expect(countdown(expiresAt, at("2026-11-14T10:00:00.000Z")).text).toBe("8:00");
    expect(countdown(expiresAt, at("2026-11-14T10:00:00.500Z")).text).toBe("8:00");
    expect(countdown(expiresAt, at("2026-11-14T10:00:01.000Z")).text).toBe("7:59");
    expect(countdown(expiresAt, at("2026-11-14T10:07:55.000Z")).text).toBe("0:05");
  });

  it("warns under a minute and turns to danger under 15 seconds", () => {
    expect(countdown(expiresAt, at("2026-11-14T10:07:00.000Z")).tone).toBe("calm");
    expect(countdown(expiresAt, at("2026-11-14T10:07:01.000Z")).tone).toBe("warn");
    expect(countdown(expiresAt, at("2026-11-14T10:07:45.000Z")).tone).toBe("warn");
    expect(countdown(expiresAt, at("2026-11-14T10:07:46.000Z")).tone).toBe("danger");
  });

  it("stops at zero and says the Hold has run out", () => {
    const over = countdown(expiresAt, at("2026-11-14T10:09:00.000Z"));
    expect(over).toMatchObject({ seconds: 0, text: "0:00", expired: true });
    expect(countdown(expiresAt, at("2026-11-14T10:07:59.500Z")).expired).toBe(false);
  });
});
