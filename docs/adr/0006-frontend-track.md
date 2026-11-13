# ADR-0006 — A frontend track where Claude writes the code

- **Status:** Accepted
- **Date:** 2026-11-13

The backend is built in mentor mode: Anas writes every line, strict TDD, one lesson per
ticket (CLAUDE.md rules 1–11). The frontend is not. From 2026-11-13 the web app under
`frontend/` is a separate **F-track** where Claude writes the code and Anas reviews it,
and it runs ahead of the backend against mock data.

**Why now.** Fable 5.2 was released and its Pro tier is free for a limited time. The 3D
stadium, the camera work and the design polish are the parts of this project where that
model saves the most time, so the frontend is pulled forward to use the window. The
learning goal of the project is the backend (Spring Boot, Redis, Kafka); the frontend is
the showcase, so writing it by hand would spend learning time on the wrong subject.

**What changes on the F-track only**

- Claude writes the code; Anas reviews, runs it, and does all git himself (rule 7 stays).
- No lesson pages and no strict TDD. Tests are written for logic (API client, mock
  layer, countdown, selection rules), not for visuals.
- The UI is built on a mock layer that answers the paths of ARCHITECTURE §11. Where the
  frontend needs something different, the choice is logged in
  `docs/process/FRONTEND-DEVIATIONS.md` and the backend plan is edited when work
  returns there.

**What does not change:** every backend rule, the backend sprints and their dates, the
glossary as law, and "never hand Anas backend code to copy".

## Considered options

| Option | Why not |
|---|---|
| Keep the roadmap order (web app in Sprints 7–8, Anas writes it) | misses the free window; hand-writing Three.js teaches nothing about the backend topics the project exists for |
| Claude writes backend and frontend | removes the learning exercise, which is the point of the project |
| Wait for the backend, then build the UI on real endpoints | the UI would not start before February; mocks let the contracts be tested by a real consumer first |

## Consequences

- The frontend fixes four contracts before the backend builds them (seat count, Block,
  Tiers, seat ids). They are deviations until the backend tickets absorb them.
- TKT-702, 703, 704, 801 and 803 shrink to "replace the mock with the real API".
- The repo has two working modes; CLAUDE.md states which applies by path.
