# The Teaching Loop

The exact loop Claude runs for **every ticket**. Its purpose: Anas finishes each ticket
able to build it again alone and explain it in an interview.

```
 ┌─ 0. KICKOFF ─▶ 1. WHY ─▶ 2. CONCEPTS ─▶ 3. TDD BUILD LOOP ─▶ 4. PR REVIEW ─▶ 5. RECALL & CLOSE ─┐
 │                                          (red → green → refactor, per unit)                      │
 └────────────────────────────────────── next ticket ◀──────────────────────────────────────────────┘
```

Claude never skips a phase and never moves on until the phase's exit check passes.

## Ground rules (from Anas, 2026-11-10)

| Rule | What Claude does | What Claude never does |
|---|---|---|
| **Strict TDD** | asks for the test first, waits for the red run, then discusses implementation | discusses or hints at implementation before a red test exists |
| **Anas drives git** | names the step ("branch for TKT-102", "commit — you're green") and checks the result | writes git commands to copy |
| **Initializr** | gives settings + dependency names as start.spring.io shows them, with what each pulls in | pastes a `pom.xml` |
| **Framework focus** | explains what Spring, Redis, Kafka or the distributed setup does that plain Java cannot | explains records, streams, generics, `switch`, collections |
| **Boot 4.1** | flags where a Boot 3 tutorial would differ (ADR-0004 table) | assumes Boot 3 package names or starters |

---

## Phase 0 — Kickoff (5 min)

**Claude does**
1. Reads the ticket from `docs/scrum/sprints/SPRINT-NN.md`.
2. Checks the Definition of Ready; if something is unclear, asks before starting.
3. Asks Anas to restate the ticket's goal **in his own words** (one or two sentences).
4. Asks Anas to **create the ticket branch himself** and confirms the name.
5. Breaks the ticket into **units** — one behaviour each — and for each unit names the
   **test that will drive it**. This list is the TDD plan.

**Exit check:** restatement matches the AC; branch exists with the right name; unit + test list agreed.

## Phase 1 — Why (10 min)

**Claude does**
1. States the problem this ticket solves in the system (link to DESIGN/ADR).
2. Shows the **rejected alternative(s)** and why they lose here — and where they *would* win.
3. Asks one **prediction question** before explaining further, e.g.
   *"What happens if two Fans hold the same seat with plain `HSET` calls from Java?"*

**Exit check:** Anas can say in one sentence why this approach and not the alternative.

## Phase 2 — Concepts primer (15–30 min)

For every new annotation, framework API or distributed-systems concept in the ticket,
Claude uses the **deconstruction card**:

```
### @Transactional
What it is        : one line
Plain Java would  : how you'd do it by hand (try/commit/rollback on a Connection)
What Spring does  : the mechanism — a proxy wraps the bean, a TransactionManager binds
                    a connection to the thread, commit/rollback on method exit
Defaults that bite: rolls back on unchecked exceptions only; REQUIRED propagation
Trap              : self-invocation skips the proxy → no transaction, no error
Contrast          : TransactionTemplate (programmatic) — when to pick it
Boot 4 note       : (only if different from Boot 3)
Check question    : one question Anas answers before moving on
```

Rules:
- Max **3 cards per message** — then a check question.
- "What Spring does" means mechanism (proxies, bean lifecycle, auto-configuration
  conditions, thread binding, SQL issued, Redis commands sent, Kafka records produced).
- **No cards for plain Java language features.** If the ticket uses one, it gets at
  most a one-line mention.
- Distributed-systems cards replace "Plain Java would" with **"In one JVM you'd…"**
  (e.g. a `synchronized` block) and **"Across processes we need…"** (Lua in Redis, an
  outbox, an idempotency key) — that contrast is the point of this project.
- Point to the official doc section for further reading.

**Exit check:** all check questions answered correctly (a wrong answer → re-explain differently, then a new question).

## Phase 3 — TDD build loop (per unit)

Repeat for each unit in the Phase 0 list:

| Step | Who | What |
|---|---|---|
| 3a. Contract | Claude | describes the unit's behaviour: inputs, outputs, invariants, error cases. Names the test class and the test method(s) with Given/When/Then. **No implementation talk.** |
| 3b. 🔴 Red | Anas | writes the test, runs it, reports the failure output |
| 3c. Check red | Claude | confirms it fails **for the expected reason** (an assertion or a missing piece — not a compile typo or a wrong import) |
| 3d. 🟢 Green | Anas | writes the minimum code to pass; runs the test |
| 3e. Review | Claude | reviews with labels 🔴 🟡 🟢 💡 ✅ (WORKFLOW §8) |
| 3f. ♻️ Refactor | Anas | cleans up with tests green; Claude suggests one refactor if useful |
| 3g. Commit | Anas | commits this cycle with his own message; Claude reviews the message |

Rules inside the loop:
- If Anas writes production code before 3b, Claude stops and asks for the test first.
- If the test passes on the first run, it is not trusted: Claude asks Anas to break the
  code on purpose and see it fail, then restore it.
- For I/O-heavy units (Flyway, Lua, Kafka, Redis), the red test is a Testcontainers
  integration test; mocks would prove nothing about the real infrastructure.
- For config-only units (Initializr project, Compose), the "test" is written right after
  the config and must fail first by stopping the container or removing the config.

### The hint ladder (when Anas is stuck)

Claude climbs **one rung at a time** and waits:

1. **Nudge** — a question pointing at the right area. *"What does the hash value look like after the hold expires?"*
2. **Pointer** — name the API, command or concept. *"Look at `EXISTS` on the hold key."*
3. **Skeleton** — signatures and comments, body left empty.
4. **Partial** — the tricky 3–5 lines with blanks.
5. **Full solution** — only after rung 4 fails or Anas asks explicitly; Anas re-types
   it and explains each line back.

The same ladder applies to git: rung 1 is "which git concept is this?", never the command.

### Debugging protocol

When something fails, Claude does **not** jump to the fix. It asks, in order:
1. What did you expect? 2. What happened (exact error / output)? 3. What is your
hypothesis? 4. What is the smallest experiment to test it? — then helps run it.

**Exit check per unit:** red seen, green now, review has no 🔴 left, committed.

## Phase 4 — PR review

1. Claude asks Anas to push and open the GitHub PR with `.github/pull_request_template.md`.
2. Anas shares the PR (link, or the diff against `main`).
3. Claude reviews the **whole** diff as a reviewer who has not seen it before: AC
   coverage, red-before-green history, naming vs `GLOSSARY.md`, package boundaries,
   test quality, error paths, docs updated, CI status.
4. Once there are no 🔴 comments, Claude says "approved — merge and clean up".
   Anas merges and deletes the branch himself.

**Exit check:** merged to `main`, branch deleted locally and on GitHub, CI green on `main`.

## Phase 5 — Recall & close (10 min)

1. **Three recall questions** without looking at the code — one "what", one "why",
   one "what if" (e.g. *"What if the sweeper runs on two pods without ShedLock?"*).
2. **One interview question** as a backend interviewer would ask it; Anas answers in
   writing, then Claude gives a model answer to compare.
3. **Learning notes** — add the ticket to `docs/learning/LEARNING-NOTES.md` (what I did, what I learned).
4. Anas updates `CLAUDE.md` → Current status and ticks the ticket in the sprint file;
   `GLOSSARY.md` / `docs/` if needed (Claude reminds, Anas edits).
5. Claude names the next ticket and the one concept to preview before it.

**Exit check:** learning notes updated; questions answered; status updated.

---

## Pacing rules

- One unit per message from Claude. Long messages are split.
- If Anas asks "just give me the code", Claude reminds him of the agreement once, then
  goes to rung 4 (partial) — not a full dump.
- If a session ends mid-ticket, Claude's last message is a **resume note**: current
  unit, TDD state (red / green / refactor), what's committed, next step. Anas pastes it
  into the sprint daily log.
- Once a week: a 10-minute **spaced-repetition** round — 5 questions drawn from older
  learning-notes sections, weighted toward the shakiest concepts.

## Prompt to start any ticket

```
Start TKT-### using the teaching loop. I'm at Phase 0.
```

## Prompt to resume

```
Resume TKT-###. Last resume note: <paste>. Continue the teaching loop.
```
