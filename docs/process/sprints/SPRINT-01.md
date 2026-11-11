# Sprint 1 — Walking Skeleton of the Seat Map

| | |
|---|---|
| **Sprint goal** | A Match has 5000 generated Seats in Postgres (1000 VIP, grouped into Blocks) and a Seat State projection in Redis, both readable over HTTP — with CI checking every PR. |
| **Dates** | Wed Nov 11 – Tue Nov 24, 2026 |
| **Capacity** | 26 points · **Milestone** M0 Foundation |

| Rank | Ticket | Issue | Title | Pts | Depends on |
|---|---|---|---|---|---|
| 0 | TKT-100 | — | Repository baseline ✅ | 0 | — |
| 1 | TKT-101 | — | Walking skeleton: root POM + `inventory` (Web, Actuator) | 3 | TKT-100 |
| 2 | TKT-102 | — | CI on every pull request | 2 | TKT-101 |
| 3 | TKT-103 | — | Postgres + Seat Map schema + overselling backstop | 5 | TKT-102 |
| 4 | TKT-104 | — | Seat Map Generator — 5000 seats, 1000 VIP, Blocks, idempotent | 8 | TKT-103 |
| 5 | TKT-105 | — | Seat Map REST API | 3 | TKT-104 |
| 6 | TKT-106 | — | Redis + Seat State projection + Warmup + Occupancy | 5 | TKT-104 |

The ticket bodies below are the source for the GitHub Issues. Once an issue exists, its
number goes in the **Issue** column and the issue becomes the place to edit the ticket.

**Sprint demo (Review day)**
```bash
docker compose up -d
./mvnw -pl services/inventory spring-boot:run
curl -X POST localhost:8081/matches/1/seatmap                     # 201
curl -X POST localhost:8081/matches/1/seatmap                     # 409
curl localhost:8081/matches/1/seatmap | jq '.sections | length'   # 20
curl -X POST localhost:8081/admin/matches/1/warmup                # 204
curl localhost:8081/matches/1/occupancy                           # {"available":5000,"held":0,"sold":0}
```
Plus: the merged PRs on GitHub with green CI checks.

---

## TKT-100 — Repository baseline ✅

Done 2026-11-10: first commit on `main`, root `.gitignore` and `.gitattributes` (LF),
planning docs pushed.

---

## TKT-101 — Walking skeleton: root POM + `inventory` (Web, Actuator)

**Goal** — A buildable multi-module Maven project containing the `inventory` service,
which starts and reports itself healthy. Every later ticket gets a home.

**Why** — A *walking skeleton* is the thinnest slice that runs end to end (build → start
→ answer a request) before any feature exists. The root POM holds the Spring Boot version
once, so five services can never drift apart.

**Acceptance criteria**
- Given a fresh clone, when `./mvnw clean verify` runs **from the root**, then the build
  succeeds and runs `inventory`'s tests.
- Given `inventory` is running locally, when a client calls `GET /actuator/health` on port
  8081, then it answers 200 with status `UP`.
- `inventory` inherits the Spring Boot version from the root POM; no Boot-managed
  dependency declares its own version.
- There is one Maven Wrapper, at the root.
- The **Commands** section of `CLAUDE.md` is filled in.

**Out of scope** — databases, Redis and Docker Compose (they arrive with TKT-103 and
TKT-106), CI (TKT-102).

**Learning focus** — aggregator vs parent POM · starters and `dependencyManagement` ·
what `@SpringBootApplication` really is · how auto-configuration decides · Actuator.

**Points** 3 · **Depends on** TKT-100

---

## TKT-102 — CI on every pull request

**Goal** — Every pull request and every push to `main` runs the full build and test suite
on GitHub, and `main` cannot receive a red change.

**Why** — CI is the reviewer that never gets tired: "works on my machine" never reaches
`main`. It is a pipeline check, not part of the TDD loop.

**Acceptance criteria**
- Given a pull request, when it is opened or updated, then a check runs `./mvnw -B verify`
  on Java 21 (Temurin) and reports its result on the PR.
- Given a pull request with a failing test, then the check is red — observed once on this
  ticket's own PR — and green again after the fix.
- Maven dependencies are cached between runs.
- `main` requires the check to pass before merging (branch protection; needs a public repo
  on a free account — decide and note it in the PR).

**Out of scope** — deployment; the nightly 1000× race run (Icebox).

**Learning focus** — workflow → job → steps · `pull_request` vs `push` triggers · caching ·
status checks and branch protection · why Testcontainers needs Docker on the runner.

**Points** 2 · **Depends on** TKT-101

---

## TKT-103 — Postgres + Seat Map schema + overselling backstop

**Goal** — Seat Maps, Blocks, Seats and Seat Claims are stored in Postgres, and the
database itself makes selling the same Seat twice impossible.

**Why** — Redis is the fast arbiter, but correctness must not depend on it (ADR-0001).
The partial unique index is the last line of defence. Blocks are modelled now because
adding them later means migrating every Seat.

**Acceptance criteria**
- Given `docker compose up -d`, then a Postgres container (pinned version) reports
  `healthy` and the inventory database exists.
- Given a clean database, when `inventory` starts, then Flyway applies the schema from
  DATA-MODEL §2 as version 1.
- Given a Seat already has a SOLD Seat Claim, when a second SOLD claim for the same Seat
  of the same Match is saved, then the database rejects it.
- Given a CANCELLED claim for a Seat, when a SOLD claim for that Seat is saved, then it
  is accepted.
- SOLD claims for different Seats of the same Match are all accepted.
- The JPA mapping matches the schema exactly (startup with schema validation passes).
- `/actuator/health` shows a `db` component `UP`; with Postgres stopped, `inventory` fails
  to start (observed once, noted in the learning notes).

**Out of scope** — generating Seats, HTTP endpoints, Redis.

**Learning focus** — Flyway in Boot 4 (the starter matters) · entities and the
persistence context · `@EmbeddedId` · `EnumType.STRING` · partial unique indexes · why the
violation appears at flush · `@DataJpaTest` + Testcontainers + `@ServiceConnection` ·
Compose healthchecks.

**Points** 5 · **Depends on** TKT-102

---

## TKT-104 — Seat Map Generator — 5000 seats, 1000 VIP, Blocks, idempotent

**Goal** — When an Admin generates the Seat Map of a Match, 5000 Seats are created —
1000 VIP, placed by stand — grouped into Blocks. Generating it again changes nothing.

**Why** — This is the substrate the atomic allocator needs in Sprint 2. The layout rules
are pure logic, testable in milliseconds; storing them is a separate, batched step.

**Acceptance criteria**
- Generating a Seat Map produces exactly 5000 Seats, of which exactly 1000 are VIP, and
  VIP Seats appear only in the sections configured as VIP.
- Every Seat belongs to exactly one Block; positions inside a Block run from 0 with no
  gaps; no Block crosses an aisle.
- Every Seat id and Block id is unique and follows the format `W-S03-R07-12` /
  `W-S03-R07-B1`.
- The same layout always produces the same Seat Map.
- Given a Seat Map already exists for a Match, when it is generated again, then nothing
  is inserted and the result says it already exists.
- Inserts are batched; the observed statement count is noted in the PR.
- The layout logic has no Spring or I/O imports.

**Reference layout** (totals are the requirement; adjust the rest if you like)

| Stand | Sections | Rows × seats | VIP sections |
|---|---|---|---|
| West | W-S01 … W-S05 | 10 × 25 | W-S02, W-S03, W-S04 |
| East | E-S01 … E-S05 | 10 × 25 | E-S03 |
| North | N-S01 … N-S05 | 10 × 25 | — |
| South | S-S01 … S-S05 | 10 × 25 | — |

Each 25-seat row has one aisle after seat 12 → Blocks of 12 and 13.

**Out of scope** — HTTP (TKT-105), Redis (TKT-106), triggering from `catalog` (TKT-404).

**Learning focus** — pure domain vs application service · `@ConfigurationProperties` ·
`@Transactional` and its proxy · `JdbcTemplate.batchUpdate` vs `saveAll` · what
`reWriteBatchedInserts` does · `ON CONFLICT DO NOTHING` as database-level idempotency.

**Points** 8 · **Depends on** TKT-103

---

## TKT-105 — Seat Map REST API

**Goal** — A Fan can fetch the Seat Map of a Match to draw the stadium; an Admin can
trigger its generation over HTTP.

**Why** — The first public contract of `inventory`; it also sets the error format
(`ProblemDetail`) every later endpoint follows.

**Acceptance criteria**
- `POST /matches/{matchId}/seatmap` → 201 with a `Location` header; a second call → 409
  as `application/problem+json`.
- `GET /matches/{matchId}/seatmap` → 200 with sections → rows → blocks → seats; a generated
  map has 20 sections and 5000 seats in total.
- `GET` for a Match with no Seat Map → 404 as `application/problem+json`.
- A non-numeric `matchId` → 400 as `application/problem+json`.
- No JPA entity type appears in the web layer.

**Out of scope** — Seat **state** (TKT-106 and Sprint 2); authentication (TKT-604) — note
the open Admin endpoint in the PR.

**Learning focus** — what the `DispatcherServlet` does with a return value · DTOs vs
entities · `@RestControllerAdvice` + `ProblemDetail` · `@WebMvcTest` vs `@SpringBootTest` ·
`@MockitoBean` (Boot 4) · Jackson 3.

**Points** 3 · **Depends on** TKT-104

---

## TKT-106 — Redis + Seat State projection + Warmup + Occupancy

**Goal** — The live Seat State of a Match lives in Redis, can be rebuilt from Postgres at
any time without exposing a half-built map, and its Occupancy is readable over HTTP.

**Why** — Redis is the fast arbiter Sprint 2 builds on; Postgres is the truth for sales.
Warmup is how Redis recovers from loss, so it must be repeatable and atomic to readers.

**Acceptance criteria**
- Given `docker compose up -d`, then `redis-inventory` (pinned version, AOF every second)
  reports `healthy`, and `/actuator/health` shows a `redis` component `UP`.
- Given a fresh Seat Map, when Warmup runs, then every Seat is available, Occupancy is
  `{available 5000, held 0, sold 0}` and every Block's taken-positions are empty.
- Given 3 SOLD Seat Claims, when Warmup runs, then those Seats are sold, their positions
  are taken, and Occupancy is `{4997, 0, 3}`.
- Given Redis was flushed, when Warmup runs, then the state is identical to before;
  running Warmup twice gives the same state.
- A reader never observes a partially built map.
- Every key name contains the Match hash tag `match:{<matchId>}:`.
- `POST /admin/matches/{matchId}/warmup` → 204, or 404 when there is no Seat Map;
  `GET /matches/{matchId}/occupancy` → the counters.

**Out of scope** — Holds and Lua (Sprint 2); Warmup on application start.

**Learning focus** — what Spring Data Redis auto-configures (Lettuce) · `StringRedisTemplate`
vs `RedisTemplate` and the serializer trap · hash vs bitmap · pipelining vs `MULTI` vs Lua ·
`RENAME` atomicity and hash tags · why Warmup on boot is wrong with several pods.

**Points** 5 · **Depends on** TKT-104

---

## Daily log

| Date | Done | Next | Blocked |
|---|---|---|---|
| | | | |

## Sprint Review

_Demo result, accepted / returned work, velocity for ROADMAP, the sprint's interview question._

## Retrospective

| Keep | Change | Try |
|---|---|---|
| | | |
