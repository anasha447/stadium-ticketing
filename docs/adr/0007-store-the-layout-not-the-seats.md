# ADR-0007 — Postgres stores the layout, not the Seats

- **Status:** Accepted
- **Date:** 2026-11-16

The stadium is the one the frontend draws: 60,560 Seats in 120 Blocks on three Levels
(D-1 in `FRONTEND-DEVIATIONS.md`). Postgres does not get one row per Seat. It gets one
row per Block, with the number of Seats in each Row (`blocks.row_seats INT[]`), and a
Seat is valid when its Block exists and its Row and number fit that array. The only
per-Seat rows are Seat Claims, written when a Seat is really sold. This updates the
numbers in ADR-0001 (5,000 Seats, ~1,250 sales) to 60,560 Seats and at least 15,140
buyers; its decision, Redis as the arbiter with Postgres as the backstop, is unchanged.

## Considered options

| Option | Why not |
|---|---|
| Keep 5,000 Seats in the backend, the frontend draws 60,000 | the UI and the API would describe two different stadiums; every Seat id the frontend sends past the first 5,000 would be unknown |
| Create a Seat row the first time a Fan books it | it writes Postgres on the hold path, which the design forbids; two Fans can create the same Seat at once; and checking that an id is real still needs the whole layout |
| One `seats` row per Seat (60,560 per Match) | works and is cheap enough, but stores 60k rows that never change and that the layout already describes; Postgres would see the stadium, not just the sales |

## Consequences

- Generating a Seat Map is 120 inserts, not 60,560. The batching lesson moves to Warmup
  and to Seat Claims.
- A Seat Claim has a foreign key to its Block, not to a Seat. The database checks that
  the Seat id names its Block; Java checks that the Row and number fit.
- `SeatMap.contains(seatId)` and `SeatMap.offsetOf(seatId)` are pure domain code, used
  by every hold request and every Lua call.
- A bigger stadium (say 100,000 Seats) is more numbers in `row_seats`, not more rows.
