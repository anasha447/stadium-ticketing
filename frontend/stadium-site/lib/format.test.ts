import { describe, expect, it } from "vitest";
import { formatCount, formatDay, formatMoney, formatShortDay, formatTime } from "./format";

describe("format", () => {
  it("shows kickoff in the stadium's time, whatever the Fan's time zone", () => {
    // 20:00 UTC in December is 21:00 in Barcelona.
    expect(formatTime("2026-12-19T20:00:00Z")).toBe("21:00");
    expect(formatDay("2026-12-19T20:00:00Z")).toBe("Saturday 19 December");
    expect(formatShortDay("2026-12-19T20:00:00Z")).toBe("Sat 19 Dec");
  });

  it("rolls the day over when the stadium is already past midnight", () => {
    expect(formatShortDay("2026-12-19T23:30:00Z")).toBe("Sun 20 Dec");
  });

  it("drops the cents from whole amounts and keeps them otherwise", () => {
    expect(formatMoney("650.00", "EUR")).toBe("€650");
    expect(formatMoney("1184.00", "EUR")).toBe("€1,184");
    expect(formatMoney("304.50", "EUR")).toBe("€304.50");
  });

  it("groups thousands", () => {
    expect(formatCount(60560)).toBe("60,560");
  });
});
