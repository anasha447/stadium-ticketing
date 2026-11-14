import { describe, expect, it } from "vitest";
import { crowdPoint, dotForPosition, DOTS, drawOrder, QUEUE_COLUMNS, queuePoint } from "./field";

const inside = ({ x, y }: { x: number; y: number }) => x >= 0 && x <= 1 && y >= 0 && y <= 1;

describe("Waiting Room picture", () => {
  it("keeps every dot inside the picture, in the crowd and in the queue", () => {
    for (let i = 0; i < DOTS; i++) {
      expect(inside(crowdPoint(i))).toBe(true);
      expect(inside(queuePoint(i))).toBe(true);
    }
  });

  it("puts the front of the queue at the top, filling row by row", () => {
    expect(queuePoint(0).y).toBeLessThan(queuePoint(QUEUE_COLUMNS).y);
    expect(queuePoint(0).x).toBeLessThan(queuePoint(1).x);
    expect(queuePoint(QUEUE_COLUMNS - 1).y).toBe(queuePoint(0).y);
  });

  it("gives no two dots the same place in the queue", () => {
    const seen = new Set(Array.from({ length: DOTS }, (_, i) => JSON.stringify(queuePoint(i))));
    expect(seen.size).toBe(DOTS);
  });

  it("shuffles every dot into exactly one place at the Draw", () => {
    const order = drawOrder(7);
    expect([...order].sort((a, b) => a - b)).toEqual(Array.from({ length: DOTS }, (_, i) => i));
    // A real shuffle: most dots do not keep their number.
    expect(order.filter((place, i) => place === i).length).toBeLessThan(DOTS / 10);
  });

  it("draws the same shuffle for the same seed and a different one otherwise", () => {
    expect(drawOrder(7)).toEqual(drawOrder(7));
    expect(drawOrder(7)).not.toEqual(drawOrder(8));
  });

  it("stands a Fan at the front, the middle or the back according to their position", () => {
    expect(dotForPosition(1, 3600)).toBe(0);
    expect(dotForPosition(1801, 3600)).toBe(DOTS / 2);
    expect(dotForPosition(3600, 3600)).toBe(DOTS - 1);
  });
});
