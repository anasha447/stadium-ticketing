# Frontend

How the Next.js app (`frontend/stadium-site`) talks to the backend. The endpoint list
itself lives in [ARCHITECTURE §11](ARCHITECTURE.md#11-http-endpoints); this file says
which screen calls what, and from where. Built on the F-track (ADR-0006).

## 1. Three ways a request leaves the app

| Path | Used for | Why |
|---|---|---|
| **Server component → gateway** | reads that every Fan sees the same (match list, match page, Seat Map layout) | rendered and cached on the server; the browser gets HTML, and the flash crowd hits the Next cache, not the gateway |
| **Browser → `/api/*` → gateway** (Next rewrite) | everything per-Fan and live: Waiting Room, Seat States, Holds, Orders, SSE streams | same origin, so no CORS and the cookie travels by itself; the rewrite is a plain proxy with no logic |
| **Route handler** (`app/api/auth/*`) | the one-time-code exchange only | it must set the JWT as an `httpOnly` cookie, which a rewrite cannot do; JavaScript never sees the token |

The gateway stays the single public entry of the backend. Next adds no business rules:
it never computes a price, never decides a Seat State, never extends a Hold.

## 2. Screen by screen

| Screen | Route | Calls | Path | Notes |
|---|---|---|---|---|
| Match list | `/` | `GET /matches` · `GET /matches/{id}/occupancy` for the Match on sale | server | Matches cached for minutes; seats left refreshed every 10 s |
| Match page | `/matches/[id]` | `GET /matches/{id}` · `…/seatmap` · `…/occupancy` | server | prebuilt per Match; seats left and Tier availability refreshed every 10 s |
| Waiting Room | `/matches/[id]/waiting-room` | `POST /waiting-room/{id}/register` · `GET /waiting-room/{id}/position` (SSE) | browser | admission sets the Admission Token cookie |
| Stadium | `/matches/[id]/seats` | `GET /matches/{id}/seatmap` | server | static layout, cached hard; ~60K seats sent as a compact array, not one object per seat |
| | | `GET /matches/{id}/occupancy` | browser | "seats left" per Block in stadium view, including this Fan's own Holds |
| | | `GET /matches/{id}/seat-states` | browser | snapshot when a Block is opened |
| | | `GET /stream/matches/{id}` (SSE) | browser | seat deltas after the snapshot |
| Hold | drawer on the stadium | `POST /matches/{id}/holds` | browser | 201 → Hold + Quote; 409 → conflicting seat ids are shown on the map |
| | | `GET` / `DELETE /matches/{id}/holds/{holdId}` | browser | countdown runs from `expiresAt`, never from a local timer start |
| Sign-in | step inside checkout | `POST /auth/otp/request` · `POST /auth/otp/verify` | route handler | fake code, printed to the backend console |
| Checkout | `/checkout/[holdId]` | `POST /orders` with `Idempotency-Key` | browser | the key is created once per Hold and reused on retry |
| | | `GET /orders/{orderId}` | browser | polled until CONFIRMED or FAILED |
| | | `POST /orders/{orderId}/payment-attempts` | browser | retry with another method |
| My Tickets | `/tickets` | `GET /me/tickets` | server | per-Fan, not cached |

Later, off the F-track: Steward scanner (`POST /gate/scans`, Sprint 11), Admin occupancy
heatmap (Sprint 12), Rotating Credential (`GET /tickets/{id}/credential`, Sprint 11).

Server reads live in `lib/queries.ts`, each a `"use cache"` function with a lifetime:
Matches for minutes, the Seat Map for days, occupancy refreshed every 10 seconds. Pages
are prebuilt and served from that cache, so a crowd on the match page costs the gateway
one occupancy read every 10 seconds, not one per visitor.

## 3. One client, two adapters

```
frontend/stadium-site/lib/
  domain/              types and seat-id helpers, shared by everything
  api/stadium-api.ts   the interface: one method per endpoint the Fan flow uses
  api/http.ts          adapter 1: the gateway, over fetch
  api/mock/            adapter 2: the mock backend
  api/index.ts         picks one and exports `api`
```

Screens only ever write `import { api } from "@/lib/api"`.

- `API_BASE_URL` unset → the mock adapter. Nothing goes over the network.
- `API_BASE_URL` set → the HTTP adapter. `next.config.ts` rewrites `/api/*` to the
  gateway and tells the browser bundle which adapter to use.

Switching to the real backend is an environment change, and any screen that breaks has
found a contract mismatch.

**What the mock does.** Matches, the Seat Map and the already-sold seats are generated
from the Match id, so they are identical on the server and in the browser and on every
load. What belongs to this Fan (Holds, Orders, Tickets, sign-in) is kept in the browser's
`localStorage`, with `resetMockData()` to start again. It keeps the real rules so the UI
is honest: a Hold is 1–4 available Seats and expires after 480 s, a Fan never has more
than four Seats per Match, the Quote is fixed (Group Discount 0/5/10/15 % for Seats
together in one Row), a taken seat returns 409 with `conflictingSeatIds`, and the same
`Idempotency-Key` returns the same Order (422 if the request differs).

**Shapes the frontend fixed first** (deviation D-5):

- `GET /matches/{id}/seatmap` returns 120 Blocks, each with `rowSeats` (seats per Row),
  not one object per seat. Seat ids are derived: `<block>-R<row>-<seat>`.
- `GET /matches/{id}/seat-states` returns one string per Block, one character per Seat
  (`A`, `H`, `S`), and accepts `?blocks=101,102` to fetch only some Blocks.
- `GET /auth/session` returns `{ fanId, verified, mobile? }`.
- The mock's `POST /auth/otp/request` also returns `demoCode`, so the demo can show the
  code on screen. The real service prints it to its console and never returns it.

## 4. The 3D stadium

```
lib/domain/stadium.ts     how the 40 Blocks of a Level go around the bowl (12 / 8 / 12 / 8)
lib/stadium/layout.ts     where every Block, Row and seat is, in metres. Pure maths, tested
lib/stadium/geometry.ts   turns those numbers into meshes by sweeping a cross-section round the ring
lib/stadium/seats.ts      one transform and one colour per seat, in Seat States order
lib/stadium/mosaic.ts     the colour of each seat in stadium view: bands plus the three yellow marks
lib/stadium/mark-bitmaps.ts  the crest and the Spotify symbol as bitmaps (made by scripts/make-marks.py)
lib/stadium/view.ts       which view the Fan is in (stadium, Block, seat) and how to step between seats
lib/stadium/camera.ts     where the camera stands in each view, and how long a flight takes
lib/stadium/view-score.ts the view score of a seat (0 to 100) and its distance to the pitch
lib/stadium/minimap.ts    the outline of each Block seen from above, for the mini-map
lib/design/tokens.ts      the colours 3D code may use, checked against globals.css by a test
components/stadium/       the React Three Fiber scene: bowl, pitch, seats, camera rig, and the
                          StadiumExperience component that owns the view and the panel
```

The Seat Map says how many Rows and seats a Block has; `layout.ts` says where they are.
Terraces, seats and camera all read the same module, so a seat can never float off its
step. All 60,560 seats are one instanced mesh, and seat number `i` in that mesh is
character `i` of the Seat States strings read Block by Block, so recolouring a seat by
its state is a lookup, not a search. The canvas is loaded only in the browser and only on the seats page.

**Clicking a seat.** The 60,560 seats are left out of hit-testing. A click is tested
against the concrete steps (three meshes), and `layout.ts` turns the point that was hit
back into a Block, Row and seat, then checks the few seats around it against the line of
sight to pick the one actually aimed at. That is a handful of sums per click, where
testing every seat would be 60,000.

**Hovering** uses the same lookup as clicking, on every pointer move. The steps are
indexed in a tree (drei's `Bvh`) so each move costs a few dozen checks. The card beside
the pointer is moved by writing its position directly; React is only told when the
Block or seat under the pointer changes.

**The view score** is a guide, not a measurement: half distance to the centre spot, a
fifth height above it, the rest how side-on the seat is. When the backend returns a real
score, `view-score.ts` is the one file to replace.

**Seat States** for a Block are read in the browser when the Block is opened
(`GET …/seat-states?blocks=214`), and that Block's seats change from the mosaic to their
state colours.

## 5. Errors

Every failure is an RFC 9457 `ProblemDetail`. The client maps `type` to a message and an
action, never the HTTP status alone:

| `type` | UI |
|---|---|
| `/problems/seats-unavailable` | mark the conflicting seats, keep the rest selected |
| `/problems/hold-expired` | release the selection, return to Block view |
| `/problems/purchase-limit` | explain the limit of four |
| `/problems/booking-not-open` | show when booking opens |
| `/problems/not-signed-in` | open the sign-in step |
| `/problems/otp-invalid` | ask for the code again |
| `/problems/order-exists` | go to that Order |
| anything else | generic message with a retry |

Only `seats-unavailable` exists in ARCHITECTURE §11 today. The others are the names in
`lib/api/problem.ts`; the backend tickets confirm or rename them.

## 6. Contracts the frontend fixed first

Seat count, Block, Tier and seat id differ from the backend docs. See
[`FRONTEND-DEVIATIONS.md`](../process/FRONTEND-DEVIATIONS.md).
