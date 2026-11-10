# Sprint 2 — Atomic Holds

| | |
|---|---|
| **Sprint goal** | A Fan can hold up to 4 explicit seats atomically; a race of 500 threads yields exactly one winner; abandoned holds free themselves through TTL, with the sweeper making it visible within ~1 s. |
| **Epics** | EP-3 Core Booking |
| **Capacity** | 24 points |
| **Dates** | Nov 25 – Dec 8, 2026 |
| **Status** | Detailed — confirm at Sprint 2 Planning (add any Sprint 1 carry-over first) |
| **Decision point** | Sprint Review sets the M2 date: velocity ≥ 26 → Feb 23, ~24 → Mar 2 (ROADMAP) |

| Order | Ticket | Title | Type | Pts | Depends on |
|---|---|---|---|---|---|
| 1 | TKT-201 | Seat State machine + Hold aggregate (pure domain) | Story | 3 | TKT-105 |
| 2 | TKT-202 | `hold_seats.lua` + `SeatStateStore` port + Redis adapter + race tests | Story | 8 | TKT-201 |
| 3 | TKT-203 | Hold API: create, get, release, 4-seat cap | Story | 5 | TKT-202, TKT-204 |
| 4 | TKT-204 | `release_hold.lua` + lazy-expiry read path | Story | 3 | TKT-202 |
| 5 | TKT-205 | Hold Expiry Sweeper (ZSET + ShedLock) | Story | 5 | TKT-204 |

Order note: build TKT-204 before TKT-203 so the API ships with release from day one.

**Sprint demo script**
```bash
# hold, conflict, release, expiry
curl -X POST localhost:8081/matches/1/holds -H 'X-Fan-Id: 1' -H 'Content-Type: application/json' \
     -d '{"mode":"EXPLICIT","seatIds":["W-S03-R07-01","W-S03-R07-02"]}'      # 201
# same seats, other fan → 409 with conflictingSeatIds
# DELETE /matches/1/holds/{id} → 204; occupancy back to 5000/0/0
# start the race test: ./mvnw -pl services/inventory verify -Dit.test=HoldRaceIT
```

---

## TKT-201 — Seat State machine + Hold aggregate (pure domain)

**Type:** Story · **Points:** 3 · **Branch:** `feature/TKT-201-seat-state-hold`

**User story.** As the system, I need the rules of Seat State and Hold expressed in pure
code, so every adapter enforces the same rules and they can be tested in milliseconds.

**Context / why.** "The domain expresses the rules; Lua enforces them." The Java model is
the readable specification; the Lua script is its atomic implementation. Tests here
become the checklist the Lua tests must match.

**Tests — write first** (run each red before building the scope below; the Acceptance Criteria say what they must prove): `SeatStateTest` (`@ParameterizedTest` + `@MethodSource` over all pairs), `HoldTest`.

**Scope — in**
- `SeatState { AVAILABLE, HELD, SOLD }` + one transition table:
  `AVAILABLE→HELD` (hold), `HELD→AVAILABLE` (release/expire), `HELD→SOLD` (confirm),
  `SOLD→AVAILABLE` (cancel/recycle). Everything else is illegal.
- Value objects as records: `MatchId`, `SeatId`, `FanId`, `HoldId` (UUID)
- `Hold` record: `holdId, matchId, fanId, seatIds, createdAt, expiresAt`, compact constructor
  enforcing: 1 ≤ seats ≤ 4, no duplicates, `expiresAt > createdAt`
- `HoldResult` as a sealed interface: `Acquired(Hold)` | `Conflict(Set<SeatId>)` | `CapExceeded(int current)`

**Scope — out:** Redis, Spring, HTTP.

**Acceptance Criteria**
- [ ] Every legal transition allowed, every illegal one rejected — tested exhaustively (3 × 3 matrix)
- [ ] `Hold` with 0, 5 or duplicate seats cannot be constructed
- [ ] No import from `org.springframework` or `jakarta.persistence` in `domain/`
- [ ] Callers handle `HoldResult` with an exhaustive `switch` (no `default` branch)

**Concepts to learn:** why the domain carries no Spring or JPA annotations, and how
adapters translate to and from it · how this transition table becomes the **spec** the
Lua script in TKT-202 must satisfy (same rules, enforced atomically in another process) ·
result types vs exceptions at the HTTP boundary — how `@RestControllerAdvice` will map
each `HoldResult` case.

---

## TKT-202 — `hold_seats.lua` + `SeatStateStore` port + Redis adapter + race tests

**Type:** Story · **Points:** 8 · **Branch:** `feature/TKT-202-lua-hold`

**User story.** As a Fan, when I hold up to 4 seats, I get all of them or none, even if
thousands of others are trying at the same moment.

**Context / why.** This is the heart of the platform (ADR-0001). One Lua script checks
and flips every seat inside Redis's single thread — no interleaving is possible.

**Tests — write first** (run each red before building the scope below; the Acceptance Criteria say what they must prove): `HoldSeatsLuaIT`, `HoldRaceIT` (Testcontainers Redis, shared container).

**Scope — in**
- Port in `application/`: `SeatStateStore.hold(HoldRequest) → HoldResult`
- `adapter/redis/RedisSeatStateStore` implementing it with `DefaultRedisScript<List>`
  loaded once (EVALSHA with automatic fallback)
- `resources/lua/hold_seats.lua` per the contract in DATA-MODEL.md §1:
  1. Clean the Fan's holds set: remove holdIds whose hold key no longer `EXISTS`
  2. Count seats in the Fan's live holds; if `current + requested > 4` → `{-1, "CAP", current}`
  3. For each requested seat: value `A`, or `H:<x>` with no live hold key → free; otherwise conflict
  4. Any conflict → return `{0, conflicts…}` and change **nothing**
  5. Else: set each seat `H:<holdId>`, `SETBIT` its block position to 1, write the hold
     hash, `PEXPIRE` it, `ZADD` expiring, `SADD` fan holds, `HINCRBY` occupancy available −n / held +n → `{1}`
- Adapter computes all key names (with hash tag) and passes them in `KEYS[]`

**Note on `matches:active`:** it has no hash tag, so it cannot be touched inside the
script in a cluster. The adapter `SADD`s it **after** a successful script call. Losing
that write only delays the sweep — lazy expiry still guarantees correctness.

**Acceptance Criteria**
- [ ] Hold of 4 free seats → all 4 become `H:<holdId>`, bits set, occupancy `{4996, 4, 0}`
- [ ] **Group atomicity:** 4 requested, 4th already held → `Conflict({4th})` and **zero** seats changed
- [ ] **Race:** 500 threads, released together by a `CountDownLatch`, request the same 4 seats → exactly 1 `Acquired`, 499 `Conflict`; every seat holds the winner's id; repeated 100× (`@RepeatedTest`)
- [ ] **Cap:** a Fan with a live 3-seat hold requesting 2 more → `CapExceeded(3)`
- [ ] A seat whose hold key has expired (TTL elapsed, not swept) is holdable
- [ ] The script never builds a key; every key name passes the hash-tag check

**Technical notes**
- Use `nowMs` from ARGV, not `TIME` inside the script: deterministic, testable.
- Keep the script < 60 lines. If it grows, the logic belongs in Java.
- Lua arrays are 1-based; `redis.call` raises, `redis.pcall` returns errors — use `call`.

**Concepts to learn:** why Redis is single-threaded for commands and what that buys ·
Lua atomicity guarantees and limits (no long scripts — they block everyone) ·
`EVAL` vs `EVALSHA`, script caching · hash slots and `CROSSSLOT` · ports & adapters
(why the port lives in `application/`) · a concurrency test harness (`CountDownLatch` start gate — brief, it is test tooling) and
why a `synchronized` block in Java could never protect this: the race is across JVMs · `@RepeatedTest` · Testcontainers singleton containers.

---

## TKT-203 — Hold API: create, get, release, 4-seat cap

**Type:** Story · **Points:** 5 · **Branch:** `feature/TKT-203-hold-api`

**User story.** As a Fan, I can hold seats I picked on the map, see my hold's remaining
time, and release it.

**Tests — write first** (run each red before building the scope below; the Acceptance Criteria say what they must prove): `HoldControllerTest` (`@WebMvcTest`), `HoldApiIT` (full path with Testcontainers).

**Scope — in**
- `SeatAllocator` (application service): `hold(matchId, seatIds, fanId)`, `release(matchId, holdId, fanId)`, `get(matchId, holdId)`
- `POST /matches/{m}/holds` `{ "mode": "EXPLICIT", "seatIds": [...] }` → 201 Hold
  (Quote added in TKT-304)
- `GET /matches/{m}/holds/{h}` → hold + `remainingSeconds` (from `PTTL`)
- `DELETE /matches/{m}/holds/{h}` → 204 (owner only)
- Validation: `@NotEmpty`, `@Size(max = 4)`, seat ids exist in the Seat Map
- Caller identity from temporary `X-Fan-Id` header (replaced by JWT in TKT-604)
- Hold TTL from configuration (`inventory.hold.ttl=PT8M`)

**Acceptance Criteria**
- [ ] 201 with `holdId`, `seatIds`, `expiresAt`
- [ ] 409 `ProblemDetail` with `conflictingSeatIds`
- [ ] 422 for > 4 seats, duplicates, or unknown seat ids; 422 with `currentSeats` when the Fan cap is hit
- [ ] DELETE by a different Fan → 404 (don't reveal the hold exists); by owner → 204, seats back to `A`
- [ ] GET of an expired hold → 404

**Concepts to learn:** Bean Validation (`@Valid`, constraint annotations, where
validation runs) · `@RequestHeader` · mapping sealed results to HTTP status ·
`Duration` binding in `@ConfigurationProperties` · 404 vs 403 for authorization leaks.

---

## TKT-204 — `release_hold.lua` + lazy-expiry read path

**Type:** Story · **Points:** 3 · **Branch:** `feature/TKT-204-release-lazy-expiry`

**User story.** As a Fan, seats from an abandoned hold become available the moment the
hold expires, even if no background job has run yet.

**Tests — write first** (run each red before building the scope below; the Acceptance Criteria say what they must prove): `ReleaseHoldLuaIT`, `LazyExpiryIT` (Awaitility, no `Thread.sleep`).

**Scope — in**
- `release_hold.lua`: flips only seats whose value is **exactly** `H:<holdId>` back to
  `A`, clears their bits, adjusts counters by the number actually flipped, `ZREM`, `SREM`,
  `DEL` hold key. Returns `{1}` or `{0}` if nothing was flipped. Safe to call twice.
- `GET /matches/{m}/seat-states` → `{ seatId: "AVAILABLE"|"HELD"|"SOLD" }`, resolving
  `H:<x>` with no live hold key to `AVAILABLE` (one `HGETALL` + one pipelined `EXISTS` per distinct holdId)

**Acceptance Criteria**
- [ ] Release flips the hold's seats and nothing else (a seat re-held by someone else is untouched)
- [ ] Calling release twice: second call returns `{0}`, counters unchanged
- [ ] **Lazy expiry:** TTL 1 s, sweeper disabled → after expiry, seat-states shows `AVAILABLE` and a new hold succeeds

**Concepts to learn:** idempotency as a design property · compare-and-set semantics ·
why keyspace notifications are not reliable · Awaitility.

---

## TKT-205 — Hold Expiry Sweeper (ZSET + ShedLock)

**Type:** Story · **Points:** 5 · **Branch:** `feature/TKT-205-expiry-sweeper`

**User story.** As a Fan watching the map, seats from expired holds turn available within
about a second, and occupancy counters are right.

**Context / why.** Lazy expiry is correctness; the sweeper is UX and counter accuracy (RF-16).
Only one pod may sweep at a time.

**Tests — write first** (run each red before building the scope below; the Acceptance Criteria say what they must prove): `HoldExpirySweeperIT` (Awaitility), `SweeperSingleLeaderIT` (two contexts or two sweeper beans sharing the lock).

**Scope — in**
- `expiry/HoldExpirySweeper`: `@Scheduled(fixedDelay = 1000)`, guarded by
  `@SchedulerLock` (ShedLock, **Redis** lock provider on `redis-inventory`)
- For each match in `matches:active`: `ZRANGEBYSCORE expiring -inf now LIMIT 0 100`
  → `release_hold` per holdId with reason `EXPIRED`; `SREM matches:active` when the zset is empty
- `HoldEventPublisher` port with a **no-op** adapter for now (TKT-305 makes it Kafka)
- Micrometer counter `holds.expired.total` and timer for each sweep

**Acceptance Criteria**
- [ ] Expired hold is released within 2 s; occupancy back to the pre-hold value
- [ ] A hold released by the Fan before expiry is not double-counted by the sweeper
- [ ] Two app instances in one test → each expired hold released exactly once
- [ ] Sweeper failure for one match does not stop other matches

**Concepts to learn:** `@EnableScheduling` + `@Scheduled` (`fixedDelay` vs `fixedRate`
vs `cron`), the scheduler thread pool · ShedLock: what `lockAtMostFor` /
`lockAtLeastFor` protect against · why not keyspace notifications · Micrometer
counters/timers · bounded batches (`LIMIT`) to keep each tick short.

---

## Daily log

| Date | Done | Next | Blocked |
|---|---|---|---|

## Sprint Review

## Retrospective

| Keep | Change | Try |
|---|---|---|
