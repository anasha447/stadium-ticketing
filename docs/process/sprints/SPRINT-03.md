# Sprint 3 — Adjacency, Price & Events

| | |
|---|---|
| **Sprint goal** | A Fan can ask for "4 seats together" and get the best Run without leaving Orphans; every Hold comes with an immutable, correctly priced Quote; hold lifecycle events reach Kafka. |
| **Dates** | Dec 9 – Dec 22, 2026 |
| **Capacity** | 24 points · **Milestone** M1 Bookable Core |
| **Status** | Outline-level detail — refine with `/grill-with-docs` at Sprint 3 Planning |

| Rank | Ticket | Issue | Title | Pts | Depends on |
|---|---|---|---|---|---|
| 1 | TKT-301 | — | Run search + No-Orphan scorer (pure, property-tested) | 5 | TKT-201 |
| 2 | TKT-302 | — | Seats together: ranked candidates held atomically | 8 | TKT-301, TKT-204 |
| 3 | TKT-303 | — | Pure pricing module | 5 | — |
| 4 | TKT-304 | — | Immutable Quote with every Hold | 3 | TKT-303, TKT-204 |
| 5 | TKT-305 | — | Kafka + `contracts` + hold lifecycle events | 3 | TKT-205 |

---

## TKT-301 — Run search + No-Orphan scorer (pure, property-tested)

**Goal** — For a Fan asking for k Seats together, the system ranks the best available Runs
and avoids leaving single unsellable Seats.

**Why** — Rich policy lives in pure Java where it can be property-tested; Lua only verifies
and holds (DESIGN §A).

**Acceptance criteria**
- Example: in a Block `[x . . . . x]`, k = 2 → the best Run leaves no single free Seat.
- In a Block `[x . . x]`, k = 1 → an Orphan is unavoidable, and a candidate is still
  returned, marked as allowed to leave one (soft constraint).
- For random Blocks of 1–40 Seats, random fill and k of 1–4: every candidate is contiguous,
  of length k, inside one Block, on free Seats only; if any orphan-free placement exists,
  the first candidate is orphan-free.
- No Spring or Redis in this code.

**Learning focus** — property-based testing with jqwik (generators, shrinking) · soft vs
hard constraints · Yield · why scoring stays out of Redis.

**Points** 5 · **Depends on** TKT-201

---

## TKT-302 — Seats together: ranked candidates held atomically

**Goal** — "Pick 4 seats together for me" returns adjacent Seats in one request, even while
hundreds of others pick at the same time.

**Acceptance criteria**
- The result is k contiguous Seats in one Block, all in the new Hold.
- 200 concurrent requests on a nearly full Section: no Seat is held twice; every success is contiguous.
- A candidate taken between ranking and holding is skipped in favour of the next one.
- When no orphan-free Run is left, the request still succeeds with an allowed-Orphan candidate.
- Nothing available → 409 problem `no-run-available` after at most 3 attempts.
- The Fan cap applies exactly as for explicit Seats.

**Learning focus** — optimistic read + atomic verify (the idea behind compare-and-set and
`@Version`) · bounded retry · Redis bitmaps.

**Points** 8 · **Depends on** TKT-301, TKT-204

---

## TKT-303 — Pure pricing module

**Goal** — Seat prices follow published rules — Tier, Importance, demand, Time Decay,
Group Discount — and never go below the Price Floor.

**Acceptance criteria**
- A table of at least 30 cases (Tier × Importance × demand × hours to kickoff) passes.
- Demand above 1.5× is capped at 1.5×.
- A surge never cancels Time Decay.
- The Price Floor wins when decay would go below it.
- Group Discount ladder: Seat 1 = 0 %, 2 = 5 %, 3 = 10 %, 4 = 15 %; 5 Seats rejected.
- Property: the price never rises as kickoff gets closer (demand fixed).
- Money is calculated with `BigDecimal`, rounded HALF_EVEN once per line.

**Notes** — Importance and demand come through a signals port with a constant adapter
until Sprint 9 (two adapters over time → a real port, ADR-0005).

**Learning focus** — table-driven tests from CSV · keeping a pricing engine pure · the
`BigDecimal.equals` scale trap · how Jackson 3 writes `BigDecimal`.

**Points** 5 · **Depends on** —

---

## TKT-304 — Immutable Quote with every Hold

**Goal** — The price a Fan sees when holding Seats is exactly the price they pay (ADR-0002).

**Acceptance criteria**
- Every hold response contains a Quote whose total equals the sum of its lines.
- Changing price rules after a Quote was issued does not change that Quote.
- A Quote expires with its Hold (404 afterwards); `GET /matches/{m}/quotes/{q}` returns it before.
- If the Hold succeeds but storing the Quote fails, the Hold is released and the request
  fails — no Hold without a price.

**Learning focus** — an immutable value with a lifetime tied to another key · compensating
an earlier step when a later one fails (the saga idea, in miniature).

**Points** 3 · **Depends on** TKT-303, TKT-204

---

## TKT-305 — Kafka + `contracts` + hold lifecycle events

**Goal** — Other services learn when Seats are held, released or expire.

**Acceptance criteria**
- Kafka (KRaft, pinned version, healthcheck) runs in Compose.
- A `contracts` module with no Spring dependency holds the event records, each with a
  schema version, event id, time and Match id; each round-trips through JSON.
- A Hold → one `seat.held` event keyed by Match id; an expiry → exactly one `hold.expired`.
- With Kafka down, Holds still succeed and a failure counter increases (best-effort).

**Learning focus** — partitions, keys and ordering · producer idempotence and `acks` ·
at-most-once vs at-least-once · why these events skip the Outbox.

**Points** 3 · **Depends on** TKT-205

---

## Daily log

| Date | Done | Next | Blocked |
|---|---|---|---|
| | | | |

## Sprint Review

## Retrospective

| Keep | Change | Try |
|---|---|---|
| | | |
