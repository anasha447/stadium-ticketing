import type { Block, Level } from "@/lib/domain/types";
import { blockWidth, rowPitch, rowPlace, seatAcross } from "./layout";
import { CREST, SPOTIFY } from "./mark-bitmaps";

// The colour of every seat in stadium view: blue and garnet bands, with three
// marks drawn in yellow seats. Each mark is a small black-and-white bitmap
// laid onto the stand like a stencil. Pure functions, no Three.js.

export type SeatColour = "seatBlau" | "seatGrana" | "seatOr";

// --- The words, in a 5 x 7 dot font ---------------------------------------

const GLYPHS: Record<string, string[]> = {
  F: ["#####", "#....", "#....", "####.", "#....", "#....", "#...."],
  C: [".####", "#....", "#....", "#....", "#....", "#....", ".####"],
  B: ["####.", "#...#", "#...#", "####.", "#...#", "#...#", "####."],
  A: [".###.", "#...#", "#...#", "#####", "#...#", "#...#", "#...#"],
  R: ["####.", "#...#", "#...#", "####.", "#.#..", "#..#.", "#...#"],
  E: ["#####", "#....", "#....", "####.", "#....", "#....", "#####"],
  L: ["#....", "#....", "#....", "#....", "#....", "#....", "#####"],
  O: [".###.", "#...#", "#...#", "#...#", "#...#", "#...#", ".###."],
  N: ["#...#", "##..#", "#.#.#", "#.#.#", "#..##", "#...#", "#...#"],
};
const LETTER_GAP = ".";
const WORD_GAP = "...";

/** Sets a line of text as a bitmap, top row first. */
export function textBitmap(text: string): string[] {
  const rows = Array.from({ length: 7 }, () => "");
  [...text].forEach((char, i) => {
    const glyph = char === " " ? null : GLYPHS[char];
    if (char !== " " && !glyph) throw new Error(`No glyph for "${char}"`);
    for (let r = 0; r < 7; r++) {
      rows[r] += glyph ? glyph[r] : WORD_GAP;
      if (glyph && i < text.length - 1 && text[i + 1] !== " ") rows[r] += LETTER_GAP;
    }
  });
  return rows;
}

// --- Where each mark goes -------------------------------------------------

interface RowSpan {
  level: Level;
  from: number;
  to: number;
}

interface Mark {
  bitmap: string[];
  /** Ring position of the middle of the mark. */
  centre: number;
  /** The Rows it covers, front to back. */
  rows: RowSpan[];
  /** Width in metres. Left out, it follows from the height and the bitmap's shape. */
  width?: number;
}

const ALL_ROWS: RowSpan[] = [
  { level: "LOWER", from: 1, to: 24 },
  { level: "CLUB", from: 1, to: 12 },
  { level: "UPPER", from: 1, to: 28 },
];

const MARKS: Mark[] = [
  // The crest, in the middle of the west side, across all three Levels.
  { bitmap: CREST, centre: 6, rows: ALL_ROWS },
  // The Spotify symbol, behind the north goal, across all three Levels.
  { bitmap: SPOTIFY, centre: 16, rows: ALL_ROWS },
  // The words, along the east side of the upper Level. Set a little narrow
  // so they fit between the corners.
  {
    bitmap: textBitmap("FC BARCELONA"),
    centre: 26,
    rows: [{ level: "UPPER", from: 5, to: 25 }],
    width: 176,
  },
];

/** A mark made ready for looking up seats. */
interface PlacedMark {
  mark: Mark;
  width: number;
  /** "LOWER:7" -> how far up the mark that Row is, 0 at the front, 1 at the back. */
  up: Map<string, number>;
}

function place(mark: Mark): PlacedMark {
  const middles: [string, number][] = [];
  let height = 0;
  for (const { level, from, to } of mark.rows) {
    const pitch = rowPitch(level);
    for (let row = from; row <= to; row++) {
      middles.push([`${level}:${row}`, height + pitch / 2]);
      height += pitch;
    }
  }
  const shape = mark.bitmap[0].length / mark.bitmap.length;
  return {
    mark,
    width: mark.width ?? height * shape,
    up: new Map(middles.map(([key, at]) => [key, at / height])),
  };
}

const PLACED = MARKS.map(place);

function inMark({ mark, width, up }: PlacedMark, block: Block, row: number, seat: number): boolean {
  const upward = up.get(`${block.level}:${row}`);
  if (upward === undefined) return false;

  // Metres to the right of the mark's middle, measured along this Row. Using
  // metres, not Block counts, keeps the mark its true shape although Blocks
  // are wider at the back than at the front.
  const { depth } = rowPlace(block.level, row);
  const position = block.position + seatAcross(block, row, seat);
  const across = (position - mark.centre) * blockWidth(mark.centre, depth) / width + 0.5;
  if (across < 0 || across >= 1) return false;

  const bitmap = mark.bitmap;
  const line = bitmap[Math.min(bitmap.length - 1, Math.floor((1 - upward) * bitmap.length))];
  return line[Math.floor(across * line.length)] === "#";
}

/** Blue and garnet in bands, as in the photos of the stadium. */
function bandColour(level: Level, row: number): SeatColour {
  if (level === "LOWER") return "seatGrana";
  if (level === "CLUB") return "seatBlau";
  return row <= 14 ? "seatBlau" : "seatGrana";
}

/** The colour of a seat in stadium view. */
export function seatColour(block: Block, row: number, seat: number): SeatColour {
  for (const placed of PLACED) {
    if (inMark(placed, block, row, seat)) return "seatOr";
  }
  return bandColour(block.level, row);
}
