# Frontend tickets

Every ticket of the frontend track (F-track, ADR-0006), with what it delivered and where
it stands. The sprint plan is in [`ROADMAP.md`](ROADMAP.md); the brief is
[`.claude/skills/animation.md`](../../.claude/skills/animation.md).

Status: ✅ merged · 🔎 built, PR open · ▶ in progress · ⏸ put aside for now · ☐ not started.

**Order changed on 14 Nov 2026** (Anas): after F302 the track goes to F401, F402 and
F403 first, then comes back for F303 and F304, and ends with F404. So the order is
F401 → F402 → F403 → F303 → F304 → F404.

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
| TKT-F301 | Waiting Room screen with the Draw animation | ✅ | [#20](https://github.com/anasha447/stadium-ticketing/issues/20) | [#21](https://github.com/anasha447/stadium-ticketing/pull/21) |
| TKT-F302 | "Your seats" drawer (max 4), Hold, countdown, Quote | ✅ | [#22](https://github.com/anasha447/stadium-ticketing/issues/22) | [#23](https://github.com/anasha447/stadium-ticketing/pull/23) |
| TKT-F303 | Sign-in with the fake one-time code, demo checkout, Order status | 🔎 | [#30](https://github.com/anasha447/stadium-ticketing/issues/30) | [#31](https://github.com/anasha447/stadium-ticketing/pull/31) |
| TKT-F304 | Confirmation, Tickets, My Tickets, "mine" seats in the stadium | ⏸ after F303 | | |

**TKT-F301 — Waiting Room.** "Choose your seats" now leads here. The Fan joins with one
button, sees how many are waiting and a countdown to the Draw, then gets a place and
watches it count down at 200 Fans a second until they are admitted. The picture shows
the crowd as dots: at the Draw every dot moves at once into a queue, and the front of the
queue goes in through the top. Admission lasts 30 minutes; the stadium page sends anyone
without it back here, and the mock refuses a Hold without it.

**TKT-F302 — Your seats and the Hold.** In a seat, "Add seat" puts it in "Your seats",
up to four; in a Block, "Pick seats together" chooses 2, 3 or 4 free neighbours. Chosen
seats show in their own colour in the stadium. "Hold seats" makes the Hold, and the
drawer then shows the eight-minute countdown and the Quote: one line per seat, the Group
Discount where it applies, and the total. If a seat was taken meanwhile it is named and
dropped and the rest stay chosen. A Hold survives a reload, can be released, and says so
when it runs out. "Continue to checkout" opens a page that shows the time left and the
total; paying comes with F303.

**TKT-F303 — Checkout.** The checkout asks for a mobile number, shows the demo code on
screen, and checks it; a wrong code asks again. Then the Fan picks Apple Pay or card
(no card fields) and presses "Pay €…". The Order is sent with an Idempotency-Key made
once per Hold and kept with the method, so a retry or a reload can never pay twice. The
page then follows the Order until it is paid (reference and seats) or failed (the Hold
ran out). The Hold's time left and total stay in view the whole time, first on a phone.

## Sprint F4 — Atmosphere and polish

| Ticket | Title | Status | Issue | PR |
|---|---|---|---|---|
| TKT-F401 | Night sky, floodlights, live match, fans on sold seats | ✅ | [#24](https://github.com/anasha447/stadium-ticketing/issues/24) | [#25](https://github.com/anasha447/stadium-ticketing/pull/25) |
| TKT-F402 | Live Seat State updates over SSE (mock stream) | ✅ | [#26](https://github.com/anasha447/stadium-ticketing/issues/26) | [#27](https://github.com/anasha447/stadium-ticketing/pull/27) |
| TKT-F403 | Touch, phone layout, reduced motion, keyboard path through the mini-map | 🔎 | [#28](https://github.com/anasha447/stadium-ticketing/issues/28) | [#29](https://github.com/anasha447/stadium-ticketing/pull/29) |
| TKT-F404 | `impeccable` audit, `ui-taste` review, performance pass | ☐ last, after F304 | | |

**TKT-F401 — Atmosphere.** A dark sky with stars, banks of floodlights under the roof
edge, and a match on the pitch: 22 players, a referee and a ball on a loop. Every sold
seat has a seated fan, in home colours everywhere except the south end, which wears the
visiting blue and white. The stadium view keeps the bare mosaic; the fans rise into
their seats when a Block is opened. Only the Blocks around the open one get the full
figure, which keeps the cost of 30,000 fans to about an eighth of a frame, and the seats
right around the Fan's own are left clear so heads do not cover the pitch.

**TKT-F402 — Live Seat States.** The stadium page opens one stream per Match. On each
open it reads the whole stadium's Seat States, then applies the changes as they come,
a few times a second: seat colours, fans on sold seats and "seats left" all follow, and
"seats left" is now counted from the Seat States instead of a separate occupancy call.
In the mock, other Fans hold 1–4 seats together about six times a second, then buy them
or let them go; a Hold on one of their seats gets the usual 409. A seat someone takes
pulses amber once in an open Block. A chosen seat that someone else takes is named and
dropped at once, and seat view says so if the Fan is sitting in it.

**TKT-F403 — Touch, phone, keyboard.** The mini-map can be used from the keyboard:
Tab to it, arrow keys round the ring and between Levels, Enter to fly in; the Block
under focus lights up in the stadium. A pinch zooms in seat view, a finger drag no
longer leaves a hover card behind, and on a touch screen the hints say "tap" and
"pinch". On a phone the Tier buttons, the "pick seats together" buttons and the links
in "Your seats" are 44 px tall. With reduced motion a camera move fades in from dark
instead of jumping.

## Carried forward

Things noticed along the way that no ticket has closed yet. Each names the ticket that
should pick it up.

| What | Found in | Goes to |
|---|---|---|
| The 3D view has not been seen at phone width or used by touch on a real device: the panels were checked at 375 px, but the preview leaves the canvas black at that size | F201–F204, F403 | F404, on a phone |
| Reduced motion is coded (fade-in cuts, no auto-rotation, no pulse) but not checked with the setting on; the preview cannot switch it | F203, F403 | F404 |
| On a phone the mini-map is 82 × 98 px, too small to tap one Block reliably; tapping the stands is the way there | F403 | F404, if wanted |
| "Pick seats together" is worked out in the browser; the backend's `mode=ADJACENT` is still not in the mock or used | F102, F302 | when the gateway exists |
| A held seat pulses only when it is taken; at rest, and always with reduced motion, it differs by colour only (motion.md asks for a static outline) | F203, F402 | F404 |
| The LED boards round the pitch and the two scoreboards from the brief are in no ticket | F401 | F404, if wanted |
| "Play the match" (shown with reduced motion) and the fans' rise were not seen with reduced motion switched on | F401 | F404 |
| The preview pane draws about one frame a second, so the match and the fans' rise were checked frame by frame, not at full speed. Frame cost was measured by timing renders, not by counting frames per second | F401 | F404 |
| "Your seats" on a phone opens from a button and has only been checked at desktop width | F302 | F404 |
| After paying, the checkout lists the seats but there are no Tickets to show: My Tickets is still the empty page | F303 | F304 |
| A declined payment and the retry with another method (`payment-attempts`) are in neither the mock nor the UI | F303 | when the gateway exists |
| The Order's "paid" and "failed" states were seen; "failed" was only tested in code (Hold running out mid-payment) | F303 | F404 |
| The amber pulse and the "Another Fan has just taken this seat" line in seat view were not seen on screen at full speed; the taken-seat notice was | F402 | F404 |
| The cost of rebuilding the fans on each stream update was not measured (the preview pane draws too few frames) | F402 | F404 |
| New fans pop into a seat sold while the Block is open; they do not rise | F402 | F404, if wanted |
| The mock's other Fans live in the browser, so the match list and match page do not see them, and two tabs each run their own | F402 | when the gateway exists |
| Dragging during a camera flight waits for the landing | F203 | F404, if it feels wrong in use |
| The full `impeccable` and `ui-taste` reviews were skipped from F202 on | F202–F204 | F404 |
| The roof is a short, see-through ring; the plan is a rounded rectangle, not the real oval | F201 | F401, if wanted |
| The view score is a home-made formula | F204 | backend, if it ever supplies one |
| The Draw animation has only been seen at 1 frame per second (the preview pane throttles it) | F301 | F404 |
| The demo crowd is 3,600 Fans so the longest wait is 18 seconds; the Registration Window before booking opens is not shown | F301 | the backend tickets |

## Backend work this track has created

Listed in [`FRONTEND-DEVIATIONS.md`](FRONTEND-DEVIATIONS.md): 60,000 seats instead of
5,000, the new meaning of Block and Row, four Tiers and Levels, the seat id format, and
the compact Seat Map and Seat States responses.

_Update this file when a ticket starts, when its PR opens, and when it merges._
