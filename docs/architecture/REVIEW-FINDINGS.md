# Architecture Review Findings — 2026-11-09

Senior review of the original plan before Sprint 1 starts. Each finding has an ID
(RF-xx) so tickets, ADRs and commits can reference it.

**Status legend**
- **Applied** — fixed in the split docs; nothing to decide.
- **Decision needed** — the docs carry the recommended option, but you must confirm.
- **Deferred** — valid, but scheduled for a later ticket.

| ID | Severity | Area | Status |
|---|---|---|---|
| RF-01 | High | Spring Boot 3.x is end-of-life | Applied — Boot 4.1 + Java 21 |
| RF-02 | High | Redis keys break in Redis Cluster (hash slots) | Applied |
| RF-03 | High | "One transaction" claim spans two databases | Applied |
| RF-04 | Medium | Per-row vs per-Block bitmap contradiction | Applied |
| RF-05 | Medium | `seats` schema missing Block columns | Applied |
| RF-06 | Medium | `UNIQUE(hold_id)` blocks payment retry with another card | Applied |
| RF-07 | Medium | Admission Token TTL shorter than hold + payment | Applied |
| RF-08 | Medium | Hold endpoints cannot find the hold without `matchId` | Applied |
| RF-09 | Medium | No frontend epic | Applied |
| RF-10 | Medium | No MVP cut-line; scope too large to finish linearly | Applied — M2 re-planned to the February date |
| RF-11 | Medium | Purchase Limit enforcement point undefined | Applied — saga step, ticketing → identity |
| RF-12 | Low | Seat layout duplicated per Match (Venue model) | Deferred — per-Match kept, Venue in backlog |
| RF-13 | Low | Neo4j / MinIO added to Compose in Sprint 1 (YAGNI) | Applied |
| RF-14 | Low | Hold events have no delivery guarantee stated | Applied |
| RF-15 | Low | Schema Registry from day one | Deferred |
| RF-16 | Low | Occupancy counters drift between lazy expiry and sweep | Applied |
| RF-17 | Low | Warmup can expose a half-built projection | Applied |

---

## RF-01 — Spring Boot 3.x is end-of-life (High)

**Finding.** The plan pins "Spring Boot 3.x". The last 3.x line (3.5) lost
open-source support on 30 June 2026. The current stable line is **Spring Boot 4.1**
(released June 2026, OSS support until about July 2027); 4.0 loses support at the
end of December 2026.

**Recommendation.** Start on **Spring Boot 4.1.x**. A new portfolio project on an EOL
framework is a red flag in an interview, and Boot 4 is what you would be asked about.

**What changes for you:** Spring Framework 7, Jakarta EE 11, Jackson 3 as default,
modularised starters, JUnit 4 support gone, `@MockBean` replaced by `@MockitoBean`.
Most Boot 3 tutorials still apply; where they don't, the teaching loop flags it.

**Java:** Boot 4 supports Java 17–25. Java 21 (the plan) is fine. Java 25 is the newer
LTS. → **Question Q1.** Tracked as [ADR-0004](../adr/0004-spring-boot-4.md).

## RF-02 — Redis keys break under Redis Cluster (High)

**Finding.** A Lua script must touch only keys in one hash slot when Redis runs as a
cluster. The plan's `hold:{holdId}` and `fan:{f}:match:{m}:holds` hash on different
values than `match:{m}:seats`, so the hold script would fail with `CROSSSLOT` the day
you move to a cluster.

**Fix (applied in DATA-MODEL.md).** Every key a script touches starts with the
**hash tag** `match:{<matchId>}:` — Redis hashes only the text inside the first `{…}`,
so all keys of one match land in one slot:
`match:{m}:hold:<holdId>`, `match:{m}:fan:<fanId>:holds`, `match:{m}:quote:<quoteId>`.
Even on a single Redis instance today, this costs nothing and removes a future rewrite.
Every key must also be passed in `KEYS[]`, never built inside Lua.

## RF-03 — "One transaction" spans two databases (High)

**Finding.** §2 says the confirm transaction inserts into `seat_claims` (inventory DB),
and §4 says the same confirm writes Order + Payment + Ticket + Outbox (ticketing DB).
Those are two databases in two services — there is no single transaction.

**Fix (applied in DESIGN.md §4).** The Confirmation Saga has explicit steps:

1. `ticketing` authorizes payment (mock PSP).
2. `ticketing` → `inventory` `POST /matches/{m}/holds/{h}/confirm`:
   Lua `confirm_sold` flips `H → S`, then **inventory's own** Postgres transaction
   inserts `seat_claims` (SOLD) + an inventory outbox row (`seat.sold`).
   The partial unique index is the backstop here.
3. `ticketing`'s single local transaction: Order + PaymentAttempt + Tickets + Outbox.
4. Failure in 3 → compensate step 2 (`unconfirm`: claim → CANCELLED, seat → A) and
   void the authorization.

"Charged but no ticket" is still impossible because capture happens only after step 3
commits. That is the part to say out loud in interviews.

## RF-04 — Per-row vs per-Block bitmaps (Medium)

The Redis key table and TKT-105 AC say `match:{m}:row:{r}`, while capability A moves
bitmaps to per-Block. **Fixed:** one bitmap per Block, `match:{m}:block:<blockId>`,
bit index = `position_in_block`.

## RF-05 — `seats` table missing Block columns (Medium)

The slice schema lists `seats(match_id, seat_id, section, row_label, number, tier)`.
**Fixed:** `blocks` table added; `seats` gains `block_id` and `position_in_block`;
a `seat_maps` header row gives generation its idempotency key.

## RF-06 — `UNIQUE(hold_id)` and payment retry (Medium)

If the first card is declined, the Order row already owns the `hold_id`, so the Fan
cannot retry inside the same Hold. **Fixed:** keep `UNIQUE(hold_id)` on `orders`
(one Order per Hold), and model payments as `payment_attempts` (1 Order → N attempts,
at most one `CAPTURED`). Retry = new attempt on the same Order, new Idempotency-Key.

## RF-07 — Admission Token TTL vs hold + payment (Medium)

Token TTL ~8 min and Hold TTL ~8 min means a Fan who holds at minute 6 loses the
token mid-checkout. **Fixed:** the token is checked on `POST /holds` only; a
successful Hold returns a short **checkout grant** bound to that `holdId` whose
expiry equals the Hold's. `POST /orders` requires the grant, not the token.

## RF-08 — Hold endpoints need the match (Medium)

`DELETE /holds/{id}` cannot build the key `match:{m}:hold:<h>` without `matchId`.
**Fixed:** holds are nested: `POST /matches/{m}/holds`, `DELETE /matches/{m}/holds/{h}`,
`POST /matches/{m}/holds/{h}/confirm`.

## RF-09 — No frontend epic (Medium)

Next.js is in the stack but no epic or ticket builds it. **Fixed:** **EP-10 Web App**
added, with a Sprint 8 for the Fan flow and later Steward/Admin screens.

## RF-10 — No MVP cut-line (Medium)

Nine epics including Neo4j, Kafka Streams and a PDF pipeline before anything is
demoable is the most common way solo projects die. **Recommendation:** milestone
**M2 "Portfolio MVP"** at the end of Sprint 9 — queue → hold → pay → ticket → live
seat map, end to end, with a k6 smoke test. Fraud graph, demand pricing and PDFs come
after it. → **Question Q4.**

## RF-11 — Where is the Purchase Limit enforced? (Medium)

The limit lives in `identity` (Postgres), holds live in `inventory` (Redis), orders in
`ticketing`. The plan does not say who calls whom. **Recommendation:** `ticketing`
reserves against the ledger as a Saga step before capture
(`POST /purchase-limits/reserve`, idempotent on `orderId`), with compensation on
failure. Only ~1250 calls per match, so it is safe on this path. → **Question Q5.**

## RF-12 — Seat layout duplicated per Match (Low)

The stadium is physical; 5000 seat definitions are re-generated for every match.
**Option:** `venue_seats` generated once per venue layout; per-match data is only state
and price. Cleaner, but a bigger first ticket. The docs keep the plan's per-match model
because it is simpler to learn on. → **Question Q2.**

## RF-13 — Neo4j and MinIO in Sprint 1 (Low)

Adding infrastructure you will not touch for 12 sprints slows every `compose up`.
**Fixed:** each container is added by the ticket that first needs it.

## RF-14 — Hold events have no stated guarantee (Low)

Inventory writes nothing to Postgres on hold, so `seat.held`/`hold.expired` cannot use
an outbox. **Fixed (documented in EVENTS.md):** these are **best-effort** events used
for UX and demand signals, never for money. `seat.sold` *does* go through inventory's
outbox because the confirm step writes Postgres.

## RF-15 — Schema Registry on day one (Low, Deferred)

JSON records with an explicit `schemaVersion` field in `contracts/` are enough until
several consumers exist. Avro + Schema Registry is a backlog ticket.

## RF-16 — Occupancy counter drift (Low)

Lazy expiry makes a seat available before the sweeper runs, but `occupancy.held` is
only decremented by the sweeper. **Fixed:** the API documents occupancy as accurate
within ~1 s (one sweep tick); the sweeper is the only writer of the `held → available`
counter move, and it is idempotent.

## RF-17 — Warmup can expose a half-built projection (Low)

Rebuilding `match:{m}:seats` in place lets readers see a partial map. **Fixed:** warmup
writes to `…:staging` keys and swaps them with `RENAME` — atomic, and legal because the
keys share a hash slot (RF-02).

---

## Decisions log (answered 2026-11-10)

| ID | Question | Decision | Applied in |
|---|---|---|---|
| Q1 | Java and Spring Boot version | **Spring Boot 4.1.x + Java 21.** 4.1 is not fully backward compatible with 3.x; the differences are listed in ADR-0004 and flagged when first met | ADR-0004, TKT-101 |
| Q2 | Seat Map per Match or Venue layout | **One Seat Map per Match** — focused first tickets; Venue stays in the backlog | TKT-102, TKT-103, BACKLOG |
| Q3 | Time budget and sprint length | **4–5 h/day of coding and review, 5 days/week**, 2-week sprints (~45 h), 24-point baseline re-measured after Sprint 2 | WORKFLOW §1, ROADMAP |
| Q4 | M2 target | **Mid-to-late February 2027** → M2 re-scoped to fit 8 sprints: commit **Mar 2**, stretch **Feb 23** if velocity ≥ 26; see ROADMAP "Hitting February" | ROADMAP |
| Q5 | Purchase Limit enforcement | **Saga step:** `ticketing` calls `identity` synchronously (`/purchase-limits/reserve`) | DESIGN §4, TKT-1003 |
| Q6 | Repository host | **GitHub**, with GitHub Actions CI (TKT-106, now committed) and GitHub pull requests for every review | SPRINT-01, WORKFLOW §5 |

### Working rules added by Anas

1. **No copy-paste git commands.** Claude tells Anas *what* to do (create the branch for
   TKT-102, commit when green, open the PR, merge after approval). Anas types the commands;
   Claude corrects only when something is wrong.
2. **Services are generated on start.spring.io by Anas.** Claude gives the exact Initializr
   settings and dependency names, never a raw `pom.xml`.
3. **Strict TDD.** No business logic before a failing test exists and has been run (red).
4. **Framework-focused teaching.** No basic Java syntax lessons. Explanations focus on how
   Spring Boot, Redis, Kafka and distributed systems solve a problem differently from
   plain Java.
