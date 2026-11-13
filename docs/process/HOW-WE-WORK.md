# How We Work

One file for the whole way of working: the Scrum frame, the ticket loop (how Claude
teaches and how Anas builds), testing, git, review, and which skill is used when.

**Roles.** Anas is Developer and Product Owner and **writes all the code**. Claude is
Scrum Master, mentor and reviewer: it writes the lesson pages, reviews, corrects, and
says when and what to commit, but never hands over a finished class, a whole `pom.xml`
or git commands to copy.

---

## 1. The ticket loop

```
 REFINE ─▶ KICKOFF + LESSON ─▶ BUILD (slice by slice) ─▶ REVIEW + PR ─▶ CLOSE + NOTES ─▶ MERGE
 /grill    Claude writes the     Anas: test → red →      /code-review,   Claude adds the   Anas
 -with-    lesson page; Anas     code → green; Claude    refactor, PR,   wrap-up to the    merges,
 docs      reads it and tries    checks, says "commit    CI, Claude      page; Anas pastes deletes
           first                 now: <what>"            approves        the note          branch
```

### Phase 1 — Refine (before the ticket is Ready)

- At Sprint Planning or mid-sprint refinement, run **`/grill-with-docs`** on the next
  tickets. It sharpens the goal and acceptance criteria and updates `GLOSSARY.md` and
  ADRs as decisions are made.
- The ticket ends as a **GitHub Issue** in the lean format (§3). That is the Definition
  of Ready.

### Phase 2 — Kickoff + lesson (Claude, then Anas)

Anas says: **"Start TKT-###."** Claude then:

1. Reads the issue, the docs it touches and the **learning records**
   (`docs/learning/records/`) to pitch the lesson at the right level — no re-teaching what
   Anas has proven, extra care where a misconception was corrected.
2. Agrees the **seams** with Anas in one short message (`tdd` skill): the public
   interfaces we will test, each with a line on what it catches and what it misses.
   `codebase-design` decides where a module and its interface go.
3. Checks the facts against `docs/learning/RESOURCES.md` (official docs first — never
   memory alone, especially for Boot 4.1), then writes the **lesson** in
   `docs/learning/lessons/TKT-###.md` and rebuilds the site
   (`node docs/learning/build.mjs`). The lesson has a fixed shape:

   | Section | What it holds |
   |---|---|
   | front matter `source:` | the **one primary source** to read for this ticket (shown at the top of the page) |
   | **The story** | the ticket in plain words, where it sits in the system, what "done" looks like |
   | **Ways to build it** | 2–3 real options with their trade-offs |
   | **What we chose and why** | the choice, the rejected options, and when they *would* win |
   | **Under the hood** | **at most 4** new annotations, APIs or concepts: what it is, what Spring / Redis / Kafka does behind the scenes, defaults that bite, the trap, the Boot 4 difference — each ending with a **Source:** link |
   | **Your mission** | the vertical slices in order — for each: the behaviour, the seam, the test idea (Given/When/Then), what "red" should look like |
   | **Hints** | per slice, collapsed, climbing the hint ladder (§1.1) — never the full solution |
   | **Check yourself** | 3–5 ` ```quiz ` questions with instant feedback (format below) |

   **Short lessons:** one tangible win each. If a ticket needs more than 4 new concepts
   (typically an 8-point ticket), it gets **one lesson per slice**:
   `TKT-104-1.md`, `TKT-104-2.md`, … each with `ticket: TKT-104` in its front matter.

   **Quiz format** — every option the same length (± a few characters), the correct one in
   a different position each time, no formatting hints:

   ````markdown
   ```quiz
   Question text?
   - [ ] wrong option of similar length
   - [x] the correct option, same length
   - [ ] another wrong option, same length
   > One-line explanation shown after answering.
   ```
   ````

4. Asks Anas to create the branch (Anas types it; Claude checks the name).

Anas reads the lesson and **tries the first slice on his own** before asking.

### Phase 3 — Build, one vertical slice at a time (Anas, Claude reviewing)

For each slice in "Your mission":

| Step | Who | What |
|---|---|---|
| 🔴 Red | Anas | writes **one** test at the agreed seam, runs it, pastes the failure |
| Check | Claude | confirms it fails **for the expected reason** (an assertion or missing behaviour — not a typo or a wrong import) |
| 🟢 Green | Anas | writes the minimum code to pass; runs the test |
| Review | Claude | short review with labels (§6); corrections if needed |
| Commit | Claude → Anas | Claude says **"commit now"** and **what belongs in it** (which files, which change, `type(scope)`); Anas writes the message; Claude reviews it |

Rules:
- No production code before its test has been run red. If code comes first, Claude
  stops and asks for the test.
- A test that passes on its first run is not trusted: break the code on purpose, see it
  fail, restore.
- One slice = one test → one minimal implementation → one commit. No writing all the
  tests first (that is "horizontal slicing": it tests imagined behaviour).
- **Refactoring is not part of the slice loop** — it happens in Phase 4.
- Where I/O is the point (Flyway, Lua, Kafka), the test is a Testcontainers integration
  test; a mock would pass for the wrong reason.
- Config-only work (POM, Compose, YAML) has no logic to drive, but still ends with a
  test that proves it, seen failing once (stop the container, remove the property).

#### 1.1 The hint ladder (when Anas is stuck)

Claude climbs **one rung at a time** and waits:
1. **Nudge** — a question pointing at the right area.
2. **Pointer** — name the API, command or concept.
3. **Skeleton** — signatures and comments, empty bodies.
4. **Partial** — the tricky 3–5 lines with blanks.
5. **Full** — only if rung 4 fails or Anas asks; Anas re-types it and explains each line.

The same ladder applies to git: rung 1 is "which git concept is this?", never the command.

#### 1.2 Debugging protocol

Claude does not jump to the fix. It asks: 1. What did you expect? 2. What happened
(exact output)? 3. Your hypothesis? 4. The smallest experiment to test it? — then helps run it.

### Phase 4 — Review, refactor, PR

1. Anas runs **`/code-review`** on the branch, then makes **refactor commits** with the
   tests green (names, duplication, structure).
2. Push, open the PR from the template with **`Closes #<issue>`**. CI must be green.
3. Claude reviews the **whole** diff as a reviewer who has not seen it: acceptance
   criteria covered, red-before-green history, glossary words, package boundaries, test
   quality, error paths, docs updated.
4. No 🔴 left → "approved". Phase 5 runs on the branch (wrap-up + notes commit), then
   Claude says "merge and clean up". Anas merges and deletes the branch.

### Phase 5 — Close + notes (Claude, then Anas)

1. Claude appends the **Wrap-up** to the lesson file and rebuilds the site:
   - **What you implemented** — the slices, files and commits that landed.
   - **What you learned** — the concepts, in short.
   - **Note for LEARNING-NOTES.md** — a ready-to-paste block (copy button on the page).
2. Claude also writes the note into `docs/learning/LEARNING-NOTES.md` itself (short,
   plain, in Anas's voice — it is *his* file, so he reviews and edits it) and switches
   `CLAUDE.md` → Current status to the next ticket. Anas reviews both and commits them
   **on the ticket branch before merging** (`docs(...)` commit). Nothing is committed straight to `main`.
   So Phase 5 happens just before the merge in Phase 4, step 4.
3. Claude writes a **learning record** for anything this ticket gave real evidence of
   (§9), and names the next ticket.

**Interview question:** once per sprint, at the Sprint Review — Anas answers in writing,
Claude gives a model answer to compare.

**Small tickets (1–2 points):** the lesson skips "Ways to build it" when there is no
real alternative.

**Resume note:** if a session ends mid-ticket, Claude's last message is a resume note:
current slice, red/green state, what is committed, next step.

---

## 2. Scrum frame

| Event | When | Length | Output |
|---|---|---|---|
| **Sprint Planning** | first day | 45 min | sprint goal, ranked tickets, `/grill-with-docs` on the first ones |
| **Daily check-in** | start of each session | 5 min | 3 lines in the sprint log: done / next / blocked |
| **Weekly review** | first session of each week | 10 min | one round in the site's Review tab, from memory (§9) |
| **Refinement** | mid-sprint | 20 min | next sprint's issues reach Ready |
| **Sprint Review** | last day | 30 min | demo script, velocity row in ROADMAP, the interview question |
| **Retrospective** | last day | 20 min | keep / change / try; from Sprint 3, `/improve-codebase-architecture` |

- **Time budget:** 4–5 h/day, 5 days/week → ~45 h per 2-week sprint; ceremonies ≈ 2 h.
- **Capacity:** 24 points baseline. From Sprint 3, capacity = average completed points
  of the last 2 sprints. Sprint 2 Review decides the M2 date (ROADMAP).
- **Rolling wave:** the current and next sprint are detailed (GitHub Issues); later
  sprints are titles + points in ROADMAP. New ideas go to the ROADMAP Icebox, never
  straight into the current sprint.
- **WIP limit:** one ticket In Progress at a time. Exception: blocked for more than one
  session → mark Blocked, log why, pick the next Ready ticket.
- **Estimation:** Fibonacci 1, 2, 3, 5, 8 (13 must be split). Points = complexity +
  uncertainty, not hours. 1 = config · 3 = one class + tests · 5 = a few classes + an
  integration test · 8 = new technology + concurrency.
- **Ticket bigger than estimated:** stop, split it, put the rest back in the backlog.
- **Design turns out wrong:** write an ADR superseding the old decision before changing code.

## 3. Tickets = GitHub Issues

Ticket IDs are labels, numbered in execution order inside each sprint (Sprint N uses
`TKT-N01…`). Once a ticket has started it is **never renumbered**.

Lean format (`.github/ISSUE_TEMPLATE/ticket.md`):

```markdown
**Goal** — one or two sentences: what changes for whom.
**Why** — the problem it solves; link to DESIGN/ADR.
**Acceptance criteria** — observable behaviours, Given/When/Then. No class names,
no test names, no steps: those are agreed at kickoff.
**Out of scope** — what this ticket deliberately does not do.
**Learning focus** — one line: the concepts this ticket teaches.
**Points** · **Depends on**
```

A ticket describes the **outcome**, not the implementation. Implementation steps, test
classes and commit plans belong in the lesson page, decided at kickoff.

### Definition of Ready
- [ ] Goal and Why are clear; acceptance criteria are observable and testable
- [ ] Dependencies are Done; out of scope stated; points estimated
- [ ] Refined with `/grill-with-docs` (glossary terms settled)

### Definition of Done
- [ ] Every piece of logic was preceded by a test Anas ran **red**
- [ ] `./mvnw verify` green locally **and** CI green on the PR
- [ ] `/code-review` run and refactors committed; Claude's review has no 🔴 left
- [ ] Commits small, Conventional Commits, each one builds
- [ ] `GLOSSARY.md`, docs and ADRs updated where relevant
- [ ] Lesson wrap-up written; LEARNING-NOTES.md and CLAUDE.md status updated by Claude, reviewed by Anas
- [ ] `CLAUDE.md` Current status updated

## 4. Git — Anas drives

Claude names the step; Anas types the commands; Claude checks the result.

| Step | Claude says | Claude checks |
|---|---|---|
| Start | "Create the branch for TKT-### from an up-to-date `main`." | `feature/TKT-###-slug` (or `fix/` `chore/` `docs/`); based on latest `main` |
| Slice green | "Commit now: <files>, <change>, type `feat(inventory)`." | one logical change; message format; no stray files |
| Push | "Push and open the PR with the template; `Closes #N`." | title `TKT-###: <title>`; template filled; CI started |
| Merge | "Approved — merge and clean up." | merge commit on `main`; branch deleted locally and on GitHub |

**Conventional Commits:** `type(scope): subject` — imperative, lower case, no period,
≤ 72 chars; optional body: why, and `Refs: TKT-###`. Types: `feat` `fix` `test`
`refactor` `chore` `docs` `perf`. Scopes: `inventory` `catalog` `gateway` `ticketing`
`identity` `contracts` `infra` `frontend` `docs`.

**CI is not TDD.** TDD drives Anas's code (red before green). CI proves the pipeline
catches failures on every PR; its own ticket checks that once (see red, then green),
then branch protection makes it required.

## 5. New services and dependencies — Spring Initializr

Anas creates every service on **start.spring.io**: Maven · Java · latest **4.1.x** (no
SNAPSHOT/M/RC) · Group `com.stadium` · Artifact = service name · Package
`com.stadium.<service>` · Jar · YAML · Java 21. The lesson lists the dependencies by
their Initializr names, each with one line on what it pulls in. Before generating, Anas
clicks **Explore** and reads the generated POM.

**Dependencies arrive just in time:** a ticket adds only the starters it needs — same
settings on start.spring.io + the new dependency → **Explore** → copy only that
dependency (and any test companion) into the service POM. Never copy a whole POM.

## 6. Code review labels

| Label | Meaning | Merge? |
|---|---|---|
| 🔴 **Blocking** | bug, broken invariant, missing test for an AC, logic without a prior red test, security | fix first |
| 🟡 **Should** | design or readability problem worth fixing now | fix or justify |
| 🟢 **Nit** | style, naming | optional |
| 💡 **Learn** | not a problem — a deeper concept worth knowing | — |
| ✅ **Praise** | something done well, and why | — |

## 7. Testing

**Tests verify behaviour through public interfaces (seams), never internals.** The seams
are agreed at kickoff. Anti-patterns: tests coupled to the implementation (mocking
internal collaborators, querying the DB instead of using the interface), tautological
tests (the expected value is computed the way the code computes it), horizontal slicing.

| Level | What | Tools | Where |
|---|---|---|---|
| **Unit (pure)** | domain + pricing, no Spring | JUnit 5, AssertJ, `@ParameterizedTest` | `domain/`, `pricing/` |
| **Property** | invariants over random inputs | jqwik | `*Properties.java` |
| **Slice** | one layer with Spring | `@WebMvcTest`, `@DataJpaTest`, `@MockitoBean` | `adapter/web`, `adapter/persistence` |
| **Integration** | real Postgres / Redis / Kafka | Testcontainers + `@ServiceConnection`, Awaitility | `*IT.java` (Failsafe) |
| **Concurrency** | races on the arbiter | `ExecutorService` + `CountDownLatch` start gate | `*ConcurrencyIT.java` |
| **Contract** | event records stay compatible | JSON round-trip tests | `contracts/` |
| **Load** | the flash crowd | k6 | `load/` |

Rules: unit tests `*Test` (Surefire), integration `*IT` (Failsafe); methods
`should<Outcome>_when<Condition>`. Domain/pricing tests run with no Spring context — if
one needs Spring, the code is in the wrong package. One Testcontainers container per type
per JVM. Never `Thread.sleep` — Awaitility. Concurrency tests assert on the store, not
only on return values. Every bug fixed gets a failing test first.

**The design's acceptance tests** (each lands in the ticket shown):

| Property | Test | Ticket |
|---|---|---|
| Overselling backstop | second SOLD row for a seat rejected by the index; still rejected with Redis flushed | TKT-103, TKT-501 |
| Generator | exactly 5000 seats, 1000 VIP, every seat in one Block, idempotent | TKT-104 |
| Projection | flush → warmup restores exact state; warmup twice = same state | TKT-106 |
| Allocator correctness | 500 threads race for the same 4 seats → exactly one Hold (repeat 100× in CI) | TKT-202 |
| Group atomicity | 4 seats requested, 4th taken → **zero** seats held | TKT-202 |
| Fan cap | 5th seat across live holds rejected | TKT-202 |
| Lazy expiry | hold with 1 s TTL → seats allocatable with sweeper disabled | TKT-203 |
| Sweep | expired hold released, counters correct, `hold.expired` emitted once | TKT-205, TKT-305 |
| Adjacency | every Run contiguous, length k, in one Block; no Orphan when avoidable | TKT-301, TKT-302 |
| Pricing | importance × tier × demand × hoursToKickoff, floor, cap, discount ladder | TKT-303 |
| Quote immutability | changing price inputs after issue does not change the Quote | TKT-304 |
| Idempotency | 50 concurrent `POST /orders` with one key → one Order, one charge | TKT-503 |
| Saga | failure injected at each step → correct compensation, no charge without ticket | TKT-505 |
| Rotating Credential | expired code rejected; second scan is a Dispute naming the first gate | TKT-1101, TKT-1102 |
| End to end | k6 50k VUs → zero oversell, zero duplicate charge, pool never exhausted | TKT-1204 (smoke: TKT-804) |

## 8. Skills — which one, when

| When | Skill | What it does here |
|---|---|---|
| Sprint Planning / refinement | `/grill-with-docs` (runs `grilling` + `domain-modeling`) | interviews Anas on the tickets; updates GLOSSARY and ADRs as decisions land |
| Kickoff | `tdd` + `codebase-design` | agree the seams; decide where a module and its interface go (ports only with two adapters, ADR-0005) |
| Build | `tdd` | one vertical slice at a time, red before green |
| Before the PR | `/code-review` (built in) | finds issues; Anas makes the refactor commits |
| Retro, from Sprint 3 | `/improve-codebase-architecture` | HTML report of shallow modules worth deepening |
| Any time a term is fuzzy | `domain-modeling` | challenges the word against GLOSSARY.md |

---

## 9. Learning — the site, sources, records, review

Learning is built for **long-term memory, not just the moment**: knowledge comes from
trusted sources, practice is real code with fast feedback, and recall is spaced over weeks.

| File | Who writes it | What it is |
|---|---|---|
| `docs/learning/lessons/TKT-###.md` | Claude | the lesson (kickoff) + the Wrap-up (close) |
| `docs/learning/LEARNING-NOTES.md` | Anas | his own notes, one section per ticket |
| `docs/learning/RESOURCES.md` | Claude (Anas may add) | trusted sources every lesson cites; one primary source per lesson |
| `docs/learning/records/NNNN-slug.md` | Claude | **learning records** — see below |
| `docs/learning/index.html` | `build.mjs` (git-ignored) | the site: Lessons · Sprints · Concepts · Review · My notes |

**Learning records** are the teaching version of ADRs: one short paragraph each, written
only when there is *evidence* — Anas demonstrated understanding of something non-trivial,
a misconception was corrected, or he said he already knows a topic (and how deeply).
Coverage is not learning, so "we talked about X" never qualifies; neither does anything
already in LEARNING-NOTES. Claude reads them at every kickoff to pitch the lesson. A
record that turns out wrong is marked `Status: superseded by 000N`, not deleted.

**Review (spaced retrieval):** the **Review** tab draws 8 random questions from *all*
lessons' quizzes, shuffled across tickets. Once a week — at the start of the first session
of the week — Anas does one round (~10 min) from memory before peeking. Wrong answers are
a signal for the next lesson; Claude may write a learning record about a repeated miss.

Build: `node docs/learning/build.mjs` → `docs/learning/index.html`, one self-contained
page (no server, no internet needed). Double-click to open.
