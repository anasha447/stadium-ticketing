# Design — How Each Problem Is Solved

The six problems that drive the design, the product rules, and the advanced
capabilities. Tags **(RF-xx)** mark fixes from the 2026-11-09 architecture review (the
full review is in git history). Key names follow [DATA-MODEL.md](DATA-MODEL.md).
Sections marked **⭐ Stretch** are beyond the M3 finish line (see ROADMAP).

| § | Problem | Core mechanism |
|---|---|---|
| 1 | Flash crowd | Waiting Room + Draw + Admission Token |
| 2 | Double-booking | Redis+Lua atomic arbiter, Postgres partial unique index backstop |
| 3 | Abandoned holds | TTL is the clock of record + sweeper for UX |
| 4 | Duplicate payments | `UNIQUE(hold_id)`, Idempotency-Key, Confirmation Saga, Outbox |
| 5 | Scalping | zero-margin resale, Purchase Limit on Verified Identity, Draw |
| 5b | QR copying | Rotating Credential, device binding, first-scan-wins |
| 6 | Adjacent seats | per-Block bitmaps, Run search, No-Orphan scorer |
| 7 | Pricing | pure pricing module, immutable Quote |
| A | Advanced | seat geometry and the No-Orphan rule |
| B–D | ⭐ Stretch | demand pricing, fraud graph, PDF tickets |

---

## 1. Flash crowd — admission control, not autoscaling

Four layers, outermost first:

1. **Waiting Room (gateway).** A **Registration Window** opens ~24 h before
   `bookingOpensAt`. One slot per **Verified Identity** — 50 tabs get one position.
   At open, a **Draw** shuffles all registrants into a Redis sorted set. The admission
   filter pops the head at a *measured* rate (start 200/s; tune from p99 latency and
   Hikari saturation) and issues a signed **Admission Token** (scoped to the match).
   - The token is required for `POST /matches/{m}/holds`. A successful Hold returns a
     **checkout grant** bound to `holdId` that expires with the Hold; `POST /orders`
     requires the grant, not the token. **(RF-07)**
   - 50,000 arrivals become a constant 200/s stream; 1250 buyers clear in minutes.
   - The Draw removes the bot advantage of being fastest at T-0.
   - **Why a random Draw is fair.** Fairness here means *equal odds per person*, not
     *reward for speed*. First-come-first-served looks fair but rewards whoever is
     milliseconds faster: bots, data-centre connections, people with 20 tabs. The Draw
     gives every Verified Identity that registered inside the Registration Window exactly
     one entry and the same chance, so arriving at T-0 or T-23h makes no difference.
     This is how Ticketmaster's Smart Queue and the UEFA/FIFA ticket ballots work.
     A weighted Draw (members or loyal Fans first) is a possible extension (Icebox).
2. **Read path never touches the write path.** Match lists, seat-map snapshots,
   standings, weather and scores come from Redis/CDN with stale-while-revalidate.
   Seat changes reach browsers as **deltas over SSE**, never polling.
3. **Bulkheads and deliberate scarcity.** Resilience4j rate limiter + bulkhead per route;
   Hikari pools small (~20) so Postgres is never the component that fails. Queue depth
   is the backpressure signal.
4. **No Postgres writes on the hot path.** Holds live only in Redis.

## 2. Double-booking — Redis is the fast arbiter, Postgres the final one

- Seat state per match: hash `match:{m}:seats`, value `A` | `H:<holdId>` | `S`.
- **Lua `hold_seats`** takes all requested seats and either flips *all* `A → H:<holdId>`
  or returns the conflicts. Redis runs Lua atomically on its single thread → no
  interleaving, and **all-or-nothing group holds** in one round trip.
  The same script updates Block bitmaps and occupancy counters (O(1) Admin heatmap).
- **Durable backstop:** `seat_claims` with
  `UNIQUE (match_id, seat_id) WHERE status = 'SOLD'`, written in **inventory's** confirm
  transaction. If the index fires, the sale is rejected and Redis repaired.
  A lost Redis is a performance incident, not an overselling incident.
- Redis arbiter: own instance, AOF `everysec` + replica. Cold start warms from Postgres.
- **All keys a script touches share the `match:{m}` hash tag and are passed in `KEYS[]`.** **(RF-02)**

**Rejected alternatives (interview material):**

| Option | Why not |
|---|---|
| `SELECT … FOR UPDATE` | 4 seats × thousands of concurrent requests → lock convoys, connection exhaustion |
| `SETNX` per seat | not atomic across 4 seats → half-acquire and roll back → phantom unavailability |
| `@Version` optimistic locking | correct, but retry storms under heavy contention on hot seats; fits low-contention updates (Order status) |

## 3. Abandoned holds — TTL is the clock of record

1. **Lazy expiry (correctness).** `match:{m}:hold:<h>` has TTL 480 s. A seat whose value
   names a hold with no live key **is available** — every read and every script treats it
   so. No sweeper is needed for correctness.
2. **Active release (UX).** ZSET `match:{m}:holds:expiring` scored by expiry epoch.
   A sweeper (1 s tick, one pod via ShedLock) runs `release_hold` for expired members and
   emits `hold.expired` → seats turn green in every browser within ~1 s.
   Keyspace notifications are best-effort, so they are not used.
3. **`hold.expired` on Kafka** → `ticketing` cancels any in-flight Order.

Occupancy counters are accurate to within one sweep tick. **(RF-16)**
TTL ~8 min with a visible countdown; one extension only if no one else is queued for those seats.

## 4. Duplicate payments — structurally impossible

- `UNIQUE (hold_id)` on `orders` — one Hold yields at most one Order.
- Payments are **attempts**: one Order → N `payment_attempts`, at most one `CAPTURED`.
  A declined card can retry inside the same Hold. **(RF-06)**
- **Idempotency-Key** required on `POST /orders` (defaults to `holdId`). Stored with the
  serialized response: a repeat returns the identical response; same key + different
  body → 422. The same key is forwarded to the PSP.
- Kafka consumers dedupe on `(consumer_group, message_key)` in `processed_messages`.
- The disabled UI button is cosmetic, never the mechanism.

### Confirmation Saga (orchestrated by ticketing) **(RF-03)**

```
 ticketing                         inventory                  identity
 ─────────                         ─────────                  ────────
 1. create Order (PENDING)
 2. reserve Purchase Limit ─────────────────────────────────▶ reserve (idempotent on orderId)   [RF-11]
 3. authorize payment (PSP, idem key)
 4. confirm seats ───────────────▶ Lua confirm_sold (H→S)
                                   + local tx: seat_claims SOLD
                                     + outbox(seat.sold)
 5. local tx: Order CONFIRMED + capture
    PaymentAttempt + Tickets + outbox(order.confirmed)
```

| Fails at | Compensation |
|---|---|
| 2 | Order → FAILED |
| 3 (declined) | release limit; Order stays PENDING for a retry attempt while the Hold lives |
| 4 (hold expired / index fired) | void authorization, release limit, Order → FAILED |
| 5 | `unconfirm` seats (claim → CANCELLED, seat → A), void, release limit |

Capture happens only in step 5, so **"charged but no ticket" cannot occur.**
The saga state is persisted (`saga_instances`) so a crashed pod resumes, not restarts.

## 5. Anti-scalping — remove the margin, then add friction

Ranked by real effect:

1. **Zero-margin Resale** (⭐ Stretch) through the platform at original price; listing rotates the
   credential, killing copies in circulation. Scalping stops being profitable.
2. **Purchase Limit on Verified Identity** (OTP phone; in this project a **fake OTP** — the code is printed by a console adapter, no SMS is sent), ledger keyed by
   `(verified_phone_hash, match_id)` with a DB `CHECK`. A 5th ticket costs a new SIM.
3. **Draw instead of first-come-first-served** — 40 ms faster is worth nothing.
4. **Turnstile / proof-of-work** at registration. ⭐ Stretch
5. **Gateway rate limits** per identity, Device, ASN (sliding window). IP is a weak signal.
6. **Bot Risk score** (fingerprint + behaviour) — advisory, adds friction, never hard-blocks. ⭐ Stretch
7. **Post-hoc Fraud Ring Detection** (capability C). ⭐ Stretch

The 4-seat cap is enforced in three independent places: pricing rejects >4, Lua rejects
>4 across the Fan's live holds, and the Purchase Limit ledger across orders and accounts.

## 5b. QR screenshots — a static QR is a bearer token

- **Rotating Credential:** QR = `ticketId | counter | HMAC(ticketSecret, counter)`,
  counter = 30 s window (TOTP-shaped). Scanners validate **offline** against a
  per-match key bundle.
- **Device binding:** `ticketSecret` goes to one bound Device; re-issue invalidates the
  previous one (rate-limited, logged).
- **Scan Ledger, first scan wins:** `SETNX scan:{ticketId}`; any later scan is a
  **Dispute** showing gate + time of first entry.
- **Eyeball layer:** Fan name + server-seeded animated motif on screen.

## 6. Four adjacent seats + Group Discount

- **Adjacency exists only inside a Block** (seats between aisles). One Redis bitmap per
  Block, `match:{m}:block:<b>`, bit index = `position_in_block`. **(RF-04)**
- Two UX modes: **pick for me** (quantity + preference → Allocator, capability A) and
  **choose on map** (explicit seat ids; validated as contiguous if a Group Discount is claimed).
- **Group Discount** is a pure function of position: 0% / 5% / 10% / 15%, max 4 seats.

## 7. Pricing (module inside inventory)

```
unit    = basePrice(tier, section) × importance(match) × min(demand, SURGE_CAP)
price   = max(unit × timeDecay(hoursToKickoff), PRICE_FLOOR)
line_i  = round(price × (1 − groupDiscount(i)))          i = 1..4
```

- Composition order is fixed: surge **before** decay; floor wins last. A surge never
  cancels the final-hours discount.
- **Time Decay** applies to unsold inventory only, monotone, published in advance.
- **A Quote is immutable, identified, expiring** — issued at Hold time, TTL = Hold TTL,
  stored in Redis. The Order copies the Quote's amounts; nothing recomputes a price at
  payment time.
- `price.changed` → cache → SSE delta.

---

## A. Spatial geometry & the No-Orphan rule (inventory, EP-3)

- **Block** = maximal span of seats between aisles (or aisle and section edge).
- **Orphan** = a free Run of length 1 inside a Block *after* an allocation
  (incl. a single seat against an aisle, or between two occupied spans).
- The scorer is a **soft constraint**: if every option creates an Orphan, the allocation
  still succeeds — otherwise the last seats become unsellable and **Yield** drops.

**Ranked-candidate protocol** (keeps Lua small, keeps the choice atomic):

1. Java scores candidate Runs against a cached Block projection → top ~5, ranked by
   fits request → no Orphan → row centre → tier fit. Each candidate carries
   `orphanAllowed` (true only for fallback candidates).
2. Lua `find_and_hold_run` walks the list; for the first candidate whose bits are all
   free, it does a **local orphan check** (bits at `start-1`, `start-2`, `end+1`,
   `end+2`, and Block edges). If the candidate would now create an Orphan and
   `orphanAllowed` is false, it skips to the next. Otherwise it holds atomically.
3. All candidates gone → miss → Java re-scores (max 3 attempts) → 409.

## B. ⭐ Stretch — Event-driven dynamic pricing (catalog topology → inventory, EP-4)

- Kafka Streams in `catalog` consumes `seat.held` + `hold.expired`, keyed by `matchId`,
  hopping window 60 s / advance 10 s → **Booking Velocity** → step function →
  **Demand Multiplier**, `suppress`ed so it emits only on bucket change.
  Output: `demand.multiplier.changed`.
- `inventory` caches it as one Redis scalar per match; pricing reads it as an **input**.
- Why catalog: Streams brings RocksDB, rebalancing and new failure modes; the hot path
  must stay boring.
- **Guardrails (mandatory):** published cap ≤ 1.5×, Price Floor wins, surge before decay,
  no Quote or Order ever repriced. Recommended: surge on VIP only, disclosed in the UI.

## C. ⭐ Stretch — Asynchronous Fraud Ring Detection (identity `riskgraph/`, EP-7)

- Off the transactional path; consumes `order.confirmed`.
- Graph: `(:Fan)`, `(:PaymentInstrument)`, `(:Device)`, `(:IpSubnet)`, `(:Order)`, `(:Match)`.
- **Compliance:** never store card numbers — key on the PSP's payment-method
  fingerprint. IPs as hashed `/24` + ASN with retention.
- Detection: fan-out queries first, then connected components / Louvain (Neo4j GDS).
  Emits `fraud.ring.detected`.
- **Human in the loop:** score → Admin review → auto-cancel only above high confidence
  and only before matchday. Cancellation reuses the Resale recycling path.

## D. ⭐ Stretch — Downloadable PDF tickets (ticketing, EP-8)

A PDF is a static bearer token, so the rotating code never goes in it.

- **Credential Class:** `APP` (rotating, device-bound) and `PRINT` (static, signed).
  Both resolve to the same Ticket and Scan Ledger → first-scan-wins still holds.
- `PRINT` scans prompt the Steward for an **ID check**.
- `Match.printAllowed` lets big matches be app-only.
- Resale rotates and invalidates **both** classes.
- Pipeline: `order.confirmed` → consumer → Thymeleaf → PDF → MinIO/S3 →
  `ticket.document.ready` → API returns a short-lived pre-signed URL.
  Idempotent on `UNIQUE (ticket_id, credential_class)`.

## ⭐ Stretch — Souvenir tickets

`match.finished{finalScore}` → `ticketing` projects every SOLD/USED Ticket into a
**Souvenir** (final score, attendance, kickoff weather) and retires the credential.
Rebuildable from events. Re-rendered through the same PDF pipeline.
