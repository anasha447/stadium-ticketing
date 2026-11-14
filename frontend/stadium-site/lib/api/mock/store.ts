import type { Hold, Order, PaymentMethod, Ticket } from "@/lib/domain/types";
import type { OtherFans } from "./other-fans";

// What the mock remembers about this Fan. In the browser it is kept in
// localStorage so a reload keeps your seats; in tests it is kept in memory.

export interface StoredOrder extends Order {
  paymentMethod: PaymentMethod;
  /** When the pretend payment finishes. */
  settlesAt: number;
}

export interface MockState {
  fanId: string;
  verified: boolean;
  mobile?: string;
  otp?: { mobile: string; code: string; expiresAt: number };
  holds: Record<string, Hold>;
  orders: Record<string, StoredOrder>;
  tickets: Ticket[];
  /** The Fan's place in each Match's Waiting Room, by Match id. */
  waitingRoom?: Record<number, { drawAt: number; drawnPosition: number }>;
  /** What the other Fans have held and bought in each Match, by Match id. */
  otherFans?: Record<number, OtherFans>;
  /** Idempotency-Key → the request it was used for and the Order it made. */
  idempotency: Record<string, { fingerprint: string; orderId: string }>;
}

export interface MockStore {
  load(): MockState | null;
  save(state: MockState): void;
  clear(): void;
}

export function createMemoryStore(): MockStore {
  let state: MockState | null = null;
  return {
    load: () => (state ? structuredClone(state) : null),
    save: (next) => {
      state = structuredClone(next);
    },
    clear: () => {
      state = null;
    },
  };
}

const STORAGE_KEY = "stadium.mock.v1";

/** Falls back to memory when storage is blocked, as in a private window. */
export function createBrowserStore(): MockStore {
  const memory = createMemoryStore();
  return {
    load() {
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? (JSON.parse(raw) as MockState) : memory.load();
      } catch {
        return memory.load();
      }
    },
    save(state) {
      memory.save(state);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        // Kept in memory only.
      }
    },
    clear() {
      memory.clear();
      try {
        window.localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Nothing to remove.
      }
    },
  };
}
