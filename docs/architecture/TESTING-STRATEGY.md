# Testing Strategy

Tests are part of every ticket's Acceptance Criteria — written alongside the code,
never after. A ticket without its tests is not Done.

## The pyramid for this project

| Level | What | Tools | Speed | Where |
|---|---|---|---|---|
| **Unit (pure)** | domain + pricing, no Spring | JUnit 5, AssertJ, `@ParameterizedTest` | ms | `src/test/java/.../domain`, `.../pricing` |
| **Property** | invariants over random inputs (Runs, Orphans, pricing bounds) | jqwik | < 1 s | same packages, `*Properties.java` |
| **Slice** | one layer with Spring (`@WebMvcTest`, `@DataJpaTest`) | Spring Boot Test, `@MockitoBean` | seconds | `adapter/web`, `adapter/persistence` |
| **Integration** | real Postgres/Redis/Kafka | Testcontainers + `@ServiceConnection`, Awaitility | 10–60 s | `*IT.java`, run by Failsafe |
| **Concurrency** | races on the arbiter | `ExecutorService` + `CountDownLatch` start gate | seconds | `*ConcurrencyIT.java` |
| **Contract** | event records stay compatible | JSON round-trip tests in `contracts` | ms | `contracts/src/test` |
| **Load** | the flash crowd | k6 | minutes | `load/` (TKT-804 smoke, TKT-1204 full) |

Naming: unit tests `*Test`, integration `*IT` (Surefire vs Failsafe), test methods
`should<Outcome>_when<Condition>`.

## Rules

- **Strict TDD:** the test is written and run **red** before the code it tests. A test
  that has never failed has not proven anything.
- Domain/pricing tests must run with **no Spring context** — if one needs Spring, the
  code is in the wrong package.
- One Testcontainers container per type per JVM (singleton pattern / reusable), or the
  suite gets slow fast.
- Never `Thread.sleep` to wait for async work — use Awaitility with a timeout.
- Concurrency tests release all threads at once with a `CountDownLatch`, then assert on
  the store, not on return values only.
- Every bug fixed gets a failing test first.

## The design's acceptance tests

| Property | Test | Ticket |
|---|---|---|
| Overselling backstop | second SOLD row for a seat rejected by the index; still rejected with Redis flushed | TKT-102, TKT-501 |
| Generator | exactly 5000 seats, 1000 VIP, every seat in one Block, idempotent | TKT-103 |
| Projection | flush → warmup restores exact state; warmup twice = same state | TKT-105 |
| Allocator correctness | 500 threads race for the same 4 seats → exactly one Hold, no seat double-held (repeat 100× in CI, 1000× nightly) | TKT-202 |
| Group atomicity | 4 seats requested, 4th taken → **zero** seats held | TKT-202 |
| Fan cap | 5th seat across live holds rejected | TKT-202 |
| Lazy expiry | hold with 1 s TTL → seats allocatable with sweeper disabled | TKT-204 |
| Sweep | expired hold released, counters correct, `hold.expired` emitted once | TKT-205, TKT-305 |
| Adjacency | every returned Run contiguous, length k, inside one Block; no Orphan when an orphan-free option existed | TKT-301, TKT-302 |
| Pricing | table tests importance × tier × demand × hoursToKickoff, floor, cap, discount ladder | TKT-303 |
| Quote immutability | changing price inputs after issue does not change the Quote | TKT-304 |
| Idempotency | 50 concurrent `POST /orders` with one key → one Order, one charge, 50 identical responses | TKT-503 |
| Saga | failure injected at each step → correct compensation, no charge without ticket | TKT-505 |
| QR | credential older than one window rejected; second scan is a Dispute naming the first gate | TKT-1101, TKT-1102 |
| End to end | k6 50k VUs at T-0 → p99 of admitted path, zero oversell, zero duplicate charge, Postgres pool never exhausted | TKT-1204 (smoke: TKT-804) |
