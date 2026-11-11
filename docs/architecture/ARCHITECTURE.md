# Architecture

How the platform is cut into services, why, what runs where, and the contracts between
them (events and HTTP endpoints). For *how each problem is solved*, see
[DESIGN.md](DESIGN.md). For tables and Redis keys, see [DATA-MODEL.md](DATA-MODEL.md).
**⭐ Stretch** marks parts beyond the M3 finish line (see [ROADMAP](../process/ROADMAP.md)).

---

## 1. The number that shapes the design

**5000 seats ÷ 4 seats max = ~1250 successful buyers per match.**

- A match's entire inventory is ~5000 entries — it fits in **one Redis hash**.
- A complete sellout is ~1250 Postgres transactions.
- The 50,000 people arriving at T-0 are a **read and queueing** problem.

So: push the crowd into a **Waiting Room** at the edge, arbitrate seats atomically in
Redis, and let Postgres see only the real sales.

## 2. Context

Actors: **Fan** (buys, enters), **Admin** (manages matches), **Steward** (scans tickets
at the gate). External systems: Football-Data.org (fixtures, scores), Open-Meteo
(weather), a payment provider (mock adapter first, Stripe test mode later). OTP codes
are **fake**: a console adapter prints them; no SMS provider is used.

## 3. The five services

```
                      ┌──────────────────────────────────────────┐
  Next.js ───────────▶│  gateway   (Gatekeeper + routing + SSE)  │
                      │  WebFlux · Redis only · no database      │
                      └───┬──────────┬──────────┬────────────┬───┘
                          │          │          │            │
                   ┌──────▼───┐ ┌────▼─────┐ ┌──▼────────┐ ┌─▼──────────┐
                   │ identity │ │ catalog  │ │ inventory │ │ ticketing  │
                   │          │ │+ signals │ │ + pricing │ │ orders +   │
                   │          │ │          │ │           │ │ tickets    │
                   └────┬─────┘ └────┬─────┘ └─────┬─────┘ └─────┬──────┘
                     Postgres     Postgres   Postgres+Redis    Postgres
                                  + Redis     (the arbiter)
                                  cache
                                     │                           │
                          [Football-Data.org]               [mock PSP]
                          [Open-Meteo]
                        └──────────── Kafka ─────────────────────┘
                                       │
                            Redis pub/sub ─▶ gateway SSE ─▶ browsers
```

| # | Service | Owns | Internal style | Data stores |
|---|---|---|---|---|
| 1 | **gateway** | Routing, JWT validation, **Waiting Room**, **Draw**, **Admission Token**, checkout grant, rate limits, all SSE fan-out | Reactive filter pipeline + one pure `AdmissionPolicy`. No domain model. | Redis (`queue`, `ratelimit`). **No database.** |
| 2 | **identity** | Fan/Admin/Steward, fake OTP → **Verified Identity**, **Device** binding, **Purchase Limit** ledger, JWT issuance (JWKS). ⭐ Stretch: **Fraud Ring Detection** (`riskgraph/`, Neo4j) | Layered MVC; `OtpSender` port (console + real adapter) | Postgres (⭐ + Neo4j) |
| 3 | **catalog** | **Match**, Team, Competition, Standings, **Importance**, weather, live scores, **Final Score**. ⭐ Stretch: Kafka Streams **Demand Multiplier** | Hexagonal + anti-corruption layer. `MatchFeed`/`WeatherFeed` ports, live + fixture adapter each | Postgres + Redis cache |
| 4 | **inventory** | **Seat Map**, **Block**, **Seat State**, **Hold**, **Run**, **No-Orphan** scorer, **Allocator**, occupancy, **all Pricing**, **Quote** | Tactical DDD. Pure `domain/` and `pricing/`; Redis + Lua called directly by an adapter class — no port (ADR-0005) | Postgres + dedicated Redis (AOF + replica) |
| 5 | **ticketing** | **Order**, Payment Attempt, **Idempotency Key**, **Confirmation Saga**, **Outbox**, **Ticket**, **Rotating Credential**, **Scan Ledger**, **Dispute**. ⭐ Stretch: **Resale**, **Print Credential**, **Ticket Document**, **Souvenir** | DDD aggregates + saga orchestration + append-only ledger. `PaymentGateway` port (mock + Stripe) | Postgres (⭐ + MinIO) |

**Ports rule (ADR-0005):** a port exists only where two adapters are real. One adapter
→ call the class directly.

## 4. Why five, and what it cost

- **gateway = Gatekeeper.** One deployable on Spring Cloud Gateway. Waiting Room,
  admission and rate limiting are custom filters. All its state is in Redis, so it
  stays non-blocking and can hold tens of thousands of idle SSE connections.
- **Realtime folded into gateway.** The browser already holds a long-lived connection
  to the edge for its queue position; SSE over Redis pub/sub is the same mechanism.
- **Pricing folded into inventory.** Pricing is pure, and a Quote must be produced at
  hold time. A separate service would be a network hop on the hot path. *A seam is a
  module boundary; it does not have to be a process boundary.*
- **Orders + tickets merged.** Order + Payment + Ticket + Outbox are written in **one
  local transaction** in `ticketing`. Splitting them forces a distributed transaction
  on the exact path where "charged but no ticket" must be impossible.
  (Inventory's seat claim is a *separate* saga step — see DESIGN §4.)
- **The cost:** `gateway` is the busiest and only public deployable (load tests and
  HPA focus there). `ticketing`'s database holds money and rights of entry, so its
  backup and audit requirements are strictest.

## 5. Why the styles differ

DDD only where invariants are rich (`inventory`, `ticketing`). `identity` is mostly
CRUD → layered MVC. `catalog`'s complexity is at its boundaries → hexagonal with an
anti-corruption layer. `gateway` has no domain → filter pipeline. Uniform DDD would add
aggregates and repositories to code with no invariants to protect.

**Interview line:** "I chose the architecture per service by where its complexity
lives — invariants, boundaries, or throughput."

## 6. Communication

| From → To | Mechanism | Why |
|---|---|---|
| Browser → any service | HTTPS via `gateway` | single public entry, auth + admission at the edge |
| gateway → browser | SSE (fed by Redis pub/sub) | one-way server push, survives proxies, cheap |
| ticketing → inventory | sync HTTP (confirm/unconfirm) | saga step needs an answer now |
| ticketing → identity | sync HTTP (purchase-limit reserve) | saga step, ~1250 calls/match |
| everything else | Kafka events keyed by `matchId` | decoupling, per-match ordering, replay |

Rule: **synchronous calls only inside the Confirmation Saga.** Everything else is events.

## 7. Infrastructure

- **Postgres:** one server locally, one database per service (`gateway` has none). Flyway.
- **Redis — three separate instances:** `redis-inventory` (the arbiter: AOF `everysec`
  + replica), `redis-gateway` (queue + rate limits), `redis-cache` (catalog cache).
  The arbiter is never shared with a throwaway cache.
- **Kafka (KRaft):** keyed by `matchId`; compacted topics for state-carrying events.
  JSON with `schemaVersion` first; Schema Registry later (Icebox).
- Every container is added by the **first ticket that needs it** — nothing up front.
- **Observability is load-bearing:** Prometheus + Grafana + OpenTelemetry. The
  admission controller *consumes* p99 latency and Hikari saturation.
- **Kubernetes:** HPA on `gateway`/`catalog`, KEDA on Kafka lag, PDBs, readiness
  probes reporting pool health. HPA does not protect Postgres — admission control does.
- ⭐ Stretch: Neo4j (fraud graph), MinIO/S3 (PDF tickets), Kafka Streams state store.

## 8. External feeds (catalog)

Football-Data.org free tier ≈ 10 req/min. So: scheduled sync (fixtures daily, scores
~60 s **only inside live windows**), ETag / `If-Modified-Since`, Redis cache with
stale-while-revalidate, Resilience4j circuit breaker + backoff, and a **persisted local
projection** so the site works when the provider is down.
**Never call an external API on a user request path.**

## 9. Build order

1. `inventory` core (Sprints 1–3) — the heart and the riskiest part → **M1**.
2. `catalog` with the fixture adapter + inventory confirm (Sprint 4).
3. `ticketing` money path: idempotency, mock PSP, saga (Sprints 5–6).
4. `gateway` + stub `identity` JWT + Waiting Room (Sprints 6–7).
5. Web app + SSE live updates (Sprints 7–8) → **M2 Portfolio MVP**.
6. Real feeds, identity, gate operations, observability, Kubernetes (Sprints 9–13) →
   **M3 Production-grade = done**. Everything after is ⭐ Stretch.

---

## 10. Events (Kafka topics)

Every cross-service fact travels as an event. Records live in the `contracts` module as
plain Java records (no Spring), each with a `schemaVersion` field.

**Rules**
- **Key = `matchId`** unless stated, so all events of one match are ordered on one partition.
- **Producers that write Postgres publish through an Outbox** (same transaction as the
  state change). Producers that do not write Postgres publish directly and the event is
  **best-effort**.
- **Consumers are idempotent:** dedupe on `(consumer_group, message_key)` in
  `processed_messages`, or the handler is naturally idempotent.
- Event names are past-tense facts: `seat.held`, never `hold.seat`.
- A breaking change → new `schemaVersion`; consumers handle both until migrated.

| Topic | Producer | Consumers | Guarantee | Payload (main fields) | Sprint |
|---|---|---|---|---|---|
| `match.scheduled` | catalog | inventory (generate Seat Map + warmup) | outbox | matchId, kickoffAt, bookingOpensAt, competitionTier | 4 |
| `match.importance.changed` | catalog | inventory (pricing input) | outbox, compacted | matchId, importance | 9 |
| `seat.held` | inventory | gateway (SSE), ⭐ catalog (velocity) | **best-effort** | matchId, holdId, seatIds, heldAt | 3 |
| `hold.expired` | inventory | ticketing, gateway | **best-effort** | matchId, holdId, seatIds | 3 |
| `seat.released` | inventory | gateway (SSE) | best-effort | matchId, seatIds, reason | 3 |
| `seat.sold` | inventory | gateway (SSE) | outbox | matchId, seatIds, orderId | 4 |
| `price.changed` | inventory | gateway (SSE) | best-effort | matchId, tier, section, price | 9 |
| `order.confirmed` | ticketing | ticketing (tickets) | outbox | orderId, fanId, matchId, seatIds, amount | 6 |
| ⭐ `match.finished` | catalog | ticketing (Souvenir) | outbox | matchId, finalScore, attendance | stretch |
| ⭐ `demand.multiplier.changed` | catalog (Streams) | inventory | compacted | matchId, multiplier, validUntil | stretch |
| ⭐ `order.cancelled` | ticketing | inventory (recycle seats) | outbox | orderId, matchId, seatIds, reason | stretch |
| ⭐ `ticket.document.ready` | ticketing | ticketing API, frontend | outbox | ticketId, credentialClass, objectKey | stretch |
| ⭐ `fraud.ring.detected` | identity | ticketing, admin UI | outbox, key = ringId | orderIds, confidence, reason | stretch |

**Why `seat.held` is allowed to be lost.** It drives the live map and the demand signal.
A lost event means a seat colour updates on the next snapshot — no money moves. Paying
for an outbox would mean a Postgres write on the hold path, which the design forbids.
`seat.sold` moves money-adjacent state, so it is never best-effort.

---

## 11. HTTP endpoints

All public traffic enters through `gateway`. Errors are RFC 9457 `ProblemDetail`
(`application/problem+json`). Until JWT exists (TKT-604), the caller identity is passed
in a temporary `X-Fan-Id` header, which the gateway will later derive from the token.

### inventory

| Method | Path | Role | Purpose | Ticket |
|---|---|---|---|---|
| POST | `/matches/{matchId}/seatmap` | Admin | generate Seat Map → 201, 409 if exists | TKT-105 |
| GET | `/matches/{matchId}/seatmap` | Fan | sections → rows → seats (static layout) | TKT-105 |
| POST | `/admin/matches/{matchId}/warmup` | Admin | rebuild Redis projection from Postgres | TKT-106 |
| GET | `/matches/{matchId}/occupancy` | Fan/Admin | available / held / sold, O(1) | TKT-106 |
| GET | `/matches/{matchId}/seat-states` | Fan | current state per seat (lazy expiry applied) | TKT-203 |
| POST | `/matches/{matchId}/holds` | Fan | hold explicit seats or `mode=ADJACENT` → 201 Hold + Quote | TKT-204 / TKT-302 |
| GET | `/matches/{matchId}/holds/{holdId}` | Fan (owner) | hold details + remaining TTL | TKT-204 |
| DELETE | `/matches/{matchId}/holds/{holdId}` | Fan (owner) | release → 204 | TKT-204 |
| GET | `/matches/{matchId}/quotes/{quoteId}` | Fan | immutable Quote | TKT-304 |
| POST | `/matches/{matchId}/holds/{holdId}/confirm` | internal (ticketing) | saga step: H→S + seat_claims | TKT-405 |
| POST | `/matches/{matchId}/claims/unconfirm` | internal (ticketing) | saga compensation | TKT-501 |

Example — create a hold (explicit mode):

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

409 Conflict
{ "type": "/problems/seats-unavailable", "title": "Seats unavailable",
  "status": 409, "conflictingSeatIds": ["W-S03-R07-13"] }
```

### ticketing (Sprints 5–6, 8, 11)

| Method | Path | Purpose |
|---|---|---|
| POST | `/orders` | create Order from holdId; `Idempotency-Key` header; requires checkout grant |
| GET | `/orders/{orderId}` | order status (PENDING / CONFIRMED / FAILED) |
| POST | `/orders/{orderId}/payment-attempts` | retry payment with another method |
| GET | `/me/tickets` | Fan's tickets |
| GET | `/tickets/{ticketId}/credential` | device-bound secret (once per Device) |
| POST | `/gate/scans` | Steward scan → ADMITTED / DISPUTE |
| ⭐ POST | `/tickets/{ticketId}/resale` | list at face value |
| ⭐ GET | `/tickets/{ticketId}/document` | pre-signed PDF URL |

### catalog (Sprints 4, 9)

`GET /matches`, `GET /matches/{id}`, `GET /competitions/{id}/standings`,
`GET /matches/{id}/live`, `POST /admin/sync` (manual sync trigger).

### gateway (Sprints 6–8)

`POST /waiting-room/{matchId}/register`, `GET /waiting-room/{matchId}/position` (SSE),
`GET /stream/matches/{matchId}` (SSE: seat deltas, prices, live score),
`GET /stream/admin/matches/{matchId}/occupancy` (SSE).

### identity (Sprints 6, 10)

`POST /auth/otp/request` (fake: code printed to the console), `POST /auth/otp/verify`,
`POST /auth/token`, `GET /.well-known/jwks.json`, `POST /devices`,
internal `POST /purchase-limits/reserve`, `POST /purchase-limits/release`.
