# API — HTTP Endpoints

All public traffic enters through `gateway`. Errors are RFC 9457 `ProblemDetail`
(`application/problem+json`). Until JWT exists (TKT-604, Sprint 6), the caller identity is passed
in a temporary `X-Fan-Id` header, which the gateway will later derive from the token.

Status: ✅ built · 🟡 current sprint · ⬜ planned

## inventory

| Method | Path | Role | Purpose | Status / Ticket |
|---|---|---|---|---|
| POST | `/matches/{matchId}/seatmap` | Admin | generate Seat Map → 201, 409 if exists | 🟡 TKT-104 |
| GET | `/matches/{matchId}/seatmap` | Fan | sections → rows → seats (static layout) | 🟡 TKT-104 |
| POST | `/admin/matches/{matchId}/warmup` | Admin | rebuild Redis projection from Postgres | 🟡 TKT-105 |
| GET | `/matches/{matchId}/occupancy` | Fan/Admin | available / held / sold, O(1) | 🟡 TKT-105 |
| GET | `/matches/{matchId}/seat-states` | Fan | current state per seat (lazy expiry applied) | ⬜ TKT-204 |
| POST | `/matches/{matchId}/holds` | Fan | hold explicit seats or `mode=ADJACENT` → 201 Hold + Quote | ⬜ TKT-203 / TKT-302 |
| GET | `/matches/{matchId}/holds/{holdId}` | Fan (owner) | hold details + remaining TTL | ⬜ TKT-203 |
| DELETE | `/matches/{matchId}/holds/{holdId}` | Fan (owner) | release → 204 | ⬜ TKT-203 |
| GET | `/matches/{matchId}/quotes/{quoteId}` | Fan | immutable Quote | ⬜ TKT-304 |
| POST | `/matches/{matchId}/holds/{holdId}/confirm` | internal (ticketing) | saga step: H→S + seat_claims | ⬜ TKT-405 |
| POST | `/matches/{matchId}/claims/unconfirm` | internal (ticketing) | saga compensation | ⬜ TKT-501 |

### Example — create a hold (explicit mode)

```http
POST /matches/42/holds
X-Fan-Id: 1001
Content-Type: application/json

{ "mode": "EXPLICIT", "seatIds": ["W-S03-R07-12","W-S03-R07-13"] }
```

```http
201 Created
{ "holdId": "7f3a…", "matchId": 42, "seatIds": [...], "expiresAt": "2026-…Z",
  "quote": { "quoteId": "…", "lines": [...], "total": "84.15", "currency": "EUR" } }
```

```http
409 Conflict
{ "type": "/problems/seats-unavailable", "title": "Seats unavailable",
  "status": 409, "conflictingSeatIds": ["W-S03-R07-13"] }
```

## ticketing (Sprints 5–6, 8, 11, 14–15)

| Method | Path | Purpose |
|---|---|---|
| POST | `/orders` | create Order from holdId; `Idempotency-Key` header; requires checkout grant |
| GET | `/orders/{orderId}` | order status (PENDING / CONFIRMED / FAILED) |
| POST | `/orders/{orderId}/payment-attempts` | retry payment with another method |
| GET | `/me/tickets` | Fan's tickets |
| GET | `/tickets/{ticketId}/credential` | device-bound secret (once per Device) |
| POST | `/gate/scans` | Steward scan → ADMITTED / DISPUTE |
| POST | `/tickets/{ticketId}/resale` | list at face value |
| GET | `/tickets/{ticketId}/document` | pre-signed PDF URL |

## catalog (Sprints 4, 9, 15)

`GET /matches`, `GET /matches/{id}`, `GET /competitions/{id}/standings`,
`GET /matches/{id}/live`, `POST /admin/sync` (manual sync trigger).

## gateway (Sprints 6–8)

`POST /waiting-room/{matchId}/register`, `GET /waiting-room/{matchId}/position` (SSE),
`GET /stream/matches/{matchId}` (SSE: seat deltas, prices, live score),
`GET /stream/admin/matches/{matchId}/occupancy` (SSE).

## identity (Sprints 6, 10)

`POST /auth/otp/request`, `POST /auth/otp/verify`, `POST /auth/token`,
`GET /.well-known/jwks.json`, `POST /devices`,
internal `POST /purchase-limits/reserve`, `POST /purchase-limits/release`.
