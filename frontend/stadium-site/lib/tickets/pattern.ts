// The square code printed on a Ticket in this demo. It only looks like a
// QR code: three corner squares and a pattern made from the Ticket id. It
// cannot be scanned and proves nothing. Entry will use the Rotating
// Credential, which changes every few seconds and is never printed.

/** Cells per side, the size of the smallest real QR code. */
export const PATTERN_SIZE = 21;

/** A repeatable stream of numbers in [0, 1) from a text, so a Ticket always looks the same. */
function streamFrom(text: string): () => number {
  let seed = 2166136261;
  for (let i = 0; i < text.length; i++) seed = Math.imul(seed ^ text.charCodeAt(i), 16777619);
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** True inside one of the three 7 × 7 corner squares, or the gap of one cell around them. */
export function inCorner(row: number, col: number, size = PATTERN_SIZE): boolean {
  const top = row < 8;
  const left = col < 8;
  return (top && left) || (top && col >= size - 8) || (row >= size - 8 && left);
}

/** The dark cell of a corner square: a ring with a solid 3 × 3 centre. */
function cornerCell(row: number, col: number, size: number): boolean {
  const r = row < 8 ? row : row - (size - 7);
  const c = col < 8 ? col : col - (size - 7);
  if (r < 0 || r > 6 || c < 0 || c > 6) return false; // the light gap
  const ring = r === 0 || r === 6 || c === 0 || c === 6;
  const centre = r >= 2 && r <= 4 && c >= 2 && c <= 4;
  return ring || centre;
}

/** Which cells are dark, row by row. */
export function ticketPattern(ticketId: string, size = PATTERN_SIZE): boolean[][] {
  const next = streamFrom(ticketId);
  return Array.from({ length: size }, (_, row) =>
    Array.from({ length: size }, (_, col) =>
      inCorner(row, col, size) ? cornerCell(row, col, size) : next() < 0.5,
    ),
  );
}
