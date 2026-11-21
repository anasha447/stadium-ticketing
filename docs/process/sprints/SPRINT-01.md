# Sprint 1 — Walking Skeleton of the Seat Map

| | |
|---|---|
| **Sprint goal** | A Match has the frontend's stadium (120 Blocks, 60,560 Seats) in Postgres and its Seat States in Redis, both readable over HTTP — with CI checking every PR. |
| **Dates** | Wed Nov 11 – Tue Nov 24, 2026 |
| **Capacity** | 23 points · **Milestone** M0 Foundation |
| **Re-planned** | 2026-11-16 (issue #39): the stadium, the schema and the Redis layout follow the frontend (ADR-0007, ADR-0008). Unfinished tickets carry over to Sprint 2 at the Review. |

| Rank | Ticket | Issue | Title | Pts | Depends on |
|---|---|---|---|---|---|
| 0 | TKT-100 | — | Repository baseline ✅ | 0 | — |
| 1 | TKT-101 | — | Walking skeleton: root POM + `inventory` (Web, Actuator) ✅ | 3 | TKT-100 |
| 2 | TKT-102 | [#43](https://github.com/anasha447/stadium-ticketing/issues/43) | CI on every pull request ✅ | 2 | TKT-101 |
| 3 | TKT-103 | [#46](https://github.com/anasha447/stadium-ticketing/issues/46) | Postgres + Seat Map schema + overselling backstop | 5 | TKT-102 |
| 4 | TKT-104 | — | Seat Map Generator — 120 Blocks, 60,560 Seats, idempotent | 5 | TKT-103 |
| 5 | TKT-105 | — | Seat Map REST API | 3 | TKT-104 |
| 6 | TKT-106 | — | Redis Seat States + Warmup + Occupancy | 5 | TKT-104 |

The ticket bodies below are the source for the GitHub Issues. Once an issue exists, its
number goes in the **Issue** column and the issue becomes the place to edit the ticket.

**Sprint demo (Review day)**
```bash
docker compose up -d
./mvnw -pl services/inventory spring-boot:run
curl -X POST localhost:8081/matches/1/seatmap                     # 201
curl -X POST localhost:8081/matches/1/seatmap                     # 409
curl localhost:8081/matches/1/seatmap | jq '.blocks | length'     # 120
curl localhost:8081/matches/1/seatmap | jq '.seatCount'           # 60560
curl -X POST localhost:8081/admin/matches/1/warmup                # 204
curl localhost:8081/matches/1/occupancy | jq '{available,held,sold}'  # {"available":60560,"held":0,"sold":0}
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

## TKT-102 — CI on every pull request ✅

Done 2026-11-18 in PR [#44](https://github.com/anasha447/stadium-ticketing/pull/44): `.github/workflows/ci.yml` runs `./mvnw -B verify` on Java 21 for every PR and push to `main`; red seen once on purpose; Maven cache restored on later runs; repo made public and `main` protected by a ruleset requiring the `build` check.

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

**Goal** — Seat Maps, Blocks and Seat Claims are stored in Postgres, and the database
itself makes selling the same Seat twice impossible.

**Why** — Redis is the fast arbiter, but correctness must not depend on it (ADR-0001).
The partial unique index is the last line of defence. Postgres stores the layout, not
the Seats (ADR-0007): 120 Blocks per Match with their seats per Row, and one Seat Claim
per real sale. The whole inventory schema is designed in DATA-MODEL §2; this ticket
creates the three tables it tests.

**Acceptance criteria**
- Given `docker compose up -d`, then a Postgres container (pinned version) reports
  `healthy` and the inventory database exists.
- Given a clean database, when `inventory` starts, then Flyway applies `seat_maps`,
  `blocks` and `seat_claims` from DATA-MODEL §2 as version 1. There is no `seats` table.
- A Block's `level`, `side` and `tier` accept only the listed values; `row_seats` must
  have at least one Row and no Row of zero Seats.
- Given a Seat already has a SOLD Seat Claim, when a second SOLD claim for the same Seat
  of the same Match is saved, then the database rejects it.
- Given a CANCELLED claim for a Seat, when a SOLD claim for that Seat is saved, then it
  is accepted.
- SOLD claims for different Seats of the same Match are all accepted.
- A Seat Claim whose Seat id names another Block (`215-R07-12` on Block `214`), or a
  Block that does not exist, is rejected.
- The JPA mapping matches the schema exactly (startup with schema validation passes),
  including `row_seats` as an array.
- `/actuator/health` shows a `db` component `UP`; with Postgres stopped, `inventory` fails
  to start (observed once, noted in the learning notes).

**Out of scope** — generating the layout, HTTP endpoints, Redis, `match_tier_prices`
(TKT-703).

**Lesson story** — tell it as the problem Anas solved: "I first kept 5,000 Seats so the
site would be fast on my machine. The frontend needed 60,000. Creating a Seat when a Fan
books it would write Postgres on the hold path and race. So I stored the layout instead:
120 rows, and Postgres sees only the real sales." Measure it: rows and table size for
one Match, both ways.

**Learning focus** — Flyway in Boot 4 (the starter matters) · entities and the
persistence context · `@EmbeddedId` · `EnumType.STRING` · mapping a Postgres `INT[]` in
Hibernate 7 (check RESOURCES, not memory) · partial unique indexes and CHECK with a
regex · why the violation appears at flush · `@DataJpaTest` + Testcontainers +
`@ServiceConnection` · Compose healthchecks.

**Points** 5 · **Depends on** TKT-102

---

## TKT-104 — Seat Map Generator — 120 Blocks, 60,560 Seats, idempotent

**Goal** — When an Admin generates the Seat Map of a Match, the frontend's stadium is
stored: 120 Blocks on three Levels with their Tiers and seats per Row. Generating it
again changes nothing.

**Why** — This is the substrate the atomic arbiter needs in Sprint 2. The layout rules
are pure logic, testable in milliseconds; storing them is a separate step. The frontend
draws the bowl from `rowSeats`, so the backend must produce exactly the mock's stadium
(`frontend/stadium-site/lib/api/mock/seat-map.ts`).

**Acceptance criteria**
- Generating a Seat Map gives 120 Blocks, 40 per Level, numbered 101–140, 201–240,
  301–340, and 60,560 Seats in total (DATA-MODEL §2, *The stadium*).
- Each Level's Rows grow evenly from front to back: Lower 24 Rows of 18 → 24, Club 12 of
  22 → 25, Upper 28 of 22 → 30.
- Blocks go round the bowl 12 / 8 / 12 / 8 (west, north, east, south), and Tiers follow
  the table in DATA-MODEL §2: e.g. 206 is `CLUB_PREMIUM`, 101 is `VIP_2`, 117 is
  `STANDARD`, 301 is `VIP_2`.
- `SeatMap.contains(seatId)` is true for `214-R07-12` and false for `214-R13-01` (Club
  has 12 Rows), `101-R01-19` (front Row has 18), `999-R01-01` and badly formed ids.
- `SeatMap.offsetOf(seatId)` gives the Seat's place in its Block, Rows front to back:
  `101-R01-01` → 0, `101-R02-01` → 18.
- Each Block carries the default Base Price of its Tier from configuration
  (`stadium.tiers.<tier>.base-price`).
- The same layout always produces the same Seat Map.
- Given a Seat Map already exists for a Match, when it is generated again, then nothing
  is inserted and the result says it already exists.
- The 120 Blocks are inserted as one batch; the observed statement count is noted in the PR.
- The layout logic has no Spring or I/O imports.

**Out of scope** — HTTP (TKT-105), Redis (TKT-106), Price Overrides (TKT-703), triggering
from `catalog` (TKT-404).

**Learning focus** — pure domain vs application service · porting rules from another
codebase with the same examples as tests · `@ConfigurationProperties` and binding a map
of `BigDecimal` · `@Transactional` and its proxy · `JdbcTemplate.batchUpdate` vs
`saveAll` · `ON CONFLICT DO NOTHING` as database-level idempotency.

**Points** 5 · **Depends on** TKT-103

---

## TKT-105 — Seat Map REST API

**Goal** — A Fan can fetch the Seat Map of a Match to draw the stadium; an Admin can
trigger its generation over HTTP.

**Why** — The first public contract of `inventory`; it also sets the error format
(`ProblemDetail`) every later endpoint follows. The shape is the frontend's (D-5):
120 Blocks with `rowSeats`, not one object per Seat.

**Acceptance criteria**
- `POST /matches/{matchId}/seatmap` → 201 with a `Location` header; a second call → 409
  as `application/problem+json`.
- `GET /matches/{matchId}/seatmap` → 200 with `matchId`, `currency` (`EUR`),
  `seatCount` (60560) and 120 `blocks`, each with `id`, `level`, `position`, `side`,
  `tier`, `basePrice` (a string like `"180.00"`) and `rowSeats` (ARCHITECTURE §11).
- `GET` for a Match with no Seat Map → 404 `/problems/not-found`.
- A non-numeric `matchId` → 400 as `application/problem+json`.
- No JPA entity type appears in the web layer.

**Out of scope** — Seat **state** (TKT-106 and Sprint 2); authentication (TKT-604) — note
the open Admin endpoint in the PR.

**Learning focus** — what the `DispatcherServlet` does with a return value · DTOs vs
entities · `@RestControllerAdvice` + `ProblemDetail` · `@WebMvcTest` vs `@SpringBootTest` ·
`@MockitoBean` (Boot 4) · Jackson 3 and writing `BigDecimal` as a string.

**Points** 3 · **Depends on** TKT-104

---

## TKT-106 — Redis Seat States + Warmup + Occupancy

**Goal** — The live Seat States of a Match live in Redis, one string per Block, can be
rebuilt from Postgres at any time without exposing a half-built map, and Occupancy is
readable over HTTP for the Match and for each Block.

**Why** — Redis is the fast arbiter Sprint 2 builds on; Postgres is the truth for sales.
Warmup is how Redis recovers from loss, so it must be repeatable and atomic to readers.
Seat States are stored in the shape the API returns (ADR-0008), so reading the whole
stadium is a copy, not a build.

**Acceptance criteria**
- Given `docker compose up -d`, then `redis-inventory` (pinned version, AOF every second)
  reports `healthy`, and `/actuator/health` shows a `redis` component `UP`.
- Given a fresh Seat Map, when Warmup runs, then each of the 120 Blocks has a string of
  `A`s as long as its Seats (504 for Block 101), and Occupancy is
  `{available 60560, held 0, sold 0}`, with each Block's counters matching its string.
- Given 3 SOLD Seat Claims, when Warmup runs, then exactly those characters are `S`, and
  Occupancy is `{60557, 0, 3}` with the right Block counters.
- Given Redis was flushed, when Warmup runs, then the state is identical to before;
  running Warmup twice gives the same state.
- A reader never observes a partially built map: all 121 staging keys are renamed in one
  `MULTI`/`EXEC`.
- Every key name contains the Match hash tag `match:{<matchId>}:`.
- `POST /admin/matches/{matchId}/warmup` → 204, or 404 when there is no Seat Map;
  `GET /matches/{matchId}/occupancy` → the counters, with `blocks` per Block.

**Out of scope** — Holds and Lua (Sprint 2); `GET seat-states` (TKT-203); Warmup on
application start.

**Learning focus** — what Spring Data Redis auto-configures (Lettuce) · `StringRedisTemplate`
vs `RedisTemplate` and the serializer trap · string vs hash vs bitmap for one Block ·
pipelining vs `MULTI` vs Lua · why `MULTI` is atomic here only because every key shares
one hash slot · reading Seat Claims in batches · why Warmup on boot is wrong with
several pods.

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
