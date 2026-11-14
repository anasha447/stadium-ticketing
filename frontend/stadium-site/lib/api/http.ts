import { ApiProblem, PROBLEM, type ProblemDocument } from "./problem";
import type { StadiumApi } from "./stadium-api";

// The gateway adapter. In the browser every call goes to same-origin /api/*,
// which next.config.ts rewrites to the gateway. On the server it calls the
// gateway directly.

function baseUrl(): string {
  if (typeof window !== "undefined") return "/api";
  const url = process.env.API_BASE_URL;
  if (!url) throw new Error("API_BASE_URL is not set");
  return url.replace(/\/$/, "");
}

async function toProblem(response: Response): Promise<ApiProblem> {
  const fallback: ProblemDocument = {
    type: PROBLEM.unknown,
    title: response.statusText || "Request failed",
    status: response.status,
  };
  try {
    const body = (await response.json()) as Partial<ProblemDocument>;
    return new ApiProblem({ ...fallback, ...body, status: response.status });
  } catch {
    return new ApiProblem(fallback);
  }
}

async function request<T>(
  method: string,
  path: string,
  options: { body?: unknown; headers?: Record<string, string> } = {},
): Promise<T> {
  const response = await fetch(baseUrl() + path, {
    method,
    headers: {
      Accept: "application/json, application/problem+json",
      ...(options.body !== undefined && { "Content-Type": "application/json" }),
      ...options.headers,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  if (!response.ok) throw await toProblem(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const httpApi: StadiumApi = {
  listMatches: () => request("GET", "/matches"),
  getMatch: (matchId) => request("GET", `/matches/${matchId}`),

  joinWaitingRoom: (matchId) => request("POST", `/waiting-room/${matchId}/register`),
  getWaitingRoom: (matchId) => request("GET", `/waiting-room/${matchId}/status`),
  watchWaitingRoom: (matchId, onStatus) => {
    // The gateway pushes the position as server-sent events.
    const events = new EventSource(`${baseUrl()}/waiting-room/${matchId}/position`);
    events.onmessage = (event) => onStatus(JSON.parse(event.data));
    return () => events.close();
  },

  getSeatMap: (matchId) => request("GET", `/matches/${matchId}/seatmap`),
  getOccupancy: (matchId) => request("GET", `/matches/${matchId}/occupancy`),
  getSeatStates: (matchId, blockIds) => {
    const query = blockIds?.length ? `?blocks=${blockIds.join(",")}` : "";
    return request("GET", `/matches/${matchId}/seat-states${query}`);
  },
  watchSeats: (matchId, { onOpen, onDelta }) => {
    // One stream per Match carries seat changes, prices and the score as
    // named events. Only the seat changes are read here. The browser
    // reconnects by itself, and says so with another "open".
    const events = new EventSource(`${baseUrl()}/stream/matches/${matchId}`);
    events.onopen = () => onOpen?.();
    events.addEventListener("seat-delta", (event) => onDelta(JSON.parse(event.data)));
    return () => events.close();
  },
  createHold: (matchId, body) =>
    request("POST", `/matches/${matchId}/holds`, { body }),
  getHold: (matchId, holdId) =>
    request("GET", `/matches/${matchId}/holds/${holdId}`),
  releaseHold: (matchId, holdId) =>
    request("DELETE", `/matches/${matchId}/holds/${holdId}`),
  getQuote: (matchId, quoteId) =>
    request("GET", `/matches/${matchId}/quotes/${quoteId}`),

  getSession: () => request("GET", "/auth/session"),
  requestOtp: (mobile) =>
    request("POST", "/auth/otp/request", { body: { mobile } }),
  verifyOtp: (mobile, code) =>
    request("POST", "/auth/otp/verify", { body: { mobile, code } }),

  createOrder: (body, idempotencyKey) =>
    request("POST", "/orders", {
      body,
      headers: { "Idempotency-Key": idempotencyKey },
    }),
  getOrder: (orderId) => request("GET", `/orders/${orderId}`),
  listMyTickets: () => request("GET", "/me/tickets"),
};
