import { httpApi } from "./http";
import { createMockApi } from "./mock/mock-api";
import { createBrowserStore, createMemoryStore, type MockStore } from "./mock/store";
import type { StadiumApi } from "./stadium-api";

// The one place screens get the API from:
//
//   import { api } from "@/lib/api";
//
// With API_BASE_URL set the gateway answers; without it the mock does.
// next.config.ts turns that into NEXT_PUBLIC_API_MODE so the browser knows too.

export const usingMock = process.env.NEXT_PUBLIC_API_MODE !== "gateway";

const mockStore: MockStore =
  typeof window === "undefined" ? createMemoryStore() : createBrowserStore();

export const api: StadiumApi = usingMock
  ? createMockApi({
      store: mockStore,
      latencyMs: typeof window === "undefined" ? 0 : 150,
    })
  : httpApi;

/** Forget this Fan's Holds, Orders and Tickets in the mock. Demo only. */
export function resetMockData(): void {
  mockStore.clear();
}

export { ApiProblem, isProblem, PROBLEM } from "./problem";
export type { StadiumApi } from "./stadium-api";
