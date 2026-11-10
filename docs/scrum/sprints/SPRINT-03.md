# Sprint 3 — Adjacency, Price & Events

| | |
|---|---|
| **Sprint goal** | A Fan can ask "4 seats together" and get the best Run without leaving Orphans; every Hold comes with an immutable, correctly priced Quote; hold lifecycle events reach Kafka. |
| **Epics** | EP-3 Core Booking, EP-4 Pricing & Quotes |
| **Capacity** | 24 points |
| **Milestone** | **M1 Bookable Core** |
| **Dates** | Dec 9 – Dec 22, 2026 |
| **Status** | Detailed — refine at Sprint 3 Planning with Sprint 2 velocity |

| Order | Ticket | Title | Type | Pts | Depends on |
|---|---|---|---|---|---|
| 1 | TKT-301 | Run search + No-Orphan scorer (pure, property-tested) | Story | 5 | TKT-201 |
| 2 | TKT-302 | Ranked-candidate protocol: `find_and_hold_run.lua` + ADJACENT mode | Story | 8 | TKT-301, TKT-203 |
| 3 | TKT-303 | Pure pricing module | Story | 5 | — (parallel-safe) |
| 4 | TKT-304 | Immutable Quote issued with every Hold | Story | 3 | TKT-303, TKT-203 |
| 5 | TKT-305 | `contracts` events + publishing hold lifecycle events | Story | 3 | TKT-205 |

---

## TKT-301 — Run search + No-Orphan scorer (pure, property-tested)

**Type:** Story · **Points:** 5 · **Branch:** `feature/TKT-301-run-scorer`

**User story.** As a Fan asking for k seats together, I get the best available Run, and
the stadium is not left with single unsellable seats.

**Context / why.** Rich policy lives in pure Java where it can be property-tested;
Lua only verifies and holds (DESIGN §A).

**Tests — write first** (run each red before building the scope below; the Acceptance Criteria say what they must prove): `RunFinderTest`, `OrphanRuleTest` (`@CsvSource` with ASCII block pictures), `AllocatorProperties` (jqwik).

**Scope — in**
- `BlockView` (immutable snapshot: blockId, section, row, tier, length, `BitSet` taken)
- `Run(blockId, start, length)`; `RunFinder.candidates(views, k, preference)` → all
  placements of k consecutive free seats inside a Block
- `OrphanRule.createsOrphan(view, run)` — true if, after taking the run, a free span of
  length exactly 1 is left on either side (aisle and Block edge count as walls)
- `RunScorer` → ordered list via a `Comparator` chain:
  fits request → no Orphan → distance from row centre → tier fit with `preference`
- `Allocator.rank(views, k, preference, limit = 5)` → `List<Candidate(run, orphanAllowed)>`;
  candidates that create an Orphan are included **only** if fewer than `limit` orphan-free
  ones exist, and are marked `orphanAllowed = true`

**Acceptance Criteria**
- [ ] Example table passes, e.g. block `[x . . . . x]` (length 6), k = 2 → best run leaves no single free seat
- [ ] Block `[x . . x]`, k = 1 → Orphan unavoidable → still returns a candidate with `orphanAllowed = true` (soft constraint)
- [ ] **Properties (jqwik, random blocks 1–40 seats, random fill, k 1–4):**
      every candidate is contiguous, length k, inside one Block, on free seats only;
      if any orphan-free placement exists, the first candidate is orphan-free
- [ ] No Spring, no Redis in this code

**Concepts to learn:** property-based testing with jqwik (generators, shrinking, why it
finds edge cases example tests miss) · soft vs hard constraints · Yield · why this
scoring must stay in Java and out of Redis (a slow script blocks every other client).

---

## TKT-302 — Ranked-candidate protocol: `find_and_hold_run.lua` + ADJACENT mode

**Type:** Story · **Points:** 8 · **Branch:** `feature/TKT-302-ranked-candidates`

**User story.** As a Fan, "pick 4 seats together for me" gives me adjacent seats in one
request, even while hundreds of others pick at the same time.

**Tests — write first** (run each red before building the scope below; the Acceptance Criteria say what they must prove): `FindAndHoldRunLuaIT`, `AdjacentHoldRaceIT`, `AdjacentHoldApiIT`.

**Scope — in**
- `BlockViewReader`: loads bitmaps for the Blocks matching the preference
  (`GET` of the bitmap string → `BitSet`), pipelined
- `find_and_hold_run.lua` per DATA-MODEL.md: walk candidates; for the first whose bits are
  all 0, run the local orphan check (`start-1`, `start-2`, `end+1`, `end+2`, Block
  length); skip if it now creates an Orphan and `orphanAllowed = 0`; else hold it
  exactly like `hold_seats` (reuse logic by copying the minimal block — Lua has no imports)
- `SeatAllocator.holdAdjacent(matchId, k, preference, fanId)`: rank → script → on miss
  re-read + re-rank, max 3 attempts → `NoRunAvailable`
- `POST /matches/{m}/holds` with `{ "mode": "ADJACENT", "quantity": 4, "preference": { "tier": "VIP" } }`

**Acceptance Criteria**
- [ ] Returns k contiguous seats in one Block; all `H:<holdId>`
- [ ] Contention: 200 concurrent ADJACENT requests on a nearly full section → no seat held twice, every success is contiguous
- [ ] Stale view: a candidate taken between ranking and script → script falls through to the next candidate
- [ ] No orphan-free run left anywhere → still succeeds using an `orphanAllowed` candidate
- [ ] Nothing available → 409 `ProblemDetail` `no-run-available` after ≤ 3 attempts
- [ ] Fan cap applies exactly as in explicit mode

**Concepts to learn:** optimistic read + atomic verify (the same idea as compare-and-set
and `@Version`) · bounded retry · why the scorer is not in Lua (script time blocks the
whole Redis) · Redis bitmaps: `GETBIT`, `SETBIT`, `BITPOS`.

---

## TKT-303 — Pure pricing module

**Type:** Story · **Points:** 5 · **Branch:** `feature/TKT-303-pricing`

**User story.** As the business, seat prices follow published rules — tier, match
importance, demand, final-hours decay, group discount — and never go below the floor.

**Tests — write first** (run each red before building the scope below; the Acceptance Criteria say what they must prove): `PriceCalculatorTest` (`@CsvFileSource` from `pricing-cases.csv`), `GroupDiscountTest`, `PricingProperties`.

**Scope — in** (package `pricing/`, no Spring, no I/O)
- `PricingInputs(tier, section, importance, demandMultiplier, hoursToKickoff)`
- `BasePriceTable`, `TimeDecay` (published step schedule, monotone), `PriceFloor`,
  `SurgeCap` (≤ 1.5×), `GroupDiscount` (0 / 5 / 10 / 15 %), `PriceCalculator`
- Composition exactly as DESIGN.md §7: surge capped → decay → floor → per-seat discount
- `Money` as `BigDecimal` + `Currency`; round HALF_EVEN to 2 decimals once, at the end of each line
- Importance and demand come from an `PricingSignals` port with a constant adapter
  (`1.0`) until Sprints 9 and 14

**Acceptance Criteria**
- [ ] Table test covering tier × importance × demand × hoursToKickoff (≥ 30 rows) passes
- [ ] Demand 2.0 is capped at 1.5×
- [ ] A surge never cancels decay: with decay active, price with demand 1.5 ≤ price before the final window with demand 1.5
- [ ] Floor wins when decay would go below it
- [ ] Group discount ladder: seat 1 = 0 %, 2 = 5 %, 3 = 10 %, 4 = 15 %; 5 seats rejected
- [ ] **Property:** price is monotone non-increasing as `hoursToKickoff` → 0 (demand fixed)

**Concepts to learn:** table-driven tests from CSV (`@CsvFileSource`) · keeping a pricing
engine pure so it is testable with zero infrastructure · how Jackson 3 serialises
`BigDecimal` in API responses (number vs string — pick one and document it) · the
`BigDecimal.equals` scale trap in assertions (AssertJ `isEqualByComparingTo`).

---

## TKT-304 — Immutable Quote issued with every Hold

**Type:** Story · **Points:** 3 · **Branch:** `feature/TKT-304-quote`

**User story.** As a Fan, the price I see when I hold seats is exactly the price I will pay.

**Tests — write first** (run each red before building the scope below; the Acceptance Criteria say what they must prove): `QuoteIssuanceIT`, `QuoteImmutabilityTest`.

**Scope — in**
- `Quote(quoteId, holdId, matchId, lines[seatId, tier, unit, discount, amount], total, currency, issuedAt, expiresAt)` — immutable record
- Issued inside `SeatAllocator` right after a successful hold; stored at
  `match:{m}:quote:<quoteId>` with the same TTL as the hold; `quoteId` written into the hold hash
- Returned in the 201 hold response; `GET /matches/{m}/quotes/{q}`
- Line order = seat order in the Run, so the group discount ladder is deterministic

**Acceptance Criteria**
- [ ] Every hold response contains a Quote whose total = sum of lines
- [ ] Changing the base price table after issuing does **not** change a stored Quote
- [ ] Quote expires with its Hold (404 after)
- [ ] Hold succeeded but Quote write failed → hold is released, request fails (no hold without a price)

**Concepts to learn:** ADR-0002 · storing an immutable value in Redis with a TTL tied to
another key's lifetime · compensating an earlier step when the next one fails (the
same idea the saga uses across services in Sprint 5).

---

## TKT-305 — `contracts` events + publishing hold lifecycle events

**Type:** Story · **Points:** 3 · **Branch:** `feature/TKT-305-hold-events`

**User story.** As other services (live map, demand pricing, ticketing), I learn when
seats are held, released or expire.

**Tests — write first** (run each red before building the scope below; the Acceptance Criteria say what they must prove): `HoldEventsIT` (Testcontainers Kafka + test consumer), `ContractsJsonTest`.

**Scope — in**
- **Infra:** add `kafka` (KRaft mode, no ZooKeeper, healthcheck, pinned image) and
  `kafka-ui` to `docker-compose.yml` — first ticket that needs them (RF-13)
- **`contracts` module:** a plain Maven module under the root POM — **not** from
  Initializr, because it must not depend on Spring (every service, and later a non-Spring
  consumer, can read it). You create its small POM; Claude reviews.
- **Dependencies for `inventory`** via start.spring.io → same settings → **Explore**:
  **Spring for Apache Kafka** (`spring-kafka`: `KafkaTemplate`, listener containers) and,
  with Testcontainers selected, the Kafka Testcontainers module. Copy only those entries.
- `contracts`: records `SeatHeld`, `HoldExpired`, `SeatReleased`, each with
  `schemaVersion`, `eventId` (UUID), `occurredAt`, `matchId`
- Kafka producer in `adapter/kafka` replacing the no-op `HoldEventPublisher`;
  key = `matchId`; JSON; `enable.idempotence=true`, `acks=all`
- Topics `seat.held`, `hold.expired`, `seat.released` created via `NewTopic` beans (3 partitions locally)
- Publish **after** the script succeeds; on publish failure log + metric, never fail the hold (best-effort, RF-14)

**Acceptance Criteria**
- [ ] Hold → one `seat.held` record keyed by matchId
- [ ] Expiry → exactly one `hold.expired` per expired hold (sweeper + release race included)
- [ ] Kafka down → holds still succeed; `events.publish.failed` counter increments
- [ ] JSON round-trip test for each record in `contracts`

**Concepts to learn:** Kafka partitions, keys and ordering · producer idempotence and
`acks` · at-most-once vs at-least-once vs effectively-once · `KafkaTemplate` and
`CompletableFuture` send results · why the outbox is not used here.

---

## Daily log

| Date | Done | Next | Blocked |
|---|---|---|---|

## Sprint Review

## Retrospective

| Keep | Change | Try |
|---|---|---|
