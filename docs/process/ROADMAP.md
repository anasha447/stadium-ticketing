# Roadmap

Milestones, the sprint calendar, every planned sprint, the stretch goals and the Icebox.
The current and next sprint are detailed as GitHub Issues (see `sprints/`); the rest are
titles + points here and get detailed one sprint ahead (rolling wave, HOW-WE-WORK §2).
Ticket IDs: Sprint N uses `TKT-N01…`, numbered in execution order.

**Finish line: M3 Production-grade (end of Sprint 13, May 11, 2027).** Everything in
⭐ Stretch is optional, picked only if time is left.

---

## Milestones

| Milestone | After sprint | What you can demo | Interview story |
|---|---|---|---|
| **M0 Foundation** | 1 (Nov 24) | the 60,560-Seat stadium in Postgres + Redis over HTTP, CI green on every PR | multi-module build, Flyway, Testcontainers, CI, "store the layout, not the Seats" |
| **M1 Bookable Core** | 3 (Dec 22) | hold 4 adjacent seats with a priced Quote, expiry, race test with one winner | Redis + Lua atomicity, TTL design, pure domain, TDD |
| **M2 Portfolio MVP** | 8 (Mar 2, stretch Feb 23) | queue → hold → pay → ticket in the browser on the real backend, live seat map | flash crowd, saga, idempotency, outbox |
| **M3 Production-grade = DONE** | 13 (May 11) | real fixtures, gate scanning, metrics, k6 with 10k admitted Fans and the Waiting Room, Kubernetes, portfolio write-up | observability, load testing, K8s |

**Scale target (re-plan, 2026-11-16):** 60,560 Seats per Match, up to 100,000 Fans in
the Waiting Room, at most 10,000 admitted at once (DESIGN §1).
| ⭐ Stretch | 14+ | demand pricing, resale, PDFs, fraud graph, bot risk | event streaming, graph analytics |

**Decision point — Sprint 2 Review (Dec 8):** M2 needs ≈ 190 points in 8 sprints.
Velocity ≥ 26 → aim for **Feb 23**; ~24 → **Mar 2**; < 22 → move TKT-703 (Price
Override) after M2 to keep Mar 2. The same Review decides what fills the free points in
Sprints 7–8.

Already cut from M2 (moved to Sprint 9+): the Football-Data **live** adapter (the demo
uses fixtures), Importance pricing, live scores and weather, rate limiting, cancelling
in-flight Orders on `hold.expired` (the saga already rejects an expired Hold).

## Calendar

| Sprint | Dates | Goal | Milestone |
|---|---|---|---|
| 1 | Wed Nov 11 – Tue Nov 24, 2026 | Walking skeleton of the Seat Map | **M0** |
| 2 | Nov 25 – Dec 8 | Atomic holds | velocity decision |
| 3 | Dec 9 – Dec 22 | Adjacency, price & events | **M1** |
| 4 | Dec 23 – Jan 5, 2027 | Catalog core & seat confirmation | |
| 5 | Jan 6 – Jan 19 | Money path | |
| 6 | Jan 20 – Feb 2 | Tickets & the edge | |
| 7 | Feb 3 – Feb 16 | Admission & web app | |
| 8 | Feb 17 – Mar 2 | Live & checkout | **M2** |
| 9 | Mar 3 – Mar 16 | Real data & signals | |
| 10 | Mar 17 – Mar 30 | Identity & anti-scalping | |
| 11 | Mar 31 – Apr 13 | Gate operations | |
| 12 | Apr 14 – Apr 27 | Observability & load | |
| 13 | Apr 28 – May 11 | Kubernetes & portfolio | **M3 = done** |

Need a rest week (holidays, interviews)? Insert an empty sprint and shift the dates —
never squeeze two sprints into one.

## Epics

| Epic | Title | Covers |
|---|---|---|
| **EP-1** | Platform Foundation | root POM, Compose, `contracts` module, CI |
| **EP-2** | Match Catalog & Signals | feeds (live + fixture adapters), Importance, live scores, weather |
| **EP-3** | Core Booking | Seat Map, Blocks, Seat State, Holds, Allocator, Runs, No-Orphan, expiry, occupancy, confirm |
| **EP-4** | Pricing & Quotes | tiers, Importance, Time Decay, Group Discount, immutable Quote (⭐ Demand Multiplier) |
| **EP-5** | Orders, Payments & Tickets | idempotency, Confirmation Saga, Outbox, mock PSP, Ticket issuance |
| **EP-6** | Access Control & Waiting Room | gateway filters, JWT, Registration Window, Draw, Admission Token, rate limits, SSE |
| **EP-7** | Identity & Anti-Scalping | fake-OTP Verified Identity, Device binding, Purchase Limit (⭐ Bot Risk, Fraud Ring Detection) |
| **EP-8** | Gate Operations | Rotating Credential, Scan Ledger, Disputes (⭐ Resale, PDF, Souvenir) |
| **EP-9** | Admin & Observability | occupancy map, Prometheus/Grafana/OTel, k6 |
| **EP-10** | Web App | Next.js Fan flow, waiting room, seat map, checkout, Steward scanner |
| **EP-11** | Deployment | Kubernetes manifests, HPA/KEDA/PDB, probes |

---

## Sprint map

### Sprint 1 — Walking Skeleton of the Seat Map · EP-1, EP-3 · 23 pts → M0
| Ticket | Title | Pts |
|---|---|---|
| TKT-100 | Repository baseline ✅ | 0 |
| TKT-101 | Walking skeleton: root POM + `inventory` (Web, Actuator) ✅ | 3 |
| TKT-102 | CI on every pull request | 2 |
| TKT-103 | Postgres + Seat Map schema + overselling backstop | 5 |
| TKT-104 | Seat Map Generator — 120 Blocks, 60,560 Seats, idempotent | 5 |
| TKT-105 | Seat Map REST API | 3 |
| TKT-106 | Redis Seat States + Warmup + Occupancy | 5 |

### Sprint 2 — Atomic Holds · EP-3 · 24 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-201 | Seat State rules + Hold (pure domain) | 3 |
| TKT-202 | Atomic hold in Redis (Lua) + race tests | 8 |
| TKT-203 | Release + lazy expiry | 3 |
| TKT-204 | Hold API: create, get, release, 4-seat cap | 5 |
| TKT-205 | Hold expiry sweeper (one pod at a time) | 5 |

### Sprint 3 — Adjacency, Price & Events · EP-3, EP-4 · 24 pts → M1
| Ticket | Title | Pts |
|---|---|---|
| TKT-301 | Run search + No-Orphan scorer (pure, property-tested) | 5 |
| TKT-302 | Seats together: ranked candidates held atomically | 8 |
| TKT-303 | Pure pricing module | 5 |
| TKT-304 | Immutable Quote with every Hold | 3 |
| TKT-305 | Kafka + `contracts` + hold lifecycle events | 3 |

### Sprint 4 — Catalog Core & Seat Confirmation · EP-2, EP-3 · 24 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-401 | `catalog` service: Competition, Team, Match + Flyway | 3 |
| TKT-402 | `MatchFeed` port + fixture adapter (offline, no API key) | 3 |
| TKT-403 | Match creation + `match.scheduled` via Outbox | 5 |
| TKT-404 | `inventory` consumes `match.scheduled` → generate + Warmup (idempotent) | 5 |
| TKT-405 | Confirm sale: `confirm_sold.lua` + Seat Claims + `seat.sold` via Outbox | 8 |

### Sprint 5 — Money Path · EP-3, EP-5 · 24 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-501 | Unconfirm compensation + backstop test with Redis flushed | 3 |
| TKT-502 | `ticketing` service + Order aggregate + Flyway | 5 |
| TKT-503 | Idempotency Key store (replay, 422 on mismatch, concurrent test) | 5 |
| TKT-504 | `PaymentGateway` port + mock PSP + Payment Attempts | 3 |
| TKT-505 | Confirmation Saga: persisted state machine + compensations | 8 |

### Sprint 6 — Tickets & the Edge · EP-5, EP-6, EP-7 · 21 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-601 | Outbox publisher + `order.confirmed` | 5 |
| TKT-602 | Ticket issuance + consumer dedupe | 5 |
| TKT-603 | `gateway` service: routes to all services | 3 |
| TKT-604 | `identity`: fake one-time code → Verified Identity → JWT + JWKS, `GET /auth/session`; gateway JWT filter replaces `X-Fan-Id` | 8 |

### Sprint 7 — Waiting Room & Admission · EP-4, EP-6, EP-10 · 19 pts + 5 free
| Ticket | Title | Pts |
|---|---|---|
| TKT-701 | Registration Window + Draw, Waiting Room status (four phases) | 5 |
| TKT-702 | Admission: Admission Cap (10,000 at once, 200/s), 10-min idle rule, 30-min ceiling, Admission Token + Checkout Grant | 8 |
| TKT-703 | Price Override per Match and Tier, locked at `bookingOpensAt` | 3 |
| TKT-704 | Frontend on the real gateway: match pages, stadium, Waiting Room | 3 |

### Sprint 8 — Live & Checkout · EP-6, EP-10 · 17 pts + 7 free → M2
| Ticket | Title | Pts |
|---|---|---|
| TKT-801 | Gateway SSE fan-out over Redis pub/sub: `seat-delta` and "now serving" | 8 |
| TKT-802 | Frontend on the real gateway: Holds, checkout, Tickets | 3 |
| TKT-803 | End-to-end demo script, portfolio README, k6 smoke (5k VUs) | 3 |
| — | Buffer for integration bugs | 3 |

**Renumbered on 2026-11-16 (issue #39).** No GitHub Issue existed for these yet.

| Old | New | Why |
|---|---|---|
| TKT-605 Registration Window + Draw | TKT-701 | Sprint 6 grew with the one-time code |
| TKT-701 Admission | TKT-702 | follows the Draw; gains the Admission Cap and idle rule |
| new | TKT-703 Price Override | needs the Match's real `bookingOpensAt` (Sprint 4) |
| TKT-702, 703, 704 (web app) | TKT-704 | built on the F-track; what is left is pointing it at the gateway |
| TKT-802 SSE fan-out | TKT-801 | |
| TKT-801, 803 (hold flow, checkout) | TKT-802 | built on the F-track |
| TKT-804 demo + k6 smoke | TKT-803 | |
| TKT-1001 fake OTP | mostly TKT-604 | the M2 checkout needs sign-in |

### Sprint 9 — Real Data & Signals · EP-2, EP-4, EP-5 · 23 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-901 | Football-Data.org live adapter: anti-corruption layer, Resilience4j, ETag | 8 |
| TKT-902 | Scheduled sync + persisted projection (works when provider is down) | 5 |
| TKT-903 | Importance calculator → pricing input | 5 |
| TKT-904 | `hold.expired` consumer cancels in-flight Orders | 5 |

### Sprint 10 — Identity & Anti-Scalping · EP-7, EP-6 · 20 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-1001 | One Verified Identity per phone (hashed), re-verification rules | 2 |
| TKT-1002 | Device binding | 5 |
| TKT-1003 | Purchase Limit ledger + saga reserve/release step | 5 |
| TKT-1004 | Real JWT: refresh tokens, roles Fan/Admin/Steward | 5 |
| TKT-1005 | Rate limiting per identity / Device / IP | 3 |

### Sprint 11 — Gate Operations · EP-8, EP-10 · 24 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-1101 | Rotating Credential (HMAC, 30 s window) + device delivery | 8 |
| TKT-1102 | Scan Ledger, first scan wins, Dispute | 5 |
| TKT-1103 | Steward scanner page with offline key bundle | 8 |
| TKT-1104 | Dispute screen | 3 |

### Sprint 12 — Observability & Load · EP-9 · 23 pts
| Ticket | Title | Pts |
|---|---|---|
| TKT-1201 | Prometheus + Grafana + OpenTelemetry tracing | 5 |
| TKT-1202 | Metric-driven admission rate (p99 + pool saturation) | 5 |
| TKT-1203 | Admin occupancy heatmap (SSE) | 5 |
| TKT-1204 | k6 flash crowd: 10k admitted Fans to a sellout, the Waiting Room to the laptop's limit, 100k reasoned in the report | 8 |

### Sprint 13 — Kubernetes & Portfolio · EP-11 · 24 pts → M3 = DONE
| Ticket | Title | Pts |
|---|---|---|
| TKT-1301 | Manifests for all services + infra (kind/k3d) | 8 |
| TKT-1302 | Probes, HPA, PDB | 5 |
| TKT-1303 | KEDA scaling on Kafka lag | 5 |
| TKT-1304 | Deployment runbook | 3 |
| TKT-1305 | Final k6 re-run, architecture diagrams, portfolio write-up | 3 |

---

## Frontend track (F-track) · EP-10 · ADR-0006

A separate track where Claude writes the code and Anas reviews. It runs beside the
backend sprints, whose contents and dates above are unchanged. Not pointed: it does not
count toward backend velocity. Ticket IDs: `TKT-F<sprint><nn>`. Brief:
`.claude/skills/animation.md`. Contracts: `docs/architecture/FRONTEND.md`.

Ticket by ticket, with status and links: [`FRONTEND-TICKETS.md`](FRONTEND-TICKETS.md).

### F1 — Foundation · Nov 14 – Nov 20, 2026
| Ticket | Title |
|---|---|
| TKT-F101 | Design system: `stadium-design-system` skill, tokens in `globals.css`, fonts |
| TKT-F102 | Typed API client + mock layer for the §11 paths (60K Seat Map generator, Holds, Quotes, Orders) |
| TKT-F103 | App shell, match list, match page (server components) |

### F2 — The Stadium · Nov 21 – Nov 27
| Ticket | Title |
|---|---|
| TKT-F201 | Camp Nou bowl from the photos: three Levels, roof ring, facade, pitch, goals |
| TKT-F202 | 60K instanced Seats in 120 Blocks + yellow mosaic (Spotify symbol, crest, "FC BARCELONA") |
| TKT-F203 | Stadium view → Block view → Seat view, with camera flights and Seat State colours in Block view |
| TKT-F204 | Mini-map, breadcrumbs, Tier legend filter, hover cards |

### F3 — Booking · Nov 28 – Dec 4

_Order changed on 14 Nov 2026: F303 and F304 wait until F401–F403 are done; F404 stays
last. See `FRONTEND-TICKETS.md`._
| Ticket | Title |
|---|---|
| TKT-F301 | Waiting Room screen with the Draw animation |
| TKT-F302 | "Your seats" drawer (max 4), Hold, countdown, Quote |
| TKT-F303 | Sign-in with the fake one-time code + demo checkout + Order status |
| TKT-F304 | Confirmation, Tickets, My Tickets, "mine" seats in the stadium |

### F4 — Atmosphere & Polish · Dec 5 – Dec 11
| Ticket | Title |
|---|---|
| TKT-F401 | Night sky, floodlights, live match (22 players, referee, ball), fans on sold seats |
| TKT-F402 | Live Seat State updates over SSE (mock stream) |
| TKT-F403 | Touch, phone layout, reduced motion, keyboard path through the 2D mini-map |
| TKT-F404 | `impeccable` audit, `ui-taste` review, performance pass |
| TKT-F405 | The stadium's surroundings (plaza, ring road, fans arriving, skyline) and a camera that stays on the stadium |

**Effect on backend tickets:** the old web-app tickets became TKT-704 and TKT-802
(3 points each): point the finished frontend at the gateway. The contracts the frontend
fixed first were resolved into the backend docs on 2026-11-16 (issue #39); see
[`FRONTEND-DEVIATIONS.md`](FRONTEND-DEVIATIONS.md), which also lists what the frontend
changes after the backend is done.

---

## ⭐ Stretch goals (after M3, pick in any order)

| ID | Title | Pts |
|---|---|---|
| STR-01 | Kafka Streams Booking Velocity topology (in `catalog`) | 8 |
| STR-02 | Demand Multiplier consumer + surge guardrails | 5 |
| STR-03 | Time Decay schedule published per Match | 3 |
| STR-04 | Face-value Resale + seat recycling | 8 |
| STR-05 | Print Credential + `Match.printAllowed` + ID-check prompt | 5 |
| STR-06 | PDF pipeline: Thymeleaf → MinIO → pre-signed URL | 8 |
| STR-07 | Live scores in live windows, weather, `match.finished` | 3 |
| STR-08 | Souvenir projection | 5 |
| STR-09 | Turnstile / proof-of-work at registration | 3 |
| STR-10 | Fraud Ring Detection: Neo4j model, ingestion, community detection, Admin review queue | 21 (split before starting) |
| STR-11 | Bot Risk score v1 (advisory friction) | 5 |
| STR-12 | Admin match management UI | 5 |
| STR-13 | Accessibility pass on the seat map | 3 |

## Icebox (ideas, not scheduled)

| Idea | Why it matters | Trigger to schedule |
|---|---|---|
| Weighted Draw (members / loyal Fans first) | fairness policy beyond equal odds | a real club would ask for it |
| Avro + Schema Registry for events | safe schema evolution | 3+ consumers of one topic |
| Debezium CDC instead of the Outbox poller | lower latency, no polling | poller lag visible in metrics |
| Stripe test-mode adapter | real PSP integration story | after M2 |
| Venue model: layout once per venue | removes per-match layout duplication | after M2, if time allows |
| Hold extension (once, uncontended) | UX for slow payers | after M2 |
| Redis Cluster for inventory | horizontal arbiter scaling (keys are already slot-safe) | load test saturates one Redis |
| CDN for seat-map snapshots | offload the read path | k6 shows the read path hot |
| Nightly 1000× race test in CI | catches rare races | after TKT-202 |
| ArchUnit test keeping `domain/` free of Spring | stops framework creep | after Sprint 2 |

## Velocity

| Sprint | Committed | Completed | Notes |
|---|---|---|---|
| 1 | 23 | | baseline sprint — velocity unknown; re-planned from 26 on Nov 16 |
