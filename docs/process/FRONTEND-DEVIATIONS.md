# Frontend deviations

Choices made on the F-track (ADR-0006) that do not match the backend docs yet. The
frontend and `GLOSSARY.md` already follow the "Frontend choice" column. When backend
work resumes, each row is resolved by editing the named docs and tickets, then marked
done here.

| # | Frontend choice | Backend docs today | Where to edit | Done |
|---|---|---|---|---|
| D-1 | About 60,000 bookable Seats per Match: 3 Levels × 40 Blocks | 5,000 Seats, 1,000 VIP; "5000 ÷ 4 ≈ 1250 buyers" shapes the design | CLAUDE.md intro, ARCHITECTURE §1, DESIGN, TKT-104, k6 targets (TKT-804, 1204) | ☐ |
| D-2 | **Block** = a numbered group of Seats (101–140, 201–240, 301–340). **Row** = one row of Seats inside a Block. Seats are adjacent only inside one Row. Section is gone | Block = the run of Seats in one row between aisles (`block_id` like `W-S03-R07-B1`); Section groups rows | DATA-MODEL (`blocks`, `seats`, Redis `block:<id>` bitmaps), TKT-104, TKT-301, TKT-302 | ☐ |
| D-3 | Four **Tiers**: Club Premium, Category 1, Category 2, Category 3. New term **Level**: lower, club, upper | Tier is `STANDARD` or `VIP`; `vip_count` column | DATA-MODEL (`tier` CHECK, `vip_count`), TKT-104, TKT-303 | ☐ |
| D-4 | Seat id `<block>-R<row>-<seat>`, e.g. `214-R07-12` | `W-S03-R07-12` (stand, section, row, seat) | DATA-MODEL, ARCHITECTURE §11 example, TKT-105 | ☐ |
| D-5 | Compact responses: the Seat Map is 120 Blocks with `rowSeats`; Seat States are one string per Block (`A`/`H`/`S`), with `?blocks=`; problem type names in `lib/api/problem.ts` | Seat Map as sections → rows → seats; one state per seat; only `seats-unavailable` named | ARCHITECTURE §11, TKT-105, TKT-203, TKT-204 | ☐ |
| D-6 | Waiting Room status as one shape with four phases (`NOT_JOINED`, `WAITING`, `QUEUED`, `ADMITTED`), sent over the position stream and also readable once at `GET /waiting-room/{id}/status`; 403 `/problems/not-admitted` on Holds | only `register` and the `position` stream are listed; no payload shape; no one-shot read | ARCHITECTURE §11, TKT-605, TKT-701 | ☐ |
| D-7 | The Match stream sends a named event `seat-delta` with `{ state: "A"\|"H"\|"S", seatIds: [...] }`, one event per state change batch; there is no sequence number, so the client reads the full Seat States on every `open` (including reconnects) and re-applies recent deltas on top. The stadium page counts "seats left" from Seat States instead of calling occupancy | `GET /stream/matches/{id}` is listed as "seat deltas" with no payload shape, no event name, and nothing said about reconnects | ARCHITECTURE §10–11 (`seat.held`, `seat.released`, `seat.sold` become one `seat-delta` shape), TKT-802 | ☐ |

## Decided in favour of the backend (no deviation)

- A Hold is 1–4 Seats; the "Your seats" drawer never holds more than four.
- The total shown is always the Quote. No service fee.
- Sign-in is the fake one-time code; Orders and Tickets come from the API.
- Currency is EUR.
- The Waiting Room and Draw come before the stadium.

## Notes for D-1

With 60,000 Seats and four per Fan, a Match has about 15,000 buyers instead of 1,250.
The argument "Postgres only sees the real sales" still holds, but the numbers in the
load tests and the interview story change.
