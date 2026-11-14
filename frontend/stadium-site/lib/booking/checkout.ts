import type { StadiumApi } from "@/lib/api/stadium-api";
import type { Order, PaymentMethod } from "@/lib/domain/types";

// What the checkout remembers about paying for one Hold, and how it waits
// for the Order to settle. No React here, so it can be tested on its own.

/**
 * One payment for one Hold. The key and the method are fixed the first time
 * the Fan presses Pay; every retry sends exactly the same request, so the
 * backend answers with the same Order instead of making a second one.
 */
export interface PaymentPlan {
  idempotencyKey: string;
  method: PaymentMethod;
  /** Set once the backend has answered with the Order. */
  orderId?: string;
}

/** The part of Web Storage this needs; sessionStorage in the page, a Map in tests. */
export interface PlanStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const planKey = (holdId: string) => `stadium.payment.${holdId}`;

/** The plan saved for this Hold, or null if there is none or it cannot be read. */
export function loadPlan(storage: PlanStorage, holdId: string): PaymentPlan | null {
  try {
    const plan = JSON.parse(storage.getItem(planKey(holdId)) ?? "null") as PaymentPlan | null;
    return plan && typeof plan.idempotencyKey === "string" && typeof plan.method === "string"
      ? plan
      : null;
  } catch {
    return null;
  }
}

export function savePlan(storage: PlanStorage, holdId: string, plan: PaymentPlan): void {
  try {
    storage.setItem(planKey(holdId), JSON.stringify(plan));
  } catch {
    // Private mode or full storage: the page still works, a reload just forgets.
  }
}

/**
 * The plan to pay with: the saved one if the Fan already pressed Pay, so a
 * retry repeats it exactly, else a new one with a new key.
 */
export function planFor(
  saved: PaymentPlan | null,
  method: PaymentMethod,
  newKey: () => string,
): PaymentPlan {
  return saved ?? { idempotencyKey: newKey(), method };
}

/** A short reference a person can read out: the first eight characters of the Order id. */
export function orderReference(orderId: string): string {
  const letters = orderId.replace(/[^0-9a-z]/gi, "").slice(0, 8).toUpperCase();
  return `${letters.slice(0, 4)}-${letters.slice(4)}`;
}

/** How often a pending Order is read again. */
export const ORDER_POLL_MS = 1_000;

/**
 * Reads the Order now and then every `everyMs` until it is CONFIRMED or
 * FAILED, calling back with each answer. A failed read is tried again on
 * the next tick. Returns a function that stops it.
 */
export function watchOrder(
  api: Pick<StadiumApi, "getOrder">,
  orderId: string,
  onOrder: (order: Order) => void,
  onError: (error: unknown) => void = () => {},
  everyMs = ORDER_POLL_MS,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const read = () => {
    api
      .getOrder(orderId)
      .then((order) => {
        if (stopped) return;
        onOrder(order);
        if (order.status === "PENDING") timer = setTimeout(read, everyMs);
      })
      .catch((error: unknown) => {
        if (stopped) return;
        onError(error);
        timer = setTimeout(read, everyMs);
      });
  };
  read();
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
