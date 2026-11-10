# Architecture

How the platform is cut into services, why, and what runs where.
For *how each problem is solved*, see [DESIGN.md](DESIGN.md).
For tables and Redis keys, see [DATA-MODEL.md](DATA-MODEL.md).

---

## 1. The number that shapes the design

**5000 seats ÷ 4 seats max = ~1250 successful buyers per match.**

- A match's entire inventory is ~5000 entries — it fits in **one Redis hash**.
- A complete sellout is ~1250 Postgres transactions.
- The 50,000 people arriving at T-0 are a **read and queueing** problem.

So: push the crowd into a **Waiting Room** at the edge, arbitrate seats atomically in
Redis, and let Postgres see only the real sales.

## 2. Context

Actors: **Fan** (buys, enters), **Admin** (manages matches, reviews fraud),
**Steward** (scans tickets at the gate).
External systems: Football-Data.org (fixtures, scores), Open-Meteo (weather),
a payment provider (mock adapter first, Stripe test mode later).

## 3. The five services

```
                      ┌──────────────────────────────────────────┐
  Next.js ───────────▶│  gateway   (Gatekeeper + routing + SSE)  │
                      │  WebFlux · Redis only · no database      │
                      └───┬──────────┬──────────┬────────────┬───┘
                          │          │          │            │
                   ┌──────▼───┐ ┌────▼─────┐ ┌──▼────────┐ ┌─▼──────────┐
                   │ identity │ │ catalog  │ │ inventory │ │ ticketing  │
                   │ + risk   │ │+ signals │ │ + pricing │ │ orders +   │
                   │          │ │          │ │           │ │ tickets    │
                   └────┬─────┘ └────┬─────┘ └─────┬─────┘ └─────┬──────┘
                     Postgres     Postgres   Postgres+Redis    Postgres
                     + Neo4j      + Redis     (the arbiter)    + MinIO/S3
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
| 1 | **gateway** | Routing, JWT validation, **Waiting Room**, **Draw**, **Admission Token**, checkout grant, rate limits, **Bot Risk** signals, all SSE fan-out | Reactive filter pipeline + one pure `AdmissionPolicy`. No domain model. | Redis (`queue`, `ratelimit`). **No database.** |
| 2 | **identity** | Fan/Admin/Steward, OTP → **Verified Identity**, **Device** binding, **Purchase Limit** ledger, JWT issuance (JWKS), async **Fraud Ring Detection** | `access/` layered MVC · `riskgraph/` hexagonal + event-driven behind a `FraudGraph` port | Postgres + Neo4j |
| 3 | **catalog** | **Match**, Team, Competition, Standings, **Importance**, weather, live scores, **Final Score**, Kafka Streams **Demand Multiplier** topology | Hexagonal + anti-corruption layer, CQRS-lite. `MatchFeed`/`WeatherFeed` ports, live + fixture adapter each | Postgres + Redis cache + Streams state store |
| 4 | **inventory** | **Seat Map**, **Block**, **Seat State**, **Hold**, **Run**, **No-Orphan** scorer, **Allocator**, occupancy, **all Pricing**, **Quote** | Tactical DDD + hexagonal. Aggregates `SeatMap`, `Hold`. Pure domain; `SeatStateStore` port with Redis+Lua adapter | Postgres + dedicated Redis (AOF + replica) |
| 5 | **ticketing** | **Order**, Payment Attempt, **Idempotency Key**, **Confirmation Saga**, **Outbox**, **Ticket**, **Rotating** / **Print Credential**, **Ticket Document**, **Scan Ledger**, **Dispute**, **Resale**, **Souvenir** | DDD aggregates + saga orchestration + append-only ledger + async document pipeline | Postgres + object storage |

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
  (Inventory's seat claim is a *separate* saga step — see DESIGN §4 and RF-03.)
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
| ticketing → identity | sync HTTP (purchase-limit reserve) | saga step, ~1250 calls/match (RF-11, pending) |
| everything else | Kafka events keyed by `matchId` | decoupling, per-match ordering, replay |

Rule: **synchronous calls only inside the Confirmation Saga.** Everything else is events.

## 7. Infrastructure

- **Postgres:** one server locally, one database per service (`gateway` has none). Flyway.
- **Redis — three separate instances:** `redis-inventory` (the arbiter: AOF `everysec`
  + replica), `redis-gateway` (queue + rate limits), `redis-cache` (catalog cache).
  The arbiter is never shared with a throwaway cache.
- **Kafka (KRaft):** keyed by `matchId`; compacted topics for state-carrying events.
  JSON with `schemaVersion` first; Schema Registry later (RF-15).
- **Neo4j** (identity) and **MinIO/S3** (ticketing) — added by the tickets that need them (RF-13).
- **Kafka Streams state store** (catalog) — PVC in Kubernetes.
- **Observability is load-bearing:** Prometheus + Grafana + OpenTelemetry. The
  admission controller *consumes* p99 latency and Hikari saturation.
- **Kubernetes:** HPA on `gateway`/`catalog`, KEDA on Kafka lag, PDBs, readiness
  probes reporting pool health. HPA does not protect Postgres — admission control does.

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
5. Web app + SSE live updates (Sprints 7–8) → **M2 Portfolio MVP** (Mar 2, stretch Feb 23).
6. Real feeds, identity, gate ops, observability, Kubernetes, advanced capabilities (Sprints 9–17).

See [ROADMAP.md](../scrum/ROADMAP.md).
