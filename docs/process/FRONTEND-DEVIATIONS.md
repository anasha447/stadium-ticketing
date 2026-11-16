# Frontend deviations

Choices made on the F-track (ADR-0006) that did not match the backend docs. All of them
were resolved into the backend docs on 16 Nov 2026 (issue #39), so the backend now
follows the "Frontend choice" column, with the changes noted under "How it was
resolved". The second table lists what goes the other way: backend decisions the
frontend adopts once the backend is done.

| # | Frontend choice | How it was resolved | Done |
|---|---|---|---|
| D-1 | About 60,000 bookable Seats per Match: 3 Levels × 40 Blocks | Adopted exactly: 60,560 Seats. Postgres stores the 120 Blocks, not the Seats (ADR-0007). The crowd is now up to 100,000 Fans with at most 10,000 admitted at once (ARCHITECTURE §1, DESIGN §1) | ☑ |
| D-2 | **Block** = a numbered group of Seats (101–340). **Row** = one row of Seats inside a Block; Seats are adjacent only inside one Row. Section is gone | Adopted. `blocks` table with `row_seats`; the Run search works on Rows; Section removed everywhere (DATA-MODEL §2, DESIGN §6 and A, TKT-301/302) | ☑ |
| D-3 | Four **Tiers** per Block; new term **Level** | Adopted, with new names: Club Premium, VIP 1, VIP 2, Standard (GLOSSARY). Tier lives on the Block. Base Price per Tier from config, plus a per-Match Price Override (TKT-703) | ☑ |
| D-4 | Seat id `<block>-R<row>-<seat>`, e.g. `214-R07-12` | Adopted everywhere; unique per Match, key `(match_id, seat_id)` | ☑ |
| D-5 | Compact Seat Map (120 Blocks with `rowSeats`) and Seat States (one string per Block, `?blocks=`); problem type names in `lib/api/problem.ts` | Adopted. Redis stores Seat States in that same shape (ADR-0008). All problem types listed in ARCHITECTURE §11, plus `no-run-available` and `price-locked` | ☑ |
| D-6 | Waiting Room status with four phases, on the stream and at `GET /status`; 403 `not-admitted` on Holds | Adopted (ARCHITECTURE §11, TKT-701/702). `admissionExpiresAt` now moves with the idle rule | ☑ |
| D-7 | One `seat-delta` SSE event `{ state, seatIds }`; full Seat States read on every `open` | Adopted for SSE; Kafka keeps `seat.held`, `seat.released` and `seat.sold` as separate topics. Reconnects and ordering are designed in TKT-801 | ☑ |
| D-8 | `POST /orders` → 401 `not-signed-in`, 409 `order-exists` with `orderId` | Adopted (ARCHITECTURE §11). The one-time code moved to TKT-604 so the M2 checkout can sign in | ☑ |
| D-9 | Occupancy carries counters per Block (`blocks: { "101": {available, held, sold} }`) for the Tier list and "seats left" | Adopted: the same scripts keep per-Block counters (DATA-MODEL §1, TKT-106) | ☑ |

## The frontend adjusts after the backend is done

Decided on 16 Nov 2026; nothing here changes in `frontend/` until the backend is built.

| What | Why | Where |
|---|---|---|
| Tier names become `CLUB_PREMIUM`, `VIP_1`, `VIP_2`, `STANDARD` (were Club Premium, Category 1, 2, 3) | the new names in GLOSSARY | `lib/domain/types.ts`, `tierOf`, the Tier legend and its colours, mock tests |
| "Time left to choose": show `admissionExpiresAt` on the stadium page, warn at 1 minute, back to the Waiting Room at zero | the 10-minute idle rule and 30-minute ceiling (DESIGN §1) | stadium page, mock Waiting Room |
| "Pick seats together" calls `mode=ADJACENT` instead of choosing in the browser | the server picks and holds atomically and avoids Orphans | `lib/booking/selection.ts`, TKT-802 |
| A Seat can show `H` for up to ~2 s after its Hold expired | the read path no longer applies lazy expiry (ADR-0008) | nothing to change; noted so it is not reported as a bug |
| Bought Tickets count towards four Seats per Match only in the UI until TKT-1003 | the backend cap counts live Holds until the Purchase Limit ledger exists | nothing to change before Sprint 10 |

## Decided in favour of the backend (no deviation)

- A Hold is 1–4 Seats; the "Your seats" drawer never holds more than four.
- The total shown is always the Quote. No service fee.
- Sign-in is the fake one-time code; Orders and Tickets come from the API.
- Currency is EUR.
- The Waiting Room and Draw come before the stadium.
