import { describe, expect, it } from "vitest";
import { generateSeatMap } from "@/lib/api/mock/seat-map";
import { blocksNear, buildFans, FAN_SHIRTS, isVisitingEnd } from "./fans";
import { PITCH } from "./layout";
import { matchAt } from "./match-play";
import { buildSeats } from "./seats";

const blocks = generateSeatMap(1).blocks;
const seats = buildSeats(blocks);

/** Every seat of a Block in one state. */
const all = (blockId: string, state: string) => {
  const block = blocks.find((b) => b.id === blockId)!;
  return state.repeat(block.rowSeats.reduce((sum, n) => sum + n, 0));
};

describe("fans", () => {
  it("puts one fan on every sold seat and none anywhere else", () => {
    const states = { "101": "SASHA" + all("101", "A").slice(5), "102": all("102", "H") };
    const fans = buildFans(blocks, seats, states);
    expect(fans.count).toBe(2);
    expect(fans.matrices).toHaveLength(32);
  });

  it("sits each fan exactly on their seat", () => {
    const states = { "205": "AAS" + all("205", "A").slice(3) };
    const fans = buildFans(blocks, seats, states);
    const seat = seats.blockStart["205"] + 2;
    expect([...fans.matrices]).toEqual([...seats.matrices.subarray(seat * 16, seat * 16 + 16)]);
  });

  it("has no fans for a Block whose Seat States are not known yet", () => {
    expect(buildFans(blocks, seats, {}).count).toBe(0);
  });

  it("dresses the south end in the visiting colours and everyone else in the home colours", () => {
    const states = Object.fromEntries(blocks.map((b) => [b.id, all(b.id, "S")]));
    const fans = buildFans(blocks, seats, states);
    expect(fans.count).toBe(seats.count);

    const worn = { home: new Set<string>(), visiting: new Set<string>() };
    for (let i = 0; i < fans.count; i++) {
      const end = isVisitingEnd(fans.matrices[i * 16 + 14]) ? "visiting" : "home";
      worn[end].add(FAN_SHIRTS[fans.shirts[i]]);
    }
    expect([...worn.home].sort()).toEqual(["seatBlau", "seatGrana"]);
    expect([...worn.visiting].sort()).toEqual(["flood50", "sceneKitAway"]);
  });

  it("can be built for some Blocks only, and the two halves add up to everyone", () => {
    const states = Object.fromEntries(blocks.map((b) => [b.id, all(b.id, "S")]));
    const near = blocksNear(blocks, seats, "107");
    const close = buildFans(blocks, seats, states, (id) => near.has(id));
    const rest = buildFans(blocks, seats, states, (id) => !near.has(id));
    expect(close.count).toBeGreaterThan(0);
    expect(close.count + rest.count).toBe(seats.count);
  });

  it("counts a Block, its neighbours and the Level above it as near, and the far side as not", () => {
    const near = blocksNear(blocks, seats, "107");
    expect(near.has("107")).toBe(true);
    expect(near.has("106")).toBe(true);
    expect(near.has("108")).toBe(true);
    expect(near.has("207")).toBe(true);
    expect(near.has("127")).toBe(false);
    // A handful of Blocks, not half the stadium.
    expect(near.size).toBeLessThan(20);
  });

  it("gives a fan the same shirt every time", () => {
    const states = { "310": all("310", "S") };
    expect(buildFans(blocks, seats, states).shirts).toEqual(buildFans(blocks, seats, states).shirts);
  });
});

describe("the match", () => {
  const TEN_MINUTES = 600;

  it("has 22 players and a referee: ten outfield players and a keeper each", () => {
    const { figures } = matchAt(0);
    const count = (kit: string) => figures.filter((f) => f.kit === kit).length;
    expect(figures).toHaveLength(23);
    expect(count("home")).toBe(10);
    expect(count("away")).toBe(10);
    expect(count("keeper")).toBe(2);
    expect(count("referee")).toBe(1);
  });

  it("keeps everyone and the ball on the pitch", () => {
    for (let t = 0; t < TEN_MINUTES; t += 0.5) {
      const { figures, ball } = matchAt(t);
      for (const spot of [...figures, ball]) {
        expect(Math.abs(spot.x)).toBeLessThan(PITCH.width / 2);
        expect(Math.abs(spot.z)).toBeLessThan(PITCH.length / 2);
      }
      expect(ball.y).toBeGreaterThan(0);
    }
  });

  it("is the same at the same time", () => {
    expect(matchAt(73.2)).toEqual(matchAt(73.2));
  });

  it("moves nobody faster than a sprint, so no one jumps across the pitch", () => {
    const step = 0.1;
    let fastest = 0;
    for (let t = 0; t < TEN_MINUTES; t += step) {
      const now = matchAt(t).figures;
      const next = matchAt(t + step).figures;
      now.forEach((figure, i) => {
        const speed = Math.hypot(next[i].x - figure.x, next[i].z - figure.z) / step;
        fastest = Math.max(fastest, speed);
      });
    }
    expect(fastest).toBeLessThan(11);
  });

  it("leaves each keeper near their own goal", () => {
    for (let t = 0; t < TEN_MINUTES; t += 2) {
      const [home, , , , , , , , , , , away] = matchAt(t).figures;
      expect(home.z).toBeLessThan(-PITCH.length / 2 + 12);
      expect(away.z).toBeGreaterThan(PITCH.length / 2 - 12);
    }
  });

  it("has every player facing the ball", () => {
    const { figures, ball } = matchAt(40);
    for (const figure of figures) {
      const ahead = { x: figure.x + Math.sin(figure.turn), z: figure.z + Math.cos(figure.turn) };
      const before = Math.hypot(ball.x - figure.x, ball.z - figure.z);
      const after = Math.hypot(ball.x - ahead.x, ball.z - ahead.z);
      expect(after).toBeLessThan(before);
    }
  });
});
