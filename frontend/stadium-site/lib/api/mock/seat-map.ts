import type { Block, Level, Money, SeatMap, Tier } from "@/lib/domain/types";
import { blockSeatCount } from "@/lib/domain/seat-id";
import { BLOCKS_PER_LEVEL, sideOf } from "@/lib/domain/stadium";

// Generates the Seat Map: 3 Levels x 40 Blocks, about 60,000 seats.
// Pure and deterministic: the same call always returns the same map.

interface LevelShape {
  level: Level;
  /** First digit of the Block number. */
  prefix: 1 | 2 | 3;
  rows: number;
  /** Seats in the front Row and in the back Row; Rows in between grow evenly. */
  frontRowSeats: number;
  backRowSeats: number;
}

const LEVELS: LevelShape[] = [
  { level: "LOWER", prefix: 1, rows: 24, frontRowSeats: 18, backRowSeats: 24 },
  { level: "CLUB", prefix: 2, rows: 12, frontRowSeats: 22, backRowSeats: 25 },
  { level: "UPPER", prefix: 3, rows: 28, frontRowSeats: 22, backRowSeats: 30 },
];

export const BASE_PRICE: Record<Tier, Money> = {
  CLUB_PREMIUM: "650.00",
  CATEGORY_1: "320.00",
  CATEGORY_2: "180.00",
  CATEGORY_3: "90.00",
};

/**
 * Best seats along the long sides, cheapest behind the goals.
 * The two Blocks at each end of a long side are the corners.
 */
export function tierOf(level: Level, position: number): Tier {
  const { side, index, length } = sideOf(position);
  const longSide = side === "WEST" || side === "EAST";
  const corner = index < 2 || index >= length - 2;

  if (!longSide) {
    return level === "CLUB" ? "CATEGORY_2" : "CATEGORY_3";
  }
  switch (level) {
    case "CLUB":
      return corner ? "CATEGORY_1" : "CLUB_PREMIUM";
    case "LOWER":
      return corner ? "CATEGORY_2" : "CATEGORY_1";
    case "UPPER":
      return "CATEGORY_2";
  }
}

function rowSeats({ rows, frontRowSeats, backRowSeats }: LevelShape): number[] {
  return Array.from({ length: rows }, (_, row) =>
    Math.round(frontRowSeats + ((backRowSeats - frontRowSeats) * row) / (rows - 1)),
  );
}

function buildBlocks(): Block[] {
  return LEVELS.flatMap((shape) =>
    Array.from({ length: BLOCKS_PER_LEVEL }, (_, position): Block => {
      const tier = tierOf(shape.level, position);
      return {
        id: `${shape.prefix}${String(position + 1).padStart(2, "0")}`,
        level: shape.level,
        position,
        side: sideOf(position).side,
        tier,
        basePrice: BASE_PRICE[tier],
        rowSeats: rowSeats(shape),
      };
    }),
  );
}

// Every Match is played in the same stadium, so the Blocks are built once.
const BLOCKS = buildBlocks();
const SEAT_COUNT = BLOCKS.reduce((sum, block) => sum + blockSeatCount(block), 0);
const BLOCKS_BY_ID = new Map(BLOCKS.map((block) => [block.id, block]));

export function generateSeatMap(matchId: number): SeatMap {
  return { matchId, currency: "EUR", seatCount: SEAT_COUNT, blocks: BLOCKS };
}

export function findBlock(blockId: string): Block | undefined {
  return BLOCKS_BY_ID.get(blockId);
}
