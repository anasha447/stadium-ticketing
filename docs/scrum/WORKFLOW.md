# Scrum Workflow

How work moves from idea to merged code. Solo Scrum: Anas is Developer and Product
Owner; Claude is Scrum Master, mentor and code reviewer.

---

## 1. Cadence

| Event | When | Length | Output |
|---|---|---|---|
| **Sprint Planning** | first day of the sprint | 45 min | sprint goal, committed tickets, `SPRINT-NN.md` detailed |
| **Daily check-in** | start of each work session | 5 min | 3 lines in the sprint file's log: done / next / blocked |
| **Ticket loop** | continuous | — | one ticket at a time, see TEACHING-LOOP.md |
| **Backlog refinement** | mid-sprint | 20 min | next sprint's tickets reach Definition of Ready |
| **Sprint Review** | last day | 30 min | demo script run end to end, ROADMAP velocity row filled |
| **Retrospective** | last day | 20 min | keep / change / try, written in the sprint file |

**Time budget:** 4–5 hours a day of coding and review, 5 days a week → ~45 hours per
2-week sprint. Ceremonies come out of that budget (≈ 2 h per sprint).

**Capacity:** 24 points baseline (Sprint 1: 28, deliberately full). From Sprint 3,
capacity = average completed points of the last 2 sprints. The Sprint 2 Review is the
decision point for the February M2 date (see ROADMAP "Hitting February").

**Calendar:** see ROADMAP. Sprint 1 runs Wed Nov 11 – Tue Nov 24, 2026; every sprint
after that is 14 days.

## 2. Rolling-wave planning

- **Detailed** (full ticket spec): the current sprint and the next one.
- **Outlined** (titles + points): every sprint in ROADMAP.md.
- At each Sprint Planning, Claude turns the next outlined sprint into a detailed
  `SPRINT-NN.md`, using what was learned (velocity, design changes, new ADRs).
- New ideas go to BACKLOG.md, never straight into the current sprint.

## 3. Ticket lifecycle

```
Backlog ──▶ Ready ──▶ In Progress ──▶ In Review ──▶ Done
              ▲            │               │
              └── Blocked ◀┘◀── changes ───┘
```

Only **one** ticket is In Progress at a time.

### Definition of Ready (before a ticket starts)

- [ ] User story or task statement is clear
- [ ] Acceptance Criteria are testable — each one maps to at least one named test
- [ ] Dependencies are Done
- [ ] Estimated in points
- [ ] Concepts to learn are listed
- [ ] Out-of-scope is stated
- [ ] For a new service: Initializr settings and dependency list are in the ticket

### Definition of Done (before a ticket is merged)

- [ ] **Every piece of business logic was preceded by a failing test that Anas ran red**
- [ ] `./mvnw verify` green locally **and** the CI check green on the PR
- [ ] Unit tests for all pure logic; integration test wherever I/O is involved
- [ ] Every annotation used can be explained by Anas (checked in the recall step)
- [ ] Commits are small, follow Conventional Commits, and each one builds
- [ ] GitHub PR opened with the template, reviewed by Claude, all 🔴 Blocking comments fixed
- [ ] `GLOSSARY.md` updated if a new term appeared
- [ ] Relevant `docs/` updated (DATA-MODEL, API, EVENTS, ADR)
- [ ] Learning notes updated (`docs/learning/LEARNING-NOTES.md`)
- [ ] `CLAUDE.md` "Current status" updated

## 4. Estimation

Fibonacci points: 1, 2, 3, 5, 8, 13. A 13 must be split before it enters a sprint.
Points measure complexity + uncertainty, not hours. Rough guide while learning:
1 = a config change · 3 = one class + tests · 5 = a few classes + an integration test ·
8 = new technology + concurrency or multiple adapters.

## 5. Test-Driven Development (strict)

Every unit of behaviour goes through this cycle — no exceptions for "simple" code.

```
  ① RED          ② GREEN              ③ REFACTOR          ④ COMMIT
  write the  ──▶ write the least ──▶ clean names,    ──▶ only when green
  test, run it   code that passes     remove duplication   (tests + code together)
  and SEE it     — nothing more       — tests stay green
  fail
```

- **Red must be seen.** Anas runs the test and pastes or describes the failure. The
  failure must be the *expected* one (an assertion or a missing table), not a typo.
- **Integration-first where I/O is the point.** For a Flyway migration, a Lua script or
  a Kafka producer, the first test is a Testcontainers test, because a unit test with
  mocks would pass for the wrong reason.
- **Config-only work** (Initializr project, Compose file, YAML) has no logic to drive,
  but it still ends with a test that proves it (context loads, health is UP).
- **Commit rhythm:** one commit per green cycle or per small group of related cycles.
  Never commit a red test on `main`. Committing a red test on the feature branch is fine
  only to share a failure for review.

## 6. Git flow per ticket — Anas drives

Claude **never** hands over git commands to copy. Claude names the step; Anas types
the commands; Claude checks the result and corrects mistakes only.

| Step | Claude says | Anas does | Claude checks |
|---|---|---|---|
| Start | "Create the branch for TKT-102 from an up-to-date `main`." | updates `main`, creates and switches to the branch | name matches `feature/TKT-102-<slug>`; based on latest `main` |
| Work | "Tests are green — commit this cycle." | stages only this cycle's files, writes the message | one logical change per commit; message format; no stray files |
| Push | "Push the branch and open a PR with the template." | pushes, opens the GitHub PR | PR title `TKT-102: <title>`; template filled; CI started |
| Review | reviews on the PR (or from the pasted diff) | fixes, pushes new commits | 🔴 comments resolved; CI green |
| Merge | "Approved — merge to `main` and clean up." | merges (merge commit, `--no-ff` style), deletes the branch locally and on GitHub, updates local `main` | `main` contains the ticket; branch gone |

If Anas gets stuck on a git command, Claude climbs the hint ladder (TEACHING-LOOP)
starting at "which git concept is this?", not at the command itself.

### Branch names

`feature/TKT-###-slug` · `fix/TKT-###-slug` · `chore/TKT-###-slug` · `docs/TKT-###-slug`

### Conventional Commits

`type(scope): subject` — imperative, lower case, no period, ≤ 72 chars.
Body (optional): why, and `Refs: TKT-###`.

| type | use |
|---|---|
| `feat` | new behaviour |
| `fix` | bug fix |
| `test` | tests only |
| `refactor` | no behaviour change |
| `chore` | build, deps, config |
| `docs` | documentation |
| `perf` | performance |

Scopes: `inventory` `catalog` `gateway` `ticketing` `identity` `contracts` `infra`
`frontend` `docs`.

## 7. New services and dependencies — Spring Initializr

Anas creates every service on **start.spring.io**. Tickets that create a service list:

| Setting | Value for this project |
|---|---|
| Project | Maven |
| Language | Java |
| Spring Boot | latest **4.1.x** (not SNAPSHOT/M/RC) |
| Group | `com.stadium` |
| Artifact / Name | the service name, e.g. `inventory` |
| Package name | `com.stadium.<service>` |
| Packaging | Jar |
| Configuration | YAML |
| Java | 21 |

…plus the **dependencies by their Initializr names**, each with one line on what it
pulls in. Before generating, Anas clicks **Explore** and reads the generated `pom.xml`
— that is part of the learning.

**Adding a dependency to an existing service:** select the same settings plus the new
dependency on start.spring.io → **Explore** → copy only that dependency (and any test
companion Initializr adds) into the service POM. Never copy a whole POM over an
existing one.

**Monorepo note:** Initializr generates standalone projects. TKT-101 explains how to
place them under the root aggregator POM (parent chain, one Maven Wrapper at the root).

## 8. Code review (GitHub PR)

Claude reviews like a senior colleague. Every comment has a label:

| Label | Meaning | Merge? |
|---|---|---|
| 🔴 **Blocking** | bug, broken invariant, missing test for an AC, logic without a prior red test, security | fix first |
| 🟡 **Should** | design or readability problem worth fixing now | fix or justify |
| 🟢 **Nit** | style, naming | optional |
| 💡 **Learn** | not a problem — a deeper concept worth knowing | — |
| ✅ **Praise** | something done well, and why it is good | — |

Review checklist: AC met · each AC has a test · test history shows red before green ·
glossary words used · no domain leaking into adapters (or vice versa) · no annotation
used without reason · error paths handled · names explain intent · migration is
forward-only · commits are atomic and well named.

How Claude sees the PR: Anas pastes the PR link, or the output of a diff against
`main` (he chooses the command — Claude checks he compared against the right base).

## 9. Velocity tracking

Kept in ROADMAP.md:

| Sprint | Committed | Completed | Notes |
|---|---|---|---|
| 1 | 28 | — | |

## 10. When something goes wrong

- **Ticket bigger than estimated:** stop, split it, put the remainder back in the backlog.
- **Blocked > 1 session:** mark Blocked, write why in the log, pick the next Ready ticket
  (the only exception to "one at a time").
- **Design turns out wrong:** write an ADR superseding the old decision before changing code.
- **A Boot 3 tutorial doesn't work:** check the ADR-0004 difference table first.
