import { blockSeatCount } from "@/lib/domain/seat-id";
import type { Block } from "@/lib/domain/types";
import { seatPlace } from "./layout";
import { seatColour, type SeatColour } from "./mosaic";

// Lays out every seat for the 3D view: one transform and one colour each.
// Seats are in the same order as the Seat States strings (Block by Block,
// Rows front to back, seats left to right), so a seat's state and its place
// in the 3D model share one number. No Three.js here.

export const SEAT_COLOURS: SeatColour[] = ["seatBlau", "seatGrana", "seatOr"];

export interface SeatInstances {
  count: number;
  /** 16 numbers per seat: a 4x4 transform, in the order Three.js stores it. */
  matrices: Float32Array;
  /** One index into SEAT_COLOURS per seat. */
  colours: Uint8Array;
  /** Where each Block's seats start. */
  blockStart: Record<string, number>;
}

export function buildSeats(blocks: Block[]): SeatInstances {
  const count = blocks.reduce((sum, block) => sum + blockSeatCount(block), 0);
  const matrices = new Float32Array(count * 16);
  const colours = new Uint8Array(count);
  const blockStart: Record<string, number> = {};

  let index = 0;
  for (const block of blocks) {
    blockStart[block.id] = index;
    block.rowSeats.forEach((seats, r) => {
      for (let seat = 1; seat <= seats; seat++) {
        const { x, y, z, nx, nz } = seatPlace(block, r + 1, seat);
        // Turn the seat about the vertical so its front (+z) faces the pitch.
        const turn = Math.atan2(-nx, -nz);
        const cos = Math.cos(turn);
        const sin = Math.sin(turn);
        matrices.set([cos, 0, -sin, 0, 0, 1, 0, 0, sin, 0, cos, 0, x, y, z, 1], index * 16);
        colours[index] = SEAT_COLOURS.indexOf(seatColour(block, r + 1, seat));
        index++;
      }
    });
  }
  return { count, matrices, colours, blockStart };
}
