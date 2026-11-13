# Frontend

How the Next.js app (`frontend/stadium-site`) talks to the backend. The endpoint list
itself lives in [ARCHITECTURE §11](ARCHITECTURE.md#11-http-endpoints); this file says
which screen calls what, and from where. Built on the F-track (ADR-0006).

## 1. Three ways a request leaves the app

| Path | Used for | Why |
|---|---|---|
| **Server component → gateway** | reads that every Fan sees the same (match list, match page, Seat Map layout) | rendered and cached on the server; the browser gets HTML, and the flash crowd hits the Next cache, not the gateway |
| **Browser → `/api/*` → gateway** (Next rewrite) | everything per-Fan and live: Waiting Room, Seat States, Holds, Orders, SSE streams | same origin, so no CORS and the cookie travels by itself; the rewrite is a plain proxy with no logic |
| **Route handler** (`app/api/auth/*`) | the one-time-code exchange only | it must set the JWT as an `httpOnly` cookie, which a rewrite cannot do; JavaScript never sees the token |

The gateway stays the single public entry of the backend. Next adds no business rules:
it never computes a price, never decides a Seat State, never extends a Hold.

## 2. Screen by screen

| Screen | Route | Calls | Path | Notes |
|---|---|---|---|---|
| Match list | `/` | `GET /matches` | server | revalidated on a timer |
| Match page | `/matches/[id]` | `GET /matches/{id}` | server | shows when booking opens |
| Waiting Room | `/matches/[id]/waiting-room` | `POST /waiting-room/{id}/register` · `GET /waiting-room/{id}/position` (SSE) | browser | admission sets the Admission Token cookie |
| Stadium | `/matches/[id]/seats` | `GET /matches/{id}/seatmap` | server | static layout, cached hard; ~60K seats sent as a compact array, not one object per seat |
| | | `GET /matches/{id}/occupancy` | browser | "seats left" per Block in stadium view |
| | | `GET /matches/{id}/seat-states` | browser | snapshot when a Block is opened |
| | | `GET /stream/matches/{id}` (SSE) | browser | seat deltas after the snapshot |
| Hold | drawer on the stadium | `POST /matches/{id}/holds` | browser | 201 → Hold + Quote; 409 → conflicting seat ids are shown on the map |
| | | `GET` / `DELETE /matches/{id}/holds/{holdId}` | browser | countdown runs from `expiresAt`, never from a local timer start |
| Sign-in | step inside checkout | `POST /auth/otp/request` · `POST /auth/otp/verify` | route handler | fake code, printed to the backend console |
| Checkout | `/checkout/[holdId]` | `POST /orders` with `Idempotency-Key` | browser | the key is created once per Hold and reused on retry |
| | | `GET /orders/{orderId}` | browser | polled until CONFIRMED or FAILED |
| | | `POST /orders/{orderId}/payment-attempts` | browser | retry with another method |
| My Tickets | `/tickets` | `GET /me/tickets` | server | per-Fan, not cached |

Later, off the F-track: Steward scanner (`POST /gate/scans`, Sprint 11), Admin occupancy
heatmap (Sprint 12), Rotating Credential (`GET /tickets/{id}/credential`, Sprint 11).

## 3. One client, two backends

```
frontend/stadium-site/
  lib/api/        typed client: one function per endpoint, returns domain types
  lib/api/mock/   answers the same paths with the same shapes
```

- `API_BASE_URL` set → rewrites point at the gateway.
- `API_BASE_URL` unset → `/api/*` is served by the mock layer inside Next.

Screens only ever import from `lib/api`. Switching to the real backend is an environment
change, and any screen that breaks has found a contract mismatch.

The mock layer holds its state (Holds, Orders, Tickets, sold seats) in the browser's
`localStorage` behind the same functions, with a reset. It also enforces the real rules
so the UI is honest: a Hold is 1–4 Seats and expires, a Quote never changes, a second
Hold on a taken seat returns 409 with `conflictingSeatIds`.

## 4. Errors

Every failure is an RFC 9457 `ProblemDetail`. The client maps `type` to a message and an
action, never the HTTP status alone:

| `type` | UI |
|---|---|
| `/problems/seats-unavailable` | mark the conflicting seats, keep the rest selected |
| `/problems/hold-expired` (proposed) | release the selection, return to Block view |
| `/problems/purchase-limit` (proposed) | explain the limit of four |
| anything else | generic message with a retry |

Only `seats-unavailable` exists in ARCHITECTURE §11 today. The two marked "proposed" are
names the mock layer uses; the backend tickets (TKT-204, TKT-1003) confirm or rename them.

## 5. Contracts the frontend fixed first

Seat count, Block, Tier and seat id differ from the backend docs. See
[`FRONTEND-DEVIATIONS.md`](../process/FRONTEND-DEVIATIONS.md).
