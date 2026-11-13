import type { Block, Level, Money, SeatMap, Side, Tier } from "@/lib/domain/types";
import { blockSeatCount } from "@/lib/domain/seat-id";

// Generates the Seat Map: 3 Levels x 40 Blocks, about 60,000 seats.
// Pure and deterministic: the same call always returns the same map.

export const BLOCKS_PER_LEVEL = 40;

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

// Going clockwise from the south-west corner: 13 Blocks along the west side,
// 7 behind the north goal, 13 along the east side, 7 behind the south goal.
const SIDES: { side: Side; blocks: number }[] = [
  { side: "WEST", blocks: 13 },
  { side: "NORTH", blocks: 7 },
  { side: "EAST", blocks: 13 },
  { side: "SOUTH", blocks: 7 },
];

/** The side a position is on, and how far along that side it is. */
export function sideOf(position: number): { side: Side; index: number; length: number } {
  let start = 0;
  for (const { side, blocks } of SIDES) {
    if (position < start + blocks) {
      return { side, index: position - start, length: blocks };
    }
    start += blocks;
  }
  throw new RangeError(`No Block at position ${position}`);
}

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
