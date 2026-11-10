# Glossary — the Ubiquitous Language

These words are **law**: use them in packages, classes, tables, Kafka topics, endpoints
and commit messages. Never use the synonym in the last column. A new term enters this
file in the **same PR** that introduces it.

## People

| Term | Meaning | Never say |
|---|---|---|
| **Fan** | A person who buys tickets and enters the stadium. | customer, user, buyer |
| **Admin** | Manages Matches, triggers Seat Map generation and warmup, reviews fraud. | operator |
| **Steward** | Scans Tickets at the gate. | scanner, guard |

## Match & catalog (`catalog`)

| Term | Meaning | Never say |
|---|---|---|
| **Match** | One football fixture that has seats to sell. | event, game, fixture (in code) |
| **Standings** | League table, mirrored from the external feed. | ranking |
| **Importance** | Match-level price multiplier (e.g. a derby or title decider costs more). | hype |
| **Final Score** | The result published when the Match finishes (`match.finished`). | result |

## Seats & inventory (`inventory`)

| Term | Meaning | Never say |
|---|---|---|
| **Seat Map** | All 5000 Seats of one Match, grouped into Sections, Rows and Blocks. | layout, venue map |
| **Section** | A part of a stand (e.g. `W-S03`); has one **Tier**. | zone, area |
| **Tier** | `STANDARD` or `VIP`. 1000 VIP seats per Match. | category, class |
| **Block** | The maximal span of Seats in a row between aisles (or an aisle and the section edge). Adjacency exists only inside a Block. | segment |
| **Seat** | One sellable place, id like `W-S03-R07-12`. | spot, place |
| **Seat State** | A Seat's live status in Redis: `A` (available), `H:<holdId>` (held), `S` (sold). | status, availability |
| **Seat Claim** | The durable Postgres record of a sold Seat (`seat_claims`, `SOLD` / `CANCELLED`); its partial unique index is the overselling backstop. | booking, sale row |
| **Warmup** | Rebuilding the Redis Seat State from Postgres (staging keys + `RENAME`). | sync, cache load |
| **Occupancy** | Counters `{available, held, sold}` per Match. | stats |
| **Hold** | A temporary, all-or-nothing lock on 1–4 Seats for one Fan, **Redis only**, TTL ~8 min. | reservation, lock, cart |
| **Run** | A contiguous span of free Seats inside one Block. | streak, range |
| **Orphan** | A free Run of length 1 left behind by an allocation — hard to sell. | gap, single |
| **Allocator** | Picks the best Run for "pick for me" (No-Orphan scorer + Lua `find_and_hold_run`). | picker, assigner |

## Pricing (`inventory/pricing`)

| Term | Meaning | Never say |
|---|---|---|
| **Quote** | Immutable, identified, expiring price for a Hold; issued at Hold time, never recomputed (ADR-0002). | estimate, cart total |
| **Group Discount** | 0% / 5% / 10% / 15% by position for up to 4 seats. | bulk discount |
| **Booking Velocity** | Holds per time window, computed by Kafka Streams in `catalog`. | traffic |
| **Demand Multiplier** | Step function of Booking Velocity, capped at 1.5×. | surge factor |
| **Time Decay** | Monotone, pre-published price drop for unsold seats as kickoff nears. | markdown |
| **Price Floor** | The minimum price; always wins last. | min price |
| **Yield** | Revenue actually realised from the Seat Map. | profit |

## Admission & identity (`gateway`, `identity`)

| Term | Meaning | Never say |
|---|---|---|
| **Verified Identity** | A Fan verified by OTP on a phone number; the unit for limits and queue slots. | account, user |
| **Device** | A Fan's bound phone/browser; receives the ticket secret. | client |
| **Purchase Limit** | Max 4 tickets per Verified Identity per Match, as a ledger with a DB `CHECK`. | quota |
| **Registration Window** | ~24 h before booking opens, when Fans join the Waiting Room. | pre-sale |
| **Waiting Room** | The queue at the gateway that turns the flash crowd into a steady stream. | queue page, lobby |
| **Draw** | Random shuffle of all registrants at open — position isn't decided by speed. | lottery, raffle |
| **Admission Token** | Signed, match-scoped token that lets a Fan create a Hold. | ticket, pass |
| **Checkout Grant** | Bound to a `holdId`, expires with the Hold; required for `POST /orders`. | session |
| **Bot Risk** | Advisory score (fingerprint + behaviour); adds friction, never hard-blocks. | bot flag |
| **Fraud Ring Detection** | Asynchronous graph analysis in `identity/riskgraph` after orders are confirmed. | fraud check |

## Orders & tickets (`ticketing`)

| Term | Meaning | Never say |
|---|---|---|
| **Order** | A purchase created from exactly one Hold (`UNIQUE(hold_id)`). | booking, purchase |
| **Payment Attempt** | One try at charging an Order; at most one `CAPTURED`. | payment, transaction |
| **Idempotency Key** | Client-sent key on `POST /orders`; a repeat returns the identical response. | request id |
| **Confirmation Saga** | Orchestrated steps that turn a Hold + payment into Tickets, with compensations. | checkout flow |
| **Outbox** | Table written in the same transaction as the state change, then relayed to Kafka. | event queue |
| **Ticket** | The right of one Fan to enter for one Seat. | pass |
| **Credential Class** | `APP` (rotating, device-bound) or `PRINT` (static, signed). | ticket type |
| **Rotating Credential** | The in-app QR: `ticketId \| counter \| HMAC`, changes every 30 s. | QR code |
| **Print Credential** | The static, signed code in a PDF; Steward does an ID check. | barcode |
| **Ticket Document** | The generated PDF stored in S3/MinIO. | ticket file |
| **Scan Ledger** | First-scan-wins record at the gates (`SETNX scan:{ticketId}`). | entry log |
| **Dispute** | A second scan of an already-used Ticket; shows gate + time of first entry. | conflict |
| **Resale** | Zero-margin resale on the platform at the original price; rotates the credential. | resell, transfer |
| **Souvenir** | A finished Match's Ticket turned into a keepsake with the Final Score. | memento |
