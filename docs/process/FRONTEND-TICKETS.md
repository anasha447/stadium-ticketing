# Frontend tickets

Every ticket of the frontend track (F-track, ADR-0006), with what it delivered and where
it stands. The sprint plan is in [`ROADMAP.md`](ROADMAP.md); the brief is
[`.claude/skills/animation.md`](../../.claude/skills/animation.md).

Status: ✅ merged · 🔎 built, PR open · ▶ in progress · ☐ not started.

## Sprint F1 — Foundation

| Ticket | Title | Status | Issue | PR |
|---|---|---|---|---|
| — | Start the frontend track: skills, scaffold, docs | ✅ | — | [#5](https://github.com/anasha447/stadium-ticketing/pull/5) |
| TKT-F101 | Design system: tokens and fonts in the Next app | ✅ | [#6](https://github.com/anasha447/stadium-ticketing/issues/6) | [#7](https://github.com/anasha447/stadium-ticketing/pull/7) |
| TKT-F102 | Typed API client and mock backend | ✅ | [#8](https://github.com/anasha447/stadium-ticketing/issues/8) | [#9](https://github.com/anasha447/stadium-ticketing/pull/9) |
| TKT-F103 | App shell, match list and match page | ✅ | [#10](https://github.com/anasha447/stadium-ticketing/issues/10) | [#11](https://github.com/anasha447/stadium-ticketing/pull/11) |

**TKT-F101 — Design system.** The `stadium-design-system` skill, its tokens in
`globals.css` (the default Tailwind palette is switched off), and three fonts: Big
Shoulders for titles and numbers, Geist for text, Geist Mono for anything that ticks.
`/design` shows every token on one page.

**TKT-F102 — API client and mock.** Screens import one `api` object. Without
`API_BASE_URL` the mock answers with no network; with it, the same calls go to the
gateway. The mock builds the stadium (120 Blocks, 60,560 seats, four Tiers) and keeps the
backend rules: Holds of 1–4 seats that expire after 8 minutes, a fixed Quote with the
Group Discount, the limit of four seats per Match, idempotent Orders.

**TKT-F103 — First pages.** Header and footer, the match list as the home page, the match
page with seats left by Block and the four Tiers, a not-found page and an empty My
Tickets page. Pages are prebuilt; seats left is refreshed every 10 seconds.

## Sprint F2 — The Stadium

| Ticket | Title | Status | Issue | PR |
|---|---|---|---|---|
| TKT-F201 | The stadium bowl in 3D | ✅ | [#12](https://github.com/anasha447/stadium-ticketing/issues/12) | [#13](https://github.com/anasha447/stadium-ticketing/pull/13) |
| TKT-F202 | 60K seats and the yellow mosaic | ✅ | [#14](https://github.com/anasha447/stadium-ticketing/issues/14) | [#15](https://github.com/anasha447/stadium-ticketing/pull/15) |
| TKT-F203 | Stadium, Block and seat views with camera flights | ✅ | [#16](https://github.com/anasha447/stadium-ticketing/issues/16) | [#17](https://github.com/anasha447/stadium-ticketing/pull/17) |
| TKT-F204 | Mini-map, breadcrumbs, Tier legend and hover cards | ✅ | [#18](https://github.com/anasha447/stadium-ticketing/issues/18) | [#19](https://github.com/anasha447/stadium-ticketing/pull/19) |

**TKT-F201 — The bowl.** Three stepped Levels on a rounded-rectangle plan, the outer wall
with balcony rings, a roof ring, a striped pitch with markings and goals. Drag to spin,
scroll to zoom. `lib/stadium/layout.ts` places every Block, Row and seat in metres. Its
tests changed a Level from 13/7 to 12/8 Blocks per side and end, to keep seats evenly
spaced.

**TKT-F202 — Seats and mosaic.** All 60,560 seats as one instanced mesh, in blue and
garnet bands, running at about 58 frames per second. Three marks in yellow seats: the
crest on the west side, the Spotify symbol behind the north goal, FC BARCELONA on the
east side. The marks were later made 25% smaller and centred (in the F203 PR).

**TKT-F203 — Three views.** Click a Block and the camera flies in; its seats switch from
the mosaic to Seat State. Click an available seat to sit in it and see the pitch. Arrow
keys and buttons step to the next available seat or Row; Escape goes back one step.
Flights last 1.2–1.8 seconds, can be redirected, and become a cut with reduced motion.

**TKT-F204 — Wayfinding.** Hover cards for Blocks and seats, breadcrumbs, a Tier legend
that dims the other Tiers, a mini-map that flies to a Block and shows where a seated Fan
is looking, and a view score out of 100 with the distance to the pitch.

## Sprint F3 — Booking

| Ticket | Title | Status | Issue | PR |
|---|---|---|---|---|
| TKT-F301 | Waiting Room screen with the Draw animation | 🔎 | [#20](https://github.com/anasha447/stadium-ticketing/issues/20) | [#21](https://github.com/anasha447/stadium-ticketing/pull/21) |
| TKT-F302 | "Your seats" drawer (max 4), Hold, countdown, Quote | ☐ | | |
| TKT-F303 | Sign-in with the fake one-time code, demo checkout, Order status | ☐ | | |
| TKT-F304 | Confirmation, Tickets, My Tickets, "mine" seats in the stadium | ☐ | | |

**TKT-F301 — Waiting Room.** "Choose your seats" now leads here. The Fan joins with one
button, sees how many are waiting and a countdown to the Draw, then gets a place and
watches it count down at 200 Fans a second until they are admitted. The picture shows
the crowd as dots: at the Draw every dot moves at once into a queue, and the front of the
queue goes in through the top. Admission lasts 30 minutes; the stadium page sends anyone
without it back here, and the mock refuses a Hold without it.

## Sprint F4 — Atmosphere and polish

| Ticket | Title | Status | Issue | PR |
|---|---|---|---|---|
| TKT-F401 | Night sky, floodlights, live match, fans on sold seats | ☐ | | |
| TKT-F402 | Live Seat State updates over SSE (mock stream) | ☐ | | |
| TKT-F403 | Touch, phone layout, reduced motion, keyboard path through the mini-map | ☐ | | |
| TKT-F404 | `impeccable` audit, `ui-taste` review, performance pass | ☐ | | |

## Carried forward

Things noticed along the way that no ticket has closed yet. Each names the ticket that
should pick it up.

| What | Found in | Goes to |
|---|---|---|
| The 3D view has not been seen at phone width or used by touch (the preview pauses the canvas at phone size) | F201–F204 | F403 |
| Reduced motion is coded (cuts for flights, no auto-rotation) but not checked on a device | F203 | F403 |
| The mini-map is pointer-only | F204 | F403 |
| "Pick for me" (`mode=ADJACENT`) is not in the mock | F102 | F302 |
| "Yours" seat colour and the non-colour cues for seat state (pulse for held, fans on sold) | F203 | F302, F401, F402 |
| Dragging during a camera flight waits for the landing | F203 | F404, if it feels wrong in use |
| The full `impeccable` and `ui-taste` reviews were skipped from F202 on | F202–F204 | F404 |
| The roof is a short, see-through ring; the plan is a rounded rectangle, not the real oval | F201 | F401, if wanted |
| The view score is a home-made formula | F204 | backend, if it ever supplies one |
| The Draw animation has only been seen at 1 frame per second (the preview pane throttles it) | F301 | F404 |
| The demo crowd is 3,600 Fans so the longest wait is 18 seconds; the Registration Window before booking opens is not shown | F301 | F402, or the backend tickets |

## Backend work this track has created

Listed in [`FRONTEND-DEVIATIONS.md`](FRONTEND-DEVIATIONS.md): 60,000 seats instead of
5,000, the new meaning of Block and Row, four Tiers and Levels, the seat id format, and
the compact Seat Map and Seat States responses.

_Update this file when a ticket starts, when its PR opens, and when it merges._
