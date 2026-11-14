import { beforeEach, describe, expect, it } from "vitest";
import { ApiProblem, PROBLEM } from "../problem";
import type { StadiumApi } from "../stadium-api";
import {
  ADMISSION_MS,
  ADMITTED_PER_SECOND,
  createMockApi,
  DRAW_DELAY_MS,
  WAITING_FANS,
} from "./mock-api";
import { createMemoryStore } from "./store";

const MATCH = 1;

let clock: number;
let drawn: number;
let api: StadiumApi;

beforeEach(() => {
  clock = Date.parse("2026-11-14T10:00:00Z");
  drawn = 0.5; // the middle of the crowd
  api = createMockApi({ store: createMemoryStore(), now: () => clock, random: () => drawn });
});

async function problemOf(promise: Promise<unknown>): Promise<ApiProblem> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof ApiProblem) return error;
    throw error;
  }
  throw new Error("Expected the call to fail");
}

describe("Waiting Room", () => {
  it("starts with the Fan outside it", async () => {
    expect(await api.getWaitingRoom(MATCH)).toEqual({ phase: "NOT_JOINED", waiting: WAITING_FANS });
  });

  it("holds a Fan who joined until the Draw", async () => {
    const status = await api.joinWaitingRoom(MATCH);
    expect(status).toMatchObject({ phase: "WAITING", waiting: WAITING_FANS });
    if (status.phase !== "WAITING") throw new Error("unreachable");
    expect(Date.parse(status.drawAt)).toBe(clock + DRAW_DELAY_MS);

    clock += DRAW_DELAY_MS - 1;
    expect((await api.getWaitingRoom(MATCH)).phase).toBe("WAITING");
  });

  it("gives the Fan a place at the Draw", async () => {
    await api.joinWaitingRoom(MATCH);
    clock += DRAW_DELAY_MS;
    const status = await api.getWaitingRoom(MATCH);
    expect(status).toMatchObject({
      phase: "QUEUED",
      drawnPosition: WAITING_FANS / 2 + 1,
      position: WAITING_FANS / 2 + 1,
      admittedPerSecond: ADMITTED_PER_SECOND,
    });
  });

  it("can draw any place from first to last, and nothing outside", async () => {
    for (const [roll, place] of [[0, 1], [0.999999, WAITING_FANS]] as const) {
      drawn = roll;
      const fresh = createMockApi({ store: createMemoryStore(), now: () => clock, random: () => drawn });
      await fresh.joinWaitingRoom(MATCH);
      clock += DRAW_DELAY_MS;
      expect(await fresh.getWaitingRoom(MATCH)).toMatchObject({ drawnPosition: place });
    }
  });

  it("moves the Fan forward at the admission rate", async () => {
    await api.joinWaitingRoom(MATCH);
    clock += DRAW_DELAY_MS;
    const start = await api.getWaitingRoom(MATCH);
    clock += 2_000;
    const later = await api.getWaitingRoom(MATCH);
    if (start.phase !== "QUEUED" || later.phase !== "QUEUED") throw new Error("unreachable");
    expect(start.position - later.position).toBe(2 * ADMITTED_PER_SECOND);
  });

  it("admits the Fan when their turn comes, for a limited time", async () => {
    await api.joinWaitingRoom(MATCH);
    const turn = DRAW_DELAY_MS + ((WAITING_FANS / 2 + 1) / ADMITTED_PER_SECOND) * 1000;

    clock += turn - 1;
    expect((await api.getWaitingRoom(MATCH)).phase).toBe("QUEUED");

    clock += 1;
    const admitted = await api.getWaitingRoom(MATCH);
    expect(admitted.phase).toBe("ADMITTED");
    if (admitted.phase !== "ADMITTED") throw new Error("unreachable");
    expect(Date.parse(admitted.admissionExpiresAt)).toBe(clock + ADMISSION_MS);

    clock += ADMISSION_MS;
    expect((await api.getWaitingRoom(MATCH)).phase).toBe("NOT_JOINED");
  });

  it("keeps the same place when the Fan joins again", async () => {
    await api.joinWaitingRoom(MATCH);
    clock += DRAW_DELAY_MS;
    const before = await api.getWaitingRoom(MATCH);

    drawn = 0; // a second Draw would put them first
    const again = await api.joinWaitingRoom(MATCH);
    expect(again).toEqual(before);
  });

  it("cannot be joined for a Match that is not on sale", async () => {
    expect((await problemOf(api.joinWaitingRoom(2))).type).toBe(PROBLEM.bookingNotOpen);
  });

  it("is needed before a Hold can be made", async () => {
    const hold = () => api.createHold(MATCH, { mode: "EXPLICIT", seatIds: ["301-R01-01"] });

    const outside = await problemOf(hold());
    expect(outside.status).toBe(403);
    expect(outside.type).toBe(PROBLEM.notAdmitted);

    await api.joinWaitingRoom(MATCH);
    clock += DRAW_DELAY_MS + 1_000;
    expect((await problemOf(hold())).type).toBe(PROBLEM.notAdmitted); // still queued

    clock += 60_000;
    // Admitted now: the answer is about the seat, not about admission.
    const result = await hold().then(
      () => "held",
      (error: ApiProblem) => error.type,
    );
    expect(result).not.toBe(PROBLEM.notAdmitted);
  });
});
