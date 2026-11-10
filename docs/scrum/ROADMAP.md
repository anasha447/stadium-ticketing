# Roadmap

Epics, milestones, the sprint calendar and every planned sprint. Sprints 1–3 are
detailed in `sprints/`; the rest are outlined and get detailed one sprint ahead
(rolling wave, see WORKFLOW.md). Ticket IDs: Sprint N uses `TKT-N01…N99`.

**Baseline (2026-11-10):** 4–5 h/day of coding and review, 5 days/week → ~45 h per
2-week sprint → **24 points** planned. Sprint 1 is 28 — deliberately full; whatever
is unfinished carries over as the first item of Sprint 2, and that is the first velocity signal. Re-baselined at the Sprint 2 Review.

---

## Hitting February — the honest math

| | |
|---|---|
| Points Sprints 1–3 (M1) | 76 |
| Points to M2 in the original 9-sprint plan | 219 → at 24/sprint ≈ 9 sprints → **mid-March** |
| Points to M2 after re-scoping (below) | **192** + 3 buffer → 8 sprints → **Mar 2** |
| Late-February M2 (Feb 23) needs | average velocity ≥ **26**, or one more scope cut |

**What was cut from M2 (moved to Sprint 9+, nothing deleted):** the Football-Data
**live** adapter and scheduled sync (the demo uses the fixture adapter), Importance
pricing, live scores and weather, rate limiting, and cancelling in-flight Orders on
`hold.expired` (the saga already rejects an expired Hold at the confirm step).

**What M2 still proves:** Waiting Room + Draw → Admission → atomic Hold of adjacent seats
with a Quote → idempotent Order → Confirmation Saga with compensation → Ticket → live
seat map over SSE, in a browser, plus a k6 smoke test. That is the whole interview story.

**Decision point — Sprint 2 Review (Dec 8):** if velocity ≥ 26, aim for **Feb 23**;
if it is ~24, M2 is **Mar 2**; if it is < 22, cut TKT-704 (waiting-room screen polish)
and TKT-803 (My Tickets page) from M2 to keep Mar 2.

## Calendar

| Sprint | Dates | Goal | Milestone |
|---|---|---|---|
| 1 | Wed Nov 11 – Tue Nov 24, 2026 | Walking skeleton of the Seat Map | **M0 Foundation** |
| 2 | Nov 25 – Dec 8 | Atomic holds | — (velocity decision) |
| 3 | Dec 9 – Dec 22 | Adjacency, price & events | **M1 Bookable Core** |
| 4 | Dec 23 – Jan 5, 2027 | Catalog core & seat confirmation | — |
| 5 | Jan 6 – Jan 19 | Money path | — |
| 6 | Jan 20 – Feb 2 | Tickets & the edge | — |
| 7 | Feb 3 – Feb 16 | Admission & web app | — |
| 8 | Feb 17 – Mar 2 | Live & checkout | **M2 Portfolio MVP** (stretch: Feb 23) |
| 9 | Mar 3 – Mar 16 | Real data & signals | — |
| 10 | Mar 17 – Mar 30 | Identity & anti-scalping | — |
| 11 | Mar 31 – Apr 13 | Gate operations | — |
| 12 | Apr 14 – Apr 27 | Observability & load | — |
| 13 | Apr 28 – May 11 | Kubernetes | **M3 Production-grade** |
| 14 | May 12 – May 25 | Dynamic pricing & resale | — |
| 15 | May 26 – Jun 8 | Ticket documents & match day | — |
| 16 | Jun 9 – Jun 22 | Fraud ring detection | — |
| 17 | Jun 23 – Jul 6 | Bot risk & portfolio polish | **M4 Full platform** |

If you want a rest week (holidays, interviews), insert it as an empty sprint and shift
the dates — never squeeze two sprints into one.

## Epics

| Epic | Title | Covers |
|---|---|---|
| **EP-1** | Platform Foundation | parent POM, Compose, contracts module, CI; infra added per epic as needed |
| **EP-2** | Match Catalog & Signals | feeds (ports + live/fixture adapters), Importance, weather, live scores, demand topology host |
| **EP-3** | Core Booking — Seat Inventory & Holds | Seat Map, Block geometry, Seat State, Allocator, Runs, No-Orphan, TTL expiry, occupancy, confirm |
| **EP-4** | Pricing & Quotes | tiers, Importance, Time Decay, Group Discount, immutable Quote, Demand Multiplier + guardrails |
| **EP-5** | Orders, Payments & Tickets | idempotency, Confirmation Saga, Outbox, mock PSP, Ticket issuance |
| **EP-6** | Access Control & Waiting Room | gateway filters, JWT check, Registration Window, Draw, Admission Token, rate limits, SSE |
| **EP-7** | Identity & Anti-Scalping | OTP Verified Identity, Device binding, Purchase Limit, Bot Risk, Fraud Ring Detection |
| **EP-8** | Gate Operations & Ticket Documents | Rotating/Print Credential, Scan Ledger, Disputes, Resale, PDF pipeline, Souvenir |
| **EP-9** | Admin & Observability | occupancy map, admission panel, fraud queue, Prometheus/Grafana/OTel, k6 |
| **EP-10** | Web App | Next.js Fan flow, waiting room UI, seat map, checkout, Steward scanner, Admin screens |
| **EP-11** | Deployment | Kubernetes manifests, HPA/KEDA/PDB, probes, local cluster |

## Milestones

| Milestone | After sprint | What you can demo | Interview story |
|---|---|---|---|
| **M0 Foundation** | 1 (Nov 24) | 5000-seat map in Postgres + Redis over HTTP, CI green on every PR | multi-module build, Flyway, Testcontainers, CI |
| **M1 Bookable Core** | 3 (Dec 22) | hold 4 adjacent seats with a priced Quote, expiry, race test with one winner | Redis + Lua atomicity, TTL design, pure domain, TDD |
| **M2 Portfolio MVP** | 8 (Mar 2, stretch Feb 23) | queue → hold → pay → ticket in a browser, live seat map | flash crowd, saga, idempotency, outbox |
| **M3 Production-grade** | 13 (May 11) | real fixtures, identity, gate scanning, metrics, 50k k6 run, Kubernetes | observability, load testing, K8s |
| **M4 Full platform** | 17 (Jul 6) | demand pricing, resale, PDFs, fraud graph, bot risk | event streaming, graph analytics |

---

## Sprint map

### Sprint 1 — Walking Skeleton of the Seat Map · EP-1, EP-3 · 28 pts → **M0**
| Ticket | Title | Pts |
|---|---|---|
| TKT-100 | Verify repository baseline | 0 |
| TKT-101 | Root POM + `inventory` from Initializr + Docker Compose | 5 |
| TKT-106 | CI on pull requests (GitHub Actions) — right after TKT-101 | 2 |
| TKT-102 | Seat Map, Block and Seat Claim schema + overselling backstop | 5 |
| TKT-103 | Seat Map Generator — 5000 seats, 1000 VIP, Blocks, idempotent | 8 |
| TKT-104 | Seat Map REST API + integration test | 3 |
| TKT-105 | Redis Seat State projection + atomic warmup + occupancy | 5 |

### Sprint 2 — Atomic Holds · EP-3 · 24 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-201 | Seat State machine + Hold aggregate (pure domain) | 3 |
| TKT-202 | `hold_seats.lua` + `SeatStateStore` port + Redis adapter + race tests | 8 |
| TKT-204 | `release_hold.lua` + lazy-expiry read path | 3 |
| TKT-203 | Hold API: create, get, release, 4-seat cap | 5 |
| TKT-205 | Hold Expiry Sweeper (ZSET + ShedLock) | 5 |

### Sprint 3 — Adjacency, Price & Events · EP-3, EP-4 · 24 pts → **M1**
| Ticket | Title | Pts |
|---|---|---|
| TKT-301 | Run search + No-Orphan scorer (pure, property-tested) | 5 |
| TKT-302 | Ranked-candidate protocol: `find_and_hold_run.lua` + ADJACENT mode | 8 |
| TKT-303 | Pure pricing module | 5 |
| TKT-304 | Immutable Quote issued with every Hold | 3 |
| TKT-305 | Kafka in Compose + `contracts` module + publishing `seat.held` / `hold.expired` / `seat.released` | 3 |

### Sprint 4 — Catalog Core & Seat Confirmation · EP-2, EP-3 · 24 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-401 | `catalog` service (Initializr) — hexagonal skeleton: Competition, Team, Match + Flyway | 3 |
| TKT-402 | `MatchFeed` port + fixture adapter (offline fixtures, no API key) | 3 |
| TKT-403 | Match creation + `match.scheduled` via transactional outbox | 5 |
| TKT-404 | `inventory` consumes `match.scheduled` → generate + warmup (idempotent consumer) | 5 |
| TKT-405 | Confirm: `confirm_sold.lua` + `seat_claims` + inventory outbox `seat.sold` | 8 |

### Sprint 5 — Money Path · EP-3, EP-5 · 24 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-501 | `unconfirm` compensation + Redis-flushed backstop test | 3 |
| TKT-502 | `ticketing` service (Initializr) + Order aggregate + Flyway | 5 |
| TKT-503 | Idempotency-Key store + filter (replay, 422 on mismatch, concurrent test) | 5 |
| TKT-504 | `PaymentGateway` port + mock PSP adapter + payment attempts | 3 |
| TKT-505 | Confirmation Saga: persisted state machine + compensations + failure-injection tests | 8 |

### Sprint 6 — Tickets & the Edge · EP-5, EP-6 · 23 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-601 | Outbox publisher (poller) + `order.confirmed` | 5 |
| TKT-602 | Ticket issuance + `processed_messages` consumer dedupe | 5 |
| TKT-603 | `gateway` service (Initializr) — Spring Cloud Gateway routes to all services | 3 |
| TKT-604 | `identity` stub (Initializr): JWT issuance + JWKS; gateway JWT filter replaces `X-Fan-Id` | 5 |
| TKT-605 | Registration Window + Draw (Redis set → shuffled zset) | 5 |

### Sprint 7 — Admission & Web App · EP-6, EP-10 · 24 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-701 | Admission filter + Admission Token + checkout grant | 8 |
| TKT-702 | Next.js scaffold: API client, auth flow, layout, match list + match page | 5 |
| TKT-703 | Seat map renderer (sections → blocks → seats, tier colours, states) | 8 |
| TKT-704 | Waiting room screen (registration, position, admission) | 3 |

### Sprint 8 — Live & Checkout · EP-6, EP-10 · 21 pts + 3 buffer → **M2 Portfolio MVP**
| Ticket | Title | Pts |
|---|---|---|
| TKT-801 | Hold flow UI: select on map / pick-for-me, countdown, Quote | 5 |
| TKT-802 | Gateway SSE fan-out over Redis pub/sub: seat deltas to every browser | 8 |
| TKT-803 | Checkout + order status + My Tickets pages (mock payment) | 5 |
| TKT-804 | End-to-end demo script, portfolio README, k6 smoke (5k VUs) | 3 |
| — | Buffer for bugs found while connecting everything | 3 |

---

*After M2 — outlined; order may change at each Sprint Planning.*

### Sprint 9 — Real Data & Signals · EP-2, EP-4, EP-5 · 23 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-901 | Football-Data.org live adapter: anti-corruption layer, Resilience4j, ETag | 8 |
| TKT-902 | Scheduled sync + persisted projection (works when provider is down) | 5 |
| TKT-903 | Importance calculator + `match.importance.changed` → pricing input | 5 |
| TKT-904 | `hold.expired` consumer cancels in-flight Orders | 5 |

### Sprint 10 — Identity & Anti-Scalping · EP-7, EP-6 · 23 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-1001 | OTP Verified Identity (mock SMS adapter) | 5 |
| TKT-1002 | Device binding | 5 |
| TKT-1003 | Purchase Limit ledger + saga reserve/release step (ticketing → identity, sync) | 5 |
| TKT-1004 | Real JWT: refresh tokens, roles Fan/Admin/Steward | 5 |
| TKT-1005 | Rate limiting per identity / Device / IP (Redis sliding window) | 3 |

### Sprint 11 — Gate Operations · EP-8, EP-10 · 24 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-1101 | Rotating Credential (HMAC, 30 s window) + device delivery | 8 |
| TKT-1102 | Scan Ledger, first-scan-wins, Dispute | 5 |
| TKT-1103 | Steward scanner page with offline key bundle | 8 |
| TKT-1104 | Dispute screen | 3 |

### Sprint 12 — Observability & Load · EP-9 · 23 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-1201 | Prometheus + Grafana + OpenTelemetry tracing across services | 5 |
| TKT-1202 | Metric-driven admission rate (p99 + pool saturation) | 5 |
| TKT-1203 | Admin occupancy heatmap (SSE) | 5 |
| TKT-1204 | k6 50k VU flash-crowd test + written report | 8 |

### Sprint 13 — Kubernetes · EP-11 · 21 pts → **M3 Production-grade**
| Ticket | Title | Pts |
|---|---|---|
| TKT-1301 | Manifests for all services + infra (kind/k3d) | 8 |
| TKT-1302 | Probes, HPA, PDB | 5 |
| TKT-1303 | KEDA scaling on Kafka lag | 5 |
| TKT-1304 | Deployment runbook | 3 |

### Sprint 14 — Dynamic Pricing & Resale · EP-4, EP-8 · 24 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-1401 | Kafka Streams Booking Velocity topology (in `catalog`) | 8 |
| TKT-1402 | Demand Multiplier consumer + surge guardrails | 5 |
| TKT-1403 | Time Decay schedule published per match | 3 |
| TKT-1404 | Face-value Resale + `order.cancelled` → seat recycling | 8 |

### Sprint 15 — Ticket Documents & Match Day · EP-8, EP-2, EP-7 · 24 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-1501 | Print Credential class + `Match.printAllowed` + ID-check prompt | 5 |
| TKT-1502 | PDF pipeline: consumer → Thymeleaf → MinIO → pre-signed URL | 8 |
| TKT-1503 | Live scores in live windows, weather (Open-Meteo), `match.finished` | 3 |
| TKT-1504 | Souvenir projection + re-render | 5 |
| TKT-1505 | Turnstile / proof-of-work at registration | 3 |

### Sprint 16 — Fraud Ring Detection · EP-7, EP-9 · 23 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-1601 | `riskgraph/` module + `order.confirmed` consumer + `FraudGraph` port | 5 |
| TKT-1602 | Neo4j model + fingerprint-only ingestion | 5 |
| TKT-1603 | Fan-out queries + GDS community detection → `fraud.ring.detected` | 8 |
| TKT-1604 | Tiered response + Admin review queue | 5 |

### Sprint 17 — Bot Risk & Portfolio Polish · EP-7, EP-10, EP-9 · 18 pts → **M4 Full platform**
| Ticket | Title | Pts |
|---|---|---|
| TKT-1701 | Bot Risk score v1 (fingerprint + behaviour, advisory friction) | 5 |
| TKT-1702 | Admin match management UI | 5 |
| TKT-1703 | Accessibility pass on the seat map | 3 |
| TKT-1704 | Final k6 re-run, architecture diagrams, portfolio write-up | 5 |

## Velocity

| Sprint | Committed | Completed | Dates | Notes |
|---|---|---|---|---|
| 1 | 28 | | Nov 11 – Nov 24 | baseline sprint — velocity unknown |
