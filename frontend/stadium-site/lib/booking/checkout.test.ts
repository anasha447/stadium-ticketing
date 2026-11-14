import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockApi, DRAW_DELAY_MS, HOLD_TTL_MS } from "@/lib/api/mock/mock-api";
import { createMemoryStore } from "@/lib/api/mock/store";
import type { StadiumApi } from "@/lib/api/stadium-api";
import type { Hold, Order } from "@/lib/domain/types";
import {
  loadPlan,
  ORDER_POLL_MS,
  orderReference,
  type PlanStorage,
  planFor,
  savePlan,
  watchOrder,
} from "./checkout";

const MATCH = 1;

function memoryStorage(): PlanStorage & { items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
  };
}

describe("the payment plan", () => {
  it("is kept per Hold and read back", () => {
    const storage = memoryStorage();
    savePlan(storage, "hold-1", { idempotencyKey: "k1", method: "CARD" });
    expect(loadPlan(storage, "hold-1")).toEqual({ idempotencyKey: "k1", method: "CARD" });
    expect(loadPlan(storage, "hold-2")).toBeNull();
  });

  it("is forgotten, not trusted, when what was saved cannot be read", () => {
    const storage = memoryStorage();
    storage.items.set("stadium.payment.hold-1", "{not json");
    expect(loadPlan(storage, "hold-1")).toBeNull();
    storage.items.set("stadium.payment.hold-1", JSON.stringify({ method: "CARD" }));
    expect(loadPlan(storage, "hold-1")).toBeNull();
  });

  it("keeps the first key and method, so a retry repeats the same request", () => {
    const first = planFor(null, "APPLE_PAY", () => "k1");
    expect(first).toEqual({ idempotencyKey: "k1", method: "APPLE_PAY" });
    expect(planFor(first, "CARD", () => "k2")).toBe(first);
  });
});

describe("orderReference", () => {
  it("is the first eight letters and digits of the Order id, in two groups", () => {
    expect(orderReference("3f9a2c1e-77b0-4d1a-9c3e-0a1b2c3d4e5f")).toBe("3F9A-2C1E");
  });
});

describe("paying for a Hold with the mock", () => {
  let clock: number;
  let api: StadiumApi;
  let hold: Hold;

  /** Moves the mock's clock and the timers on together. */
  const pass = async (ms: number) => {
    clock += ms;
    await vi.advanceTimersByTimeAsync(ms);
  };

  beforeEach(async () => {
    vi.useFakeTimers();
    clock = Date.parse("2026-11-14T10:00:00Z");
    // The Draw gives this Fan the first place, so they are admitted at once.
    api = createMockApi({ store: createMemoryStore(), now: () => clock, random: () => 0 });
    await api.joinWaitingRoom(MATCH);
    clock += DRAW_DELAY_MS + 1_000;
    const { blocks } = await api.getSeatStates(MATCH, ["107"]);
    const first = blocks["107"].indexOf("AA") + 1;
    const seat = (n: number) => `107-R01-${String(n).padStart(2, "0")}`;
    hold = await api.createHold(MATCH, { mode: "EXPLICIT", seatIds: [seat(first), seat(first + 1)] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function signIn() {
    const { demoCode } = await api.requestOtp("+34 600 123 456");
    await api.verifyOtp("+34 600 123 456", demoCode!);
  }

  it("is refused until the Fan has proven their mobile number", async () => {
    await expect(api.createOrder({ holdId: hold.holdId, paymentMethod: "CARD" }, "k1")).rejects.toMatchObject({
      type: "/problems/not-signed-in",
    });
  });

  it("asks again for a wrong code", async () => {
    await api.requestOtp("+34 600 123 456");
    await expect(api.verifyOtp("+34 600 123 456", "000000x")).rejects.toMatchObject({
      type: "/problems/otp-invalid",
    });
    expect((await api.getSession()).verified).toBe(false);
  });

  it("is watched from pending until it is confirmed, then stops", async () => {
    await signIn();
    const order = await api.createOrder({ holdId: hold.holdId, paymentMethod: "CARD" }, "k1");
    const seen: Order[] = [];
    const stop = watchOrder(api, order.orderId, (o) => seen.push(o));

    for (let i = 0; i < 5; i++) await pass(ORDER_POLL_MS);
    stop();

    expect(seen[0].status).toBe("PENDING");
    expect(seen.at(-1)!.status).toBe("CONFIRMED");
    // Nothing is read after the Order settled.
    expect(seen.filter((o) => o.status === "CONFIRMED")).toHaveLength(1);
    expect((await api.listMyTickets()).map((t) => t.seatId).sort()).toEqual([...hold.seatIds].sort());
  });

  it("fails when the Hold runs out before the payment finishes", async () => {
    await signIn();
    clock = Date.parse(hold.expiresAt) - 500;
    const order = await api.createOrder({ holdId: hold.holdId, paymentMethod: "APPLE_PAY" }, "k1");
    let last: Order | null = null;
    const stop = watchOrder(api, order.orderId, (o) => (last = o));
    for (let i = 0; i < 4; i++) await pass(ORDER_POLL_MS);
    stop();
    expect(last!.status).toBe("FAILED");
  });

  it("gives back the same Order when the same request is sent again", async () => {
    await signIn();
    const plan = planFor(null, "CARD", () => "k1");
    const request = { holdId: hold.holdId, paymentMethod: plan.method };
    const first = await api.createOrder(request, plan.idempotencyKey);
    const again = await api.createOrder(request, plan.idempotencyKey);
    expect(again.orderId).toBe(first.orderId);
  });

  it("names the Order a Hold already has, when a new key is used", async () => {
    await signIn();
    const first = await api.createOrder({ holdId: hold.holdId, paymentMethod: "CARD" }, "k1");
    await expect(
      api.createOrder({ holdId: hold.holdId, paymentMethod: "CARD" }, "k2"),
    ).rejects.toMatchObject({ type: "/problems/order-exists", document: { orderId: first.orderId } });
  });

  it("is refused once the Hold has run out", async () => {
    await signIn();
    clock += HOLD_TTL_MS + 1_000;
    await expect(api.createOrder({ holdId: hold.holdId, paymentMethod: "CARD" }, "k1")).rejects.toMatchObject({
      type: "/problems/hold-expired",
    });
  });

  it("keeps trying when a read fails, and stops when told to", async () => {
    const getOrder = vi
      .fn()
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValue({ status: "PENDING" } as Order);
    const errors: unknown[] = [];
    const stop = watchOrder({ getOrder }, "o1", () => {}, (e) => errors.push(e));
    await vi.advanceTimersByTimeAsync(ORDER_POLL_MS * 2);
    stop();
    const calls = getOrder.mock.calls.length;
    await vi.advanceTimersByTimeAsync(ORDER_POLL_MS * 3);
    expect(errors).toHaveLength(1);
    expect(calls).toBe(3);
    expect(getOrder.mock.calls.length).toBe(calls);
  });
});
