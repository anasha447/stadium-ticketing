# Sprint 2 — Atomic Holds

| | |
|---|---|
| **Sprint goal** | A Fan can hold up to 4 explicit Seats atomically; a race of 500 threads yields exactly one winner; abandoned Holds free themselves through expiry, with the sweeper making it visible within ~1 s. |
| **Dates** | Nov 25 – Dec 8, 2026 |
| **Capacity** | 24 points · **Decision point** Sprint Review sets the M2 date (ROADMAP) |
| **Status** | Detailed — refine with `/grill-with-docs` at Sprint 2 Planning (add Sprint 1 carry-over first) |

| Rank | Ticket | Issue | Title | Pts | Depends on |
|---|---|---|---|---|---|
| 1 | TKT-201 | — | Seat State rules + Hold (pure domain) | 3 | TKT-106 |
| 2 | TKT-202 | — | Atomic hold in Redis (Lua) + race tests | 8 | TKT-201 |
| 3 | TKT-203 | — | Release + lazy expiry | 3 | TKT-202 |
| 4 | TKT-204 | — | Hold API: create, get, release, 4-seat cap | 5 | TKT-202, TKT-203 |
| 5 | TKT-205 | — | Hold expiry sweeper (one pod at a time) | 5 | TKT-203 |

**Sprint demo**
```bash
curl -X POST localhost:8081/matches/1/holds -H 'X-Fan-Id: 1' -H 'Content-Type: application/json' \
     -d '{"mode":"EXPLICIT","seatIds":["214-R07-01","214-R07-02"]}'          # 201
# same seats, other Fan → 409 with conflictingSeatIds
# DELETE /matches/1/holds/{id} → 204; occupancy back to 60560/0/0
curl 'localhost:8081/matches/1/seat-states?blocks=214' | jq -r '.blocks["214"][0:30]'
./mvnw -pl services/inventory verify -Dit.test=HoldRaceIT                  # the race test
```

---

## TKT-201 — Seat State rules + Hold (pure domain)

**Goal** — The rules of Seat State and Hold are expressed in pure code, so every adapter
enforces the same rules and they are tested in milliseconds.

**Why** — "The domain states the rules; Lua enforces them atomically." These tests become
the checklist the Lua script in TKT-202 must satisfy.

**Acceptance criteria**
- Allowed transitions: available → held, held → available, held → sold, sold → available.
  Every other transition is rejected — all 9 pairs are checked.
- A Hold has 1–4 distinct Seats and expires after it was made; anything else cannot be created.
- The outcome of a hold attempt is exactly one of: *acquired* (the Hold), *conflict*
  (which Seats), *cap exceeded* (how many Seats the Fan already holds) — and callers are
  forced by the compiler to handle all three.
- No Spring or JPA import in `domain/`.

**Out of scope** — Redis, Spring, HTTP.

**Learning focus** — why the domain carries no framework annotations · result types vs
exceptions · the transition table as a spec for code in another process (Lua).

**Points** 3 · **Depends on** TKT-106

---

## TKT-202 — Atomic hold in Redis (Lua) + race tests

**Goal** — When a Fan holds up to 4 Seats, they get all of them or none, even while
thousands of others try at the same moment.

**Why** — The heart of the platform (ADR-0001): one Lua script checks and changes every
Seat inside Redis's single command thread, so no interleaving is possible.

**Acceptance criteria**
- Given 4 free Seats, when they are held, then all 4 belong to the new Hold, their
  characters in the Block strings are `H`, and Occupancy is `{60556, 4, 0}` with the
  Block's counters moved too.
- Given the 4th requested Seat is already held, then the result is a conflict naming it
  and **no** Seat changes.
- Given 500 concurrent requests for the same 4 Seats, then exactly one is acquired and 499
  are conflicts, and every Seat names the winner's Hold — repeated 100 times.
- Given a Fan with a live 3-seat Hold, when they ask for 2 more, then the cap is exceeded
  with current count 3.
- A Seat whose Hold has expired but was not yet cleaned up can be held (lazy expiry
  through `ZSCORE` on `holds:expiring`, DATA-MODEL §1).
- An unknown Seat id never reaches the script: `SeatMap.contains` rejects it first, and
  Java passes each Seat's offset.
- The script never builds key names; every key carries the Match hash tag.

**Notes** — Called directly from an adapter class: no port (ADR-0005). Time comes from
the caller (testable), and the script stays under ~60 lines; anything bigger belongs in Java.

**Out of scope** — release (TKT-203), HTTP (TKT-204), adjacent-seat search (Sprint 3).

**Learning focus** — why Redis runs commands on one thread · Lua atomicity and its limits ·
`EVAL` vs `EVALSHA` · hash slots and `CROSSSLOT` · why `synchronized` can't protect a race
across JVMs · a concurrency test harness (start gate) · Testcontainers singleton containers.

**Points** 8 · **Depends on** TKT-201

---

## TKT-203 — Release + lazy expiry

**Goal** — A Fan can release a Hold, and Seats of an abandoned Hold are available the
moment it expires — even if no background job has run.

**Why** — Expiry is the clock of record: correctness must not wait for a sweeper.

**Acceptance criteria**
- Releasing a Hold frees exactly its own Seats; a Seat meanwhile held by someone else is untouched.
- Releasing the same Hold twice: the second call changes nothing, counters unchanged.
- Given a Hold that lives 1 s and no sweeper, when it expires, then its Seats show as
  available and can be held again.
- `GET /matches/{matchId}/seat-states` returns one `A`/`H`/`S` string per Block, read
  with one `MGET`; `?blocks=101,102` returns only those Blocks. The read does not apply
  lazy expiry: an expired Seat shows `H` until the sweeper frees it (ADR-0008).

**Out of scope** — the sweeper (TKT-205), the hold endpoints (TKT-204).

**Learning focus** — idempotency as a design property · compare-and-set · why keyspace
notifications are not reliable · waiting in tests with Awaitility.

**Points** 3 · **Depends on** TKT-202

---

## TKT-204 — Hold API: create, get, release, 4-seat cap

**Goal** — A Fan can hold Seats picked on the map, see how long the Hold has left, and release it.

**Acceptance criteria**
- `POST /matches/{m}/holds` with explicit Seats → 201 with `holdId`, `seatIds`, `expiresAt`.
- Seats taken → 409 `/problems/seats-unavailable` with `conflictingSeatIds`.
- More than 4 Seats, duplicates or unknown Seat ids → 422 `/problems/invalid-hold`; cap
  exceeded → 422 `/problems/purchase-limit` with `currentSeats`.
- `GET` of one's own Hold → the Hold with `expiresAt`; of an expired Hold → 404
  `/problems/hold-expired`.
- The cap counts live Holds only. Bought Tickets count towards four only once the
  Purchase Limit ledger exists (TKT-1003); until then the frontend stops it.
- `DELETE` by another Fan → 404 (do not reveal the Hold exists); by the owner → 204 and
  the Seats are available.
- The Fan comes from a temporary `X-Fan-Id` header (replaced by JWT in TKT-604); the Hold
  lifetime is configurable (default 8 minutes).

**Out of scope** — adjacent mode (TKT-302), Quote (TKT-304).

**Learning focus** — Bean Validation and where it runs · `@RequestHeader` · mapping result
types to HTTP status · `Duration` binding · 404 vs 403 as an information leak.

**Points** 5 · **Depends on** TKT-202, TKT-203

---

## TKT-205 — Hold expiry sweeper (one pod at a time)

**Goal** — Seats from expired Holds turn available on everyone's map within about a
second, and Occupancy counters are right.

**Why** — Lazy expiry gives correctness; the sweeper gives UX and accurate counters. With
several pods, only one may sweep at a time.

**Acceptance criteria**
- An expired Hold is released within 2 s and Occupancy returns to its pre-hold value.
- A Hold the Fan released before expiry is not counted twice.
- With two application instances, each expired Hold is released exactly once.
- A failure on one Match does not stop the sweep of other Matches.
- Metrics: a counter of expired Holds and a timer per sweep.

**Notes** — Hold events go through a publisher with a no-op adapter until TKT-305 (two
adapters → a real port, ADR-0005).

**Out of scope** — publishing to Kafka (TKT-305).

**Learning focus** — `@Scheduled` (`fixedDelay` vs `fixedRate`) and the scheduler thread ·
ShedLock (`lockAtMostFor` / `lockAtLeastFor`) · Micrometer counters and timers · bounded
batches per tick.

**Points** 5 · **Depends on** TKT-203

---

## Daily log

| Date | Done | Next | Blocked |
|---|---|---|---|
| | | | |

## Sprint Review

## Retrospective

| Keep | Change | Try |
|---|---|---|
| | | |
