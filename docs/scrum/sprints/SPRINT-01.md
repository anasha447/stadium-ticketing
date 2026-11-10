# Sprint 1 — Walking Skeleton of the Seat Map

| | |
|---|---|
| **Sprint goal** | A Match has 5000 generated Seats in Postgres (1000 VIP, grouped into Blocks) and a Seat State projection in Redis, both readable over HTTP — with CI checking every PR. |
| **Why this goal** | It is the exact substrate the Lua allocator needs in Sprint 2. No holds yet, on purpose. |
| **Dates** | Wed Nov 11 – Tue Nov 24, 2026 |
| **Epics** | EP-1 Platform Foundation, EP-3 Core Booking |
| **Capacity** | 28 points — deliberately full. Unfinished work carries over as the first item of Sprint 2. |
| **Milestone** | M0 Foundation |

| Order | Ticket | Title | Type | Pts | Depends on |
|---|---|---|---|---|---|
| 0 | TKT-100 | Verify repository baseline | Chore | 0 | — |
| 1 | TKT-101 | Root POM + `inventory` from Initializr + Docker Compose | Story | 5 | TKT-100 |
| 2 | TKT-106 | CI on pull requests (GitHub Actions) | Chore | 2 | TKT-101 |
| 3 | TKT-102 | Seat Map, Block and Seat Claim schema + overselling backstop | Story | 5 | TKT-106 |
| 4 | TKT-103 | Seat Map Generator — 5000 seats, 1000 VIP, Blocks, idempotent | Story | 8 | TKT-102 |
| 5 | TKT-104 | Seat Map REST API + integration test | Story | 3 | TKT-103 |
| 6 | TKT-105 | Redis Seat State projection + atomic warmup + occupancy | Story | 5 | TKT-103 |

**Why CI moved to second place:** from TKT-102 on, every PR is checked by GitHub
Actions, so "it works on my machine" never reaches `main`.

**How each ticket is laid out:** *Tests — write first* comes before *Scope*. Write and
run those tests red before building what the scope describes.

**Sprint demo script (Review day):**
```bash
docker compose up -d
./mvnw -pl services/inventory spring-boot:run
curl -X POST localhost:8081/matches/1/seatmap                 # 201
curl -X POST localhost:8081/matches/1/seatmap                 # 409
curl localhost:8081/matches/1/seatmap | jq '.sections | length'   # 20
curl -X POST localhost:8081/admin/matches/1/warmup            # 204
curl localhost:8081/matches/1/occupancy                       # {"available":5000,"held":0,"sold":0}
```
Plus: open the merged PRs on GitHub and show the green CI checks.

---

## TKT-100 — Verify repository baseline

**Type:** Chore · **Points:** 0 · **Branch:** none (one-time, directly on `main`)

**Context.** The original plan found the project folder nested inside a home-directory
repository. Confirm the boundary once before anything is built.

**Acceptance Criteria**
- [ ] The repository's top-level folder is the project folder, not your home folder (you choose the git command; tell Claude what it printed)
- [ ] The GitHub remote is set and `main` is pushed
- [ ] `.gitignore` covers `target/`, `.idea/`, `*.iml`, `.vscode/`, `node_modules/`, `.env`, `*.log`
- [ ] `.gitattributes` normalises line endings to LF for text files, including `*.sh` and `*.lua` (you're on Windows; Lua and shell scripts break with CRLF)
- [ ] The docs from this planning session are committed and pushed (you write the message — `docs` type)

**Concepts:** repository boundaries · `.gitignore` precedence · `core.autocrlf` vs `.gitattributes` and why the file wins for a team.

---

## TKT-101 — Root POM + `inventory` from Initializr + Docker Compose

**Type:** Story (config-heavy) · **Points:** 5 · **Branch:** `feature/TKT-101-monorepo-skeleton`

**User story.** As a developer, I need a buildable multi-module project with its
infrastructure running locally, so every later ticket has a place to live.

**Context / why.** A root POM is both the **aggregator** (it lists the modules to build)
and the **parent** (it holds the Spring Boot version once). Services never drift apart.
Compose gives every ticket the same Postgres and Redis. Only what Sprint 1 uses is added
(RF-13): `catalog` arrives in TKT-401, Kafka in TKT-305.

### Step 1 — Generate `inventory` on start.spring.io

| Setting | Value |
|---|---|
| Project | Maven |
| Language | Java |
| Spring Boot | latest **4.1.x** (no SNAPSHOT, M or RC) |
| Group | `com.stadium` |
| Artifact | `inventory` |
| Package name | `com.stadium.inventory` |
| Packaging | Jar |
| Configuration | YAML |
| Java | 21 |

**Dependencies — select exactly these:**

| Initializr name | What it pulls in | Used from |
|---|---|---|
| **Spring Web** | Spring MVC + embedded Tomcat (`spring-boot-starter-webmvc` in Boot 4) | TKT-101 |
| **Spring Boot Actuator** | `/actuator/health`, metrics, health indicators for DB and Redis | TKT-101 |
| **Validation** | Hibernate Validator (Jakarta Bean Validation) | TKT-104 |
| **Spring Data JPA** | Hibernate, Spring Data repositories, **and** `spring-boot-starter-jdbc` (HikariCP + `JdbcTemplate`) | TKT-102 |
| **PostgreSQL Driver** | the JDBC driver (runtime scope) | TKT-101 |
| **Flyway Migration** | the Flyway starter; with PostgreSQL selected, also Flyway's Postgres module | TKT-102 |
| **Spring Data Redis (Access+Driver)** | Lettuce client, `RedisTemplate`, `StringRedisTemplate` | TKT-105 |
| **Testcontainers** | JUnit 5 Testcontainers + Postgres and Redis containers, and a generated `TestcontainersConfiguration` with `@ServiceConnection` beans | TKT-101 |

**Deliberately not selected (and why):**
- *JDBC API* — Spring Data JPA already brings it. Selecting both is a common beginner duplicate.
- *Docker Compose Support* — it starts Compose for you on `spring-boot:run`. Convenient,
  but it hides what is happening. We run Compose ourselves for now.
- *Spring for Apache Kafka* — added in TKT-305 through **Explore**.
- *Lombok* — decided in TKT-102. Records cover DTOs and value objects; add Lombok only
  if entity boilerplate becomes painful.

**Before you click Generate:** click **Explore** and read the POM. Find the parent,
each starter, the test-scoped dependencies Initializr added for you, and the
`spring-boot-maven-plugin`. Tell Claude one thing that surprised you.

### Step 2 — Turn it into a monorepo

What the end state looks like (you create it; Claude reviews):

```
<project root>/
  pom.xml               ← you write this: packaging pom, parent = Spring Boot parent 4.1.x,
                          <modules> lists services/inventory, java.version 21
  mvnw, mvnw.cmd, .mvn/ ← moved up from the generated project (one wrapper for all modules)
  docker-compose.yml
  services/inventory/   ← the generated project; its <parent> now points at the root POM
```

Things to work out yourself (Claude helps with hints, not files):
- What `<relativePath>` must the inventory POM use to find the root POM?
- Which elements stay in the inventory POM and which move up?
- Which generated files (`HELP.md`, `.gitignore`, the wrapper) are duplicates now?

### Step 3 — Docker Compose

Services: `postgres` (one server; an init script creates `inventory_db`; named volume)
and `redis-inventory` (AOF on, `appendfsync everysec`). Both have a **healthcheck**.
Pin image versions — no `latest`.

### Tests — write first

1. **Context test.** Initializr generated `InventoryApplicationTests` (with
   `@Import(TestcontainersConfiguration.class)`). Run it before changing anything and
   see it pass. Then break it on purpose (stop Docker) to see what a Testcontainers
   failure looks like. Restore Docker.
2. **🔴 `ActuatorHealthIT`** — `@SpringBootTest(webEnvironment = RANDOM_PORT)` with the
   Testcontainers configuration: `GET /actuator/health` returns `UP` **and** the JSON
   contains a `db` and a `redis` component. Run it → **red**, because health details
   are hidden by default. Make it green with configuration only.

### Acceptance Criteria
- [ ] `./mvnw clean verify` succeeds from the **root**
- [ ] The inventory POM declares **no versions** for Boot-managed dependencies
- [ ] `docker compose up -d` → both containers report `healthy`
- [ ] With Compose running, `inventory` started locally answers `GET localhost:8081/actuator/health` → `UP` with `db` and `redis`
- [ ] `ActuatorHealthIT` was seen red, now green
- [ ] With Postgres stopped, `inventory` fails at startup with a datasource error — observe it once, write what you saw in the learning notes
- [ ] The **Commands** section in `CLAUDE.md` is filled in

**Technical notes**
- Port 8081: `server.port` in `application.yml`.
- Health details: expose them only in a `local` profile and in tests, not in a default
  production config. Decide where each property belongs.
- `./mvnw spring-boot:test-run` starts the app with the Testcontainers configuration —
  a no-Compose way to run locally. Try it once.

**Concepts to learn:** aggregator vs parent POM · `<dependencyManagement>` vs
`<dependencies>` and how the Boot parent supplies versions · starters as curated
dependency sets · `@SpringBootApplication` = `@SpringBootConfiguration` +
`@EnableAutoConfiguration` + `@ComponentScan` · how auto-configuration decides
(`@ConditionalOnClass`, `@ConditionalOnMissingBean`, `@ConditionalOnProperty`) and why
Boot 4 split it per starter · how Boot builds a `DataSource` and a Lettuce connection
from properties · profiles and property precedence · Actuator health indicators and
aggregation · `@ServiceConnection` (how Testcontainers replaces your datasource URL
without any property) · Compose healthchecks vs `depends_on`.

**Commit checkpoints** (you write the messages)
1. Root POM + wrapper moved, `./mvnw verify` green
2. Generated `inventory` module wired under the root
3. Compose file with healthchecks
4. `ActuatorHealthIT` + the configuration that makes it green

---

## TKT-106 — CI on pull requests (GitHub Actions)

**Type:** Chore · **Points:** 2 · **Branch:** `chore/TKT-106-ci`

**Context / why.** CI is the "second reviewer" that never gets tired. From here on, a
PR with a red check is not reviewed.

### Tests — write first
Open this ticket's own PR with a test that is deliberately broken. Confirm CI goes
**red** on GitHub. Fix it, push, and confirm it goes **green**. That is the proof the
pipeline works.

### Acceptance Criteria
- [ ] `.github/workflows/ci.yml` runs `./mvnw -B verify` on every pull request and on push to `main`
- [ ] Java 21 (Temurin) set up in the workflow; Maven dependencies cached
- [ ] Testcontainers runs on the GitHub runner (Docker is available on `ubuntu-latest`)
- [ ] Surefire runs `*Test`, Failsafe runs `*IT` — both are part of `verify`
- [ ] The CI check is visible on the PR; a red run was observed before the green one
- [ ] `main` requires the CI check before merge. Branch protection needs a **public** repo
      on a free GitHub account (or GitHub Pro for private). A portfolio repo is usually
      public — decide and note it in the PR.

**Concepts:** workflow → job → steps · triggers (`pull_request` vs `push`) · caching ·
Surefire vs Failsafe lifecycle phases (`test` vs `integration-test`/`verify`) · why
Testcontainers needs Docker on the runner · status checks and branch protection.

**Commit checkpoints:** workflow file · Failsafe configured in the inventory POM (if missing).

---

## TKT-102 — Seat Map, Block and Seat Claim schema + overselling backstop

**Type:** Story · **Points:** 5 · **Branch:** `feature/TKT-102-seat-schema`

**User story.** As the system, I need Seats, Blocks and Seat Claims persisted with a
constraint that makes overselling impossible at the database level.

**Context / why.** Redis is the fast arbiter, but correctness must not depend on it
(ADR-0001). The partial unique index is the last line of defence. Blocks are modelled
now because adding them later means migrating 5000 rows per match and re-laying the
Redis bitmaps (RF-04, RF-05).

### Tests — write first
1. **🔴 `SeatClaimBackstopIT`** — `@DataJpaTest` + Testcontainers Postgres,
   `@AutoConfigureTestDatabase(replace = NONE)`:
   - Given a SOLD claim for seat X, when a second SOLD claim for X is saved and flushed,
     then a `DataIntegrityViolationException` is thrown
   - Given a CANCELLED claim for seat X, when a SOLD claim for X is saved, then it succeeds
   - Two SOLD claims for **different** seats of the same match both succeed

   First run → red (no tables). Then write the migration → the first case still red
   until the partial index exists. **See each step fail.**
2. **🔴 `SchemaValidationIT`** — context starts with `spring.jpa.hibernate.ddl-auto=validate`
   (entities must match the migration exactly).

### Scope — in
- `V1__seat_map.sql` exactly as DATA-MODEL.md §2: `seat_maps`, `blocks`, `seats`,
  `seat_claims`, index `uniq_sold_seat`, plus a SQL comment explaining why there is no
  `holds` table
- JPA entities in `adapter/persistence`: `SeatMapEntity`, `BlockEntity`, `SeatEntity`
  (`@EmbeddedId SeatKey(matchId, seatId)`), `SeatClaimEntity`
- Enums `Tier { STANDARD, VIP }`, `ClaimStatus { SOLD, CANCELLED }`
- Spring Data repositories for reads

### Scope — out
Generator logic, HTTP endpoints, Redis.

### Acceptance Criteria
- [ ] Flyway applies V1 on a clean database; `flyway_schema_history` shows version 1
- [ ] `ddl-auto=validate` passes
- [ ] The three backstop cases pass and were each seen red first
- [ ] No Lombok `@Data` on any entity; `equals`/`hashCode` based on the id only, or not overridden — justify in the PR

**Technical notes**
- Why not H2: it doesn't support Postgres partial indexes the same way. The test would
  pass for the wrong reason.
- Boot 4: Flyway runs only because the **Flyway starter** is on the classpath (ADR-0004).
  Confirm in the startup log that the migration ran.
- The entity is a persistence model, not the domain model. The domain `Seat` arrives in
  TKT-103 with no annotations.

**Concepts to learn:** `@Entity` and the persistence context (managed vs detached) ·
`@EmbeddedId` vs `@IdClass` · why an `@Embeddable` key needs `equals`/`hashCode` ·
`@Enumerated(EnumType.STRING)` and the `ORDINAL` trap · `@Column(nullable=false)` vs a DB
`NOT NULL` — which one actually protects data · `ddl-auto=validate` · Flyway versioning
and checksums (never edit an applied migration) · partial indexes · **flush timing**: why
the violation appears at flush or commit, not at `save()` · `@DataJpaTest`: which beans
it loads and why each test rolls back · Lombok + JPA traps if you chose Lombok.

**Commit checkpoints:** migration + backstop test green · entities + validate test green · repositories.

---

## TKT-103 — Seat Map Generator — 5000 seats, 1000 VIP, Blocks, idempotent

**Type:** Story · **Points:** 8 · **Branch:** `feature/TKT-103-seatmap-generator`

**User story.** As an Admin, when I generate the Seat Map for a Match, 5000 Seats are
created with 1000 VIP seats placed by stand geometry and grouped into Blocks, so the
Match is sellable.

**Context / why.** The layout logic is pure: given a stadium layout, produce blocks and
seats. With no Spring and no I/O it is testable in milliseconds. Persistence is a
separate, batched, idempotent step.

**Reference layout (adjust if you like — the totals are the AC):**

| Stand | Sections | Rows × seats per section | Tier |
|---|---|---|---|
| West (main) | W-S01 … W-S05 | 10 × 25 | W-S02, W-S03, W-S04 = **VIP** |
| East | E-S01 … E-S05 | 10 × 25 | E-S03 = **VIP** |
| North | N-S01 … N-S05 | 10 × 25 | STANDARD |
| South | S-S01 … S-S05 | 10 × 25 | STANDARD |

20 sections × 250 = **5000**; 4 VIP sections × 250 = **1000**.
Each 25-seat row has one aisle after seat 12 → Blocks of **12** and **13**.
IDs: seat `W-S03-R07-12`, block `W-S03-R07-B1`.

### Tests — write first (in this order, one red-green cycle each)
1. 🔴 `SeatMapGeneratorTest` (pure JUnit, **no Spring**):
   total = 5000 → VIP = 1000 → VIP only in the configured sections → every seat in
   exactly one Block → positions `0..length-1` with no gaps → no Block crosses an aisle →
   all ids unique → same layout gives identical output (deterministic).
   Use `@ParameterizedTest` over stands where it removes duplication.
2. 🔴 `SeatMapServiceIT` (Testcontainers): generate → 5000 rows; generate again →
   still 5000 rows and the result is `ALREADY_EXISTS`.
3. 🔴 Batching check: prove inserts are batched (Postgres statement log or a datasource
   proxy count). Write down the number you observed.

### Scope — in
- Pure, in `domain/`: `StadiumLayout`, `SeatMapGenerator.generate(MatchId, StadiumLayout) → GeneratedSeatMap(blocks, seats)`
- Layout loaded from `stadium-layout.yml` via `@ConfigurationProperties` (the teaching
  step weighs this against a Java constant)
- Application service `SeatMapService.generate(matchId)` — `@Transactional`
- Idempotency: insert the `seat_maps` header with `ON CONFLICT DO NOTHING`; 0 rows
  affected → already generated → return `ALREADY_EXISTS`, insert nothing else
- Batched inserts with `JdbcTemplate.batchUpdate` (batch size 500) and
  `reWriteBatchedInserts=true` on the JDBC URL

### Scope — out
HTTP (TKT-104), Redis (TKT-105), triggering from `catalog` (TKT-404).

### Acceptance Criteria
- [ ] Every generator test was seen red first, and passes now
- [ ] Generating twice leaves exactly 5000 rows and returns `ALREADY_EXISTS` the second time
- [ ] Inserts are batched — the observed statement count is noted in the PR
- [ ] No `org.springframework` import in `domain/`

**Concepts to learn:** pure domain vs application service — and how Spring still wires a
class with no annotations (`@Bean` in a configuration class) · `@Service` and
constructor injection (what the container does differently from field `@Autowired`) ·
`@Transactional`: the proxy, `REQUIRED` propagation, rollback only on unchecked
exceptions, why self-invocation silently skips it · `@ConfigurationProperties` binding
and validation at startup · `JdbcTemplate.batchUpdate` vs JPA `saveAll` (persistence
context cost, identity generation, statement count) · `reWriteBatchedInserts` — what the
Postgres driver rewrites · `ON CONFLICT DO NOTHING` as database-level idempotency.

**Commit checkpoints:** layout model + first generator tests · full generator · batched idempotent persistence + IT.

---

## TKT-104 — Seat Map REST API + integration test

**Type:** Story · **Points:** 3 · **Branch:** `feature/TKT-104-seatmap-api`

**User story.** As a Fan, I can fetch a Match's Seat Map so the stadium can be drawn;
as an Admin, I can trigger generation.

### Tests — write first
1. 🔴 `SeatMapControllerTest` (`@WebMvcTest`, service replaced with `@MockitoBean`):
   201 + `Location` on create · 409 `ProblemDetail` when it exists · 404 `ProblemDetail`
   for an unknown match · JSON shape of GET
2. 🔴 `SeatMapApiIT` (`@SpringBootTest(webEnvironment = RANDOM_PORT)` + Testcontainers):
   POST → GET round trip; 20 sections, 5000 seats in total

### Scope — in
- `POST /matches/{matchId}/seatmap` → 201 with `Location` · 409 if it already exists
- `GET /matches/{matchId}/seatmap` → `{ matchId, sections: [ { section, tier, rows: [ { row, blocks: [ { blockId, seats: [ { seatId, number, position } ] } ] } ] } ] }`
- DTO records in `adapter/web`, mapped from the domain, never from entities
- `@RestControllerAdvice` translating domain exceptions to `ProblemDetail`

### Scope — out
Seat **state** (TKT-105/TKT-204), authentication (TKT-604 — note the open Admin endpoint in the PR).

### Acceptance Criteria
- [ ] Both test classes seen red, now green
- [ ] No JPA entity type appears in any controller signature
- [ ] Errors are `application/problem+json`

**Technical notes (Boot 4):** `@MockitoBean` replaces `@MockBean`; `@WebMvcTest` lives in
`org.springframework.boot.webmvc.test.autoconfigure` and needs the
`spring-boot-starter-webmvc-test` dependency — check the POM; if it is missing, add it
through Initializr **Explore**. Jackson 3 serialises your DTOs (`tools.jackson` packages).

**Concepts to learn:** `@RestController` = `@Controller` + `@ResponseBody` — what the
`DispatcherServlet` does with the return value (message converters) · `@PathVariable`
binding and conversion · `ResponseEntity` and `Location` · DTOs vs entities (lazy-loading
leaks, API tied to the schema) · `@RestControllerAdvice` + `@ExceptionHandler` +
`ProblemDetail` (RFC 9457) · `@WebMvcTest` vs `@SpringBootTest` — which beans each loads
and why that matters for speed · `@MockitoBean` and how bean overriding works in the
test context cache · `RestTestClient` vs `TestRestTemplate`.

**Commit checkpoints:** controller slice tests + controller · advice + error tests · full-path IT.

---

## TKT-105 — Redis Seat State projection + atomic warmup + occupancy

**Type:** Story · **Points:** 5 · **Branch:** `feature/TKT-105-redis-projection`

**User story.** As the system, I need the Seat State in Redis, rebuildable from Postgres
at any time, so Sprint 2's atomic allocator has something to operate on.

**Context / why.** Redis is the fast arbiter; Postgres is the truth for sales. Warmup is
how Redis recovers from loss. It must be idempotent and must never expose a half-built map.

### Tests — write first
1. 🔴 `RedisKeysTest` (pure): every key builder output contains the literal `{<matchId>}` hash tag
2. 🔴 `SeatStateProjectorIT` (Testcontainers Postgres + Redis), one cycle each:
   - fresh match → 5000 fields all `A`, occupancy `{5000, 0, 0}`, all block bitmaps zero
   - 3 SOLD claims in Postgres → those seats `S`, their bits 1, occupancy `{4997, 0, 3}`
   - `FLUSHALL` → warmup → state identical to before (compare the full hash and bitmaps)
   - warmup twice → same state
3. 🔴 `OccupancyApiIT`: `GET /matches/{id}/occupancy` returns the counters; warmup endpoint 204, 404 without a Seat Map

### Scope — in
- Keys exactly as DATA-MODEL.md §1, **with the `match:{m}:` hash tag** (RF-02):
  `match:{m}:seats`, `match:{m}:block:<blockId>`, `match:{m}:occupancy`
- `SeatStateProjector.warmup(matchId)`: read seats + SOLD claims → write `A`/`S`, set
  bits for taken positions, set counters — into `…:staging` keys, then `RENAME` each (RF-17)
- Pipelined writes (`executePipelined`), not 5000 round trips
- `POST /admin/matches/{matchId}/warmup` → 204 · 404 if no Seat Map
- `GET /matches/{matchId}/occupancy` → `{available, held, sold}` from one `HGETALL`
- `StringRedisTemplate` for all keys (no Java serialisation)

### Scope — out
Holds and Lua (Sprint 2), warmup on application start.

### Acceptance Criteria
- [ ] All tests above seen red, now green
- [ ] No reader can observe a partially built map (staging + `RENAME`)
- [ ] Every key name contains the literal `{<matchId>}` hash tag

**Technical notes**
- Bit order: `SETBIT key position 1` — position = `position_in_block`.
- Why not warm up on boot: with 3 pods, all three rebuild the same map on every deploy
  and race each other. Warmup is an explicit, single operation.

**Concepts to learn:** what Spring Data Redis auto-configures (`LettuceConnectionFactory`,
templates) and why Lettuce is the default (Netty, one thread-safe shared connection) vs
Jedis (pooled) · `RedisTemplate` vs `StringRedisTemplate` and the JDK-serialiser trap
(unreadable `\xac\xed` keys) · hash vs bitmap vs zset, and why a bitmap for Run search ·
pipelining vs `MULTI/EXEC` vs Lua — what each guarantees (fewer round trips vs isolation
vs atomic logic) · `RENAME` atomicity and why hash tags make it legal in a cluster ·
`@ConfigurationProperties` vs `@Value` · `ApplicationRunner` / `@PostConstruct` and why
they're wrong for multi-pod warmup.

**Commit checkpoints:** key builders · projector + IT cycles · endpoints + API IT.

---

## Daily log

| Date | Done | Next | Blocked |
|---|---|---|---|
| | | | |

## Sprint Review

_Demo result, what was accepted, what returned to the backlog, velocity for ROADMAP._

## Retrospective

| Keep | Change | Try |
|---|---|---|
| | | |
