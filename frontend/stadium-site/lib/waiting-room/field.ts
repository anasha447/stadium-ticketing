// Where the dots of the Waiting Room picture go. The crowd is drawn as a few
// hundred dots, each standing for several Fans, in two arrangements: a loose
// crowd before the Draw, and a queue after it. Pure maths, no drawing.
//
// Coordinates run from 0 to 1 across the picture and 0 to 1 down it.

export const DOTS = 360;

/** Dots per row of the queue. The front of the queue is the top row. */
export const QUEUE_COLUMNS = 24;

export interface Point {
  x: number;
  y: number;
}

/** A repeatable number in [0, 1) for a dot and a purpose. */
function scatter(index: number, salt: number): number {
  const value = Math.sin(index * 127.1 + salt * 311.7) * 43758.5453;
  return value - Math.floor(value);
}

/** Before the Draw: Fans standing about in no order, filling an oval. */
export function crowdPoint(index: number): Point {
  // Square root spreads dots evenly over the area instead of bunching in the middle.
  const radius = Math.sqrt(scatter(index, 1)) * 0.46;
  const angle = scatter(index, 2) * Math.PI * 2;
  return { x: 0.5 + Math.cos(angle) * radius, y: 0.58 + Math.sin(angle) * radius * 0.72 };
}

/** After the Draw: place 0 is the front left, filling row by row. */
export function queuePoint(place: number): Point {
  const column = place % QUEUE_COLUMNS;
  const row = Math.floor(place / QUEUE_COLUMNS);
  const rows = Math.ceil(DOTS / QUEUE_COLUMNS);
  return {
    x: 0.06 + (column / (QUEUE_COLUMNS - 1)) * 0.88,
    // The top fifth is left clear for the way in.
    y: 0.22 + (row / (rows - 1)) * 0.72,
  };
}

/**
 * The Draw as the picture shows it: which place each dot gets. It is a
 * shuffle of all the dots, so every dot moves, the Fan's among them.
 * `seed` changes the shuffle; the same seed gives the same one.
 */
export function drawOrder(seed: number): number[] {
  const order = Array.from({ length: DOTS }, (_, i) => i);
  for (let i = DOTS - 1; i > 0; i--) {
    const j = Math.floor(scatter(i, seed + 3) * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return order;
}

/**
 * Which dot of the queue stands for a Fan at `position` (1 is next) in a
 * queue that started `waiting` long. Dots stand for several Fans each.
 */
export function dotForPosition(position: number, waiting: number): number {
  const share = (position - 1) / waiting;
  return Math.min(DOTS - 1, Math.max(0, Math.floor(share * DOTS)));
}
