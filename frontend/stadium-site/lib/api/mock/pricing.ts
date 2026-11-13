import type { Money, QuoteLine } from "@/lib/domain/types";
import { areAdjacent, parseSeatId } from "@/lib/domain/seat-id";
import { findBlock } from "./seat-map";

// Stands in for the pricing module of `inventory` (DESIGN §6-7). It lives in
// the mock on purpose: screens never work out a price, they show the Quote.
// All sums are done in cents, as whole numbers.

/** Group Discount by position in the Hold: first seat 0%, then 5, 10, 15. */
const GROUP_DISCOUNT = [0, 5, 10, 15];

export function toCents(money: Money): number {
  const [units, cents = ""] = money.split(".");
  return Number(units) * 100 + Number(cents.padEnd(2, "0"));
}

export function toMoney(cents: number): Money {
  return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, "0")}`;
}

/** Divide and round half to even, the way the backend rounds money. */
function divideHalfEven(numerator: number, denominator: number): number {
  const quotient = Math.floor(numerator / denominator);
  const twiceRemainder = (numerator - quotient * denominator) * 2;
  if (twiceRemainder > denominator) return quotient + 1;
  if (twiceRemainder < denominator) return quotient;
  return quotient % 2 === 0 ? quotient : quotient + 1;
}

/**
 * One line per seat. The Group Discount only applies when the seats sit
 * together in one Row; otherwise every seat is at its base price.
 */
export function priceSeats(seatIds: string[]): { lines: QuoteLine[]; total: Money } {
  const seats = seatIds.map((seatId) => parseSeatId(seatId)!);
  const together = seats.length > 1 && areAdjacent(seats);

  let totalCents = 0;
  const lines = seatIds.map((seatId, position): QuoteLine => {
    const block = findBlock(seats[position].blockId)!;
    const discountPercent = together ? GROUP_DISCOUNT[position] : 0;
    const cents = divideHalfEven(toCents(block.basePrice) * (100 - discountPercent), 100);
    totalCents += cents;
    return {
      seatId,
      tier: block.tier,
      basePrice: block.basePrice,
      discountPercent,
      price: toMoney(cents),
    };
  });
  return { lines, total: toMoney(totalCents) };
}
