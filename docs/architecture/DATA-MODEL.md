# Data Model

Postgres schemas per service, Redis keys, and Lua script contracts.
Inventory is detailed (it is being built now); other services are sketches that get
detailed in their sprint.

---

## 1. Redis — inventory arbiter (`redis-inventory`)

### Hash-tag rule (RF-02)

Every key a Lua script touches **starts with `match:{<matchId>}:`**. Redis Cluster hashes
only the text inside the first `{…}`, so all keys of one match live in one slot and a
script can touch them all. Below, `{m}` is the literal hash tag around the match id;
`<x>` is a plain placeholder.

Example: `match:{42}:hold:7f3a…` — hashes on `42`.

### Seat States are stored in the shape the API returns (ADR-0008)

Each Block has one string with one character per Seat: `A` available, `H` held,
`S` sold. Rows run front to back and Seats left to right, the same order as the Block's
`row_seats` in Postgres and `rowSeats` in the Seat Map response. So `GET seat-states`
is one `MGET` of 120 keys, and character `i` of a Block's string is Seat `i` of that
Block in the frontend's instanced mesh.

Where a Seat sits in its Block's string is pure arithmetic on `row_seats`
(`SeatMap.offsetOf(seatId)` in Java). Lua never works it out: it receives the offset.

| Key | Type | Value | Written by | Purpose |
|---|---|---|---|---|
| `match:{m}:states:<blockId>` | string | one `A`/`H`/`S` per Seat of the Block (≈ 300–840 chars) | warmup, all scripts | **authoritative Seat State**; the read path and the Run search read it as is |
| `match:{m}:seat-holds` | hash | seatId → holdId, only for Seats now `H` | hold, release, confirm scripts | which Hold has a held Seat |
| `match:{m}:hold:<holdId>` | hash + **TTL** | `fanId`, `seatIds`, `quoteId`, `createdAt`, `expiresAt` | `hold_seats`, `find_and_hold_run` | the Hold itself |
| `match:{m}:holds:expiring` | zset | holdId → expiry epoch ms | hold scripts | **the clock of record** and the sweeper's work list |
| `match:{m}:occupancy` | hash | `available`, `held`, `sold`, and `<blockId>:available`, `<blockId>:held`, `<blockId>:sold` for each Block | warmup, all scripts | O(1) Occupancy, for the Match and per Block (D-9) |
| `match:{m}:fan:<fanId>:holds` | set | holdIds | hold scripts | 4-seat cap per Fan across live Holds |
| `match:{m}:quote:<quoteId>` | hash + TTL | quote lines, total, currency | Quote service | immutable Quote |
| `match:{m}:demand` | string | multiplier | demand consumer | pricing input (⭐ stretch) |
| `matches:active` | set | matchIds with live Holds | inventory adapter, **after** a successful script (no hash tag → never touched inside Lua) | sweeper iteration |

Size of one Match: 120 strings, 60,560 characters in all, about 60 KB. The read path
copies them into the response; nothing is assembled per Seat.

**Lazy expiry without building keys.** A Seat that is `H` belongs to the holdId in
`seat-holds`. The script looks that holdId up with `ZSCORE` on `holds:expiring` (a key it
was given) and compares the score with `nowMs` from the caller. Past it, the Seat counts
as `A` for this script. The script never has to build `match:{m}:hold:<otherId>`.

**The read path does not apply lazy expiry.** An expired Seat stays `H` in its string
until the sweeper releases it, about 2 s later (TKT-205). Holding is still correct at
every moment, because the hold scripts apply lazy expiry. A colour that is up to two
seconds stale is the same trade as the best-effort `seat.held` event.

**Warmup and its staging keys (RF-17).** Warmup writes `match:{m}:states:<b>:staging`
for all 120 Blocks and `match:{m}:occupancy:staging`, then renames all 121 of them inside
**one `MULTI`/`EXEC`**. Every key shares the `{m}` slot, so a reader sees either the old
map or the new one, never a mix. Warmup also clears `seat-holds`, `holds:expiring` and
the Fan hold sets: Holds live only in Redis, so after a Warmup there are none. Run it
when Redis has lost the map or before booking opens, never during a sale.

### Lua script contracts

| Script | KEYS | ARGV | Returns |
|---|---|---|---|
| `hold_seats.lua` | occupancy, expiring, seat-holds, hold, fanHolds, state keys… | holdId, fanId, ttlMs, nowMs, maxSeats, then triples `seatId, stateKeyIndex, offset` | `{1}` held · `{0, conflictSeatIds…}` · `{-1, "CAP", currentSeats}` |
| `release_hold.lua` | occupancy, expiring, seat-holds, hold, fanHolds, state keys… | holdId, fanId, reason, then triples | `{1}` released · `{0}` already gone |
| `find_and_hold_run.lua` | as `hold_seats` | holdId, fanId, ttlMs, nowMs, then candidates `stateKeyIndex, rowOffset, rowLength, start, length, orphanAllowed, seatIds…` | `{1, candidateIndex}` · `{0}` miss |
| `confirm_sold.lua` | occupancy, expiring, seat-holds, hold, fanHolds, state keys… | holdId, nowMs, then triples from the Hold's Seats | `{1, seatIds…}` · `{0, "EXPIRED"}` |
| `unconfirm.lua` | occupancy, state keys… | then triples | `{1}` |

Script rules:
- Lua **never builds key names**: every key arrives in `KEYS[]`.
- Lua never works out an offset: Java computes it from the layout and passes it.
- A Seat that is `H` whose Hold's `holds:expiring` score is ≤ `nowMs` counts as `A`.
- `release_hold` only frees Seats whose `seat-holds` entry is exactly its own holdId
  (idempotent, safe to race with the sweeper).
- Every change to a character also changes the Match counters and that Block's counters.
- No unbounded loops; input size is bounded (≤ 4 Seats, ≤ 5 candidates).

## 2. Postgres — inventory (`inventory_db`)

The complete inventory schema, designed up front. Each table is **created** by the
ticket that first tests it (TDD rule 6), so the Flyway version is noted on each one.

Postgres stores the **layout**, not the Seats (ADR-0007): 120 Block rows per Match, each
with its seats per Row. A Seat exists when its Block exists and its Row and number fit
`row_seats`; that check is pure Java (`SeatMap.contains(seatId)`). The only per-Seat rows
are Seat Claims, one per real sale, so Postgres sees only the sales.

**The stadium** (every Match has the same one, from the frontend's mock layer):

| Level | Blocks | Rows | Seats per Row, front → back | Seats per Block |
|---|---|---|---|---|
| `LOWER` | 101–140 | 24 | 18 → 24 | 504 |
| `CLUB` | 201–240 | 12 | 22 → 25 | 282 |
| `UPPER` | 301–340 | 28 | 22 → 30 | 728 |

Rows in between grow evenly: `round(front + (back − front) × row / (rows − 1))`. Total:
**60,560 Seats**. Blocks go clockwise round the bowl from the west side, 12 / 8 / 12 / 8
per side (west, north, east, south). Tier by position:

| Level | Long side (west, east), middle | Long side, the two Blocks at each end | Behind the goals |
|---|---|---|---|
| `CLUB` | `CLUB_PREMIUM` | `VIP_1` | `VIP_2` |
| `LOWER` | `VIP_1` | `VIP_2` | `STANDARD` |
| `UPPER` | `VIP_2` | `VIP_2` | `STANDARD` |

**Seat id:** `<block>-R<row, 2 digits>-<seat>`, e.g. `214-R07-12`. Unique inside a
Match, because Block numbers never repeat across Levels; across Matches the key is
`(match_id, seat_id)`. The globally unique thing is the Ticket id.

```sql
-- V1__seat_map.sql (TKT-103)
CREATE TABLE seat_maps (
    match_id        BIGINT      PRIMARY KEY,
    layout_version  VARCHAR(32) NOT NULL,        -- which layout built it, e.g. 'stadium-v1'
    seat_count      INT         NOT NULL CHECK (seat_count > 0),
    generated_at    TIMESTAMPTZ NOT NULL
);   -- one row per Match: the idempotency key for generation

CREATE TABLE blocks (
    match_id   BIGINT      NOT NULL REFERENCES seat_maps(match_id),
    block_id   VARCHAR(3)  NOT NULL,             -- '101' … '340'
    level      VARCHAR(8)  NOT NULL CHECK (level IN ('LOWER','CLUB','UPPER')),
    position   SMALLINT    NOT NULL CHECK (position BETWEEN 0 AND 39),
    side       VARCHAR(8)  NOT NULL CHECK (side IN ('WEST','NORTH','EAST','SOUTH')),
    tier       VARCHAR(16) NOT NULL
               CHECK (tier IN ('CLUB_PREMIUM','VIP_1','VIP_2','STANDARD')),
    row_seats  INT[]       NOT NULL              -- seats per Row, front Row first
               CHECK (cardinality(row_seats) > 0 AND 0 < ALL (row_seats)),
    PRIMARY KEY (match_id, block_id),
    UNIQUE (match_id, level, position)
);

CREATE TABLE seat_claims (
    id          BIGSERIAL   PRIMARY KEY,
    match_id    BIGINT      NOT NULL,
    seat_id     VARCHAR(16) NOT NULL,            -- '214-R07-12'
    block_id    VARCHAR(3)  NOT NULL,
    status      VARCHAR(16) NOT NULL CHECK (status IN ('SOLD','CANCELLED')),
    order_id    UUID        NOT NULL,
    hold_id     UUID        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (match_id, block_id) REFERENCES blocks(match_id, block_id),
    -- the Seat id names its own Block; whether Row and number fit is checked in Java
    CHECK (seat_id ~ ('^' || block_id || '-R[0-9]{2}-[0-9]{1,2}$'))
);

-- The overselling backstop: at most one SOLD claim per Seat of a Match.
CREATE UNIQUE INDEX uniq_sold_seat ON seat_claims (match_id, seat_id)
    WHERE status = 'SOLD';

-- Deliberately NO seats table (ADR-0007) and NO holds table: Holds are Redis-only (ADR-0001).
```

```sql
-- V2__price_overrides.sql (TKT-703)
CREATE TABLE match_tier_prices (
    match_id    BIGINT        NOT NULL REFERENCES seat_maps(match_id),
    tier        VARCHAR(16)   NOT NULL
                CHECK (tier IN ('CLUB_PREMIUM','VIP_1','VIP_2','STANDARD')),
    base_price  NUMERIC(10,2) NOT NULL CHECK (base_price > 0),
    updated_at  TIMESTAMPTZ   NOT NULL,
    PRIMARY KEY (match_id, tier)
);   -- only the Tiers whose Price Override differs from the default
```

**Base Price.** The default per Tier comes from configuration
(`stadium.tiers.<tier>.base-price`): Club Premium 650.00, VIP 1 320.00, VIP 2 180.00,
Standard 90.00 EUR. A Match's Price Override wins when there is one. Overrides can change
only until the Match's `bookingOpensAt`; after that the endpoint answers 409.

Later migrations: `outbox` (TKT-405), `shedlock` if the JDBC provider is chosen.

## 3. Postgres — ticketing (`ticketing_db`) — sketch, detailed in Sprint 5

| Table | Key columns | Notes |
|---|---|---|
| `orders` | `id`, `hold_id` **UNIQUE**, `fan_id`, `match_id`, `quote_id`, `amount`, `currency`, `status`, `version` | one Order per Hold |
| `payment_attempts` | `id`, `order_id`, `idempotency_key` UNIQUE, `psp_ref`, `status` | partial unique: one `CAPTURED` per order (RF-06) |
| `idempotency_keys` | `key` PK, `request_hash`, `response_json`, `status`, `created_at` | 422 on body mismatch |
| `saga_instances` | `order_id` PK, `step`, `status`, `updated_at`, `version` | resumable saga |
| `tickets` | `id`, `order_id`, `match_id`, `seat_id`, `status`, `credential_version` | |
| `scan_ledger` | `id`, `ticket_id`, `gate`, `scanned_at`, `result` | append-only |
| `ticket_documents` | `ticket_id`, `credential_class`, `object_key` | UNIQUE (ticket_id, credential_class) |
| `outbox` | `id`, `aggregate_id`, `event_type`, `payload jsonb`, `created_at`, `published_at` | |
| `processed_messages` | (`consumer_group`, `message_key`) PK | consumer dedupe |

## 4. Postgres — identity (`identity_db`) — sketch, Sprints 6/10

`users` (id, role FAN/ADMIN/STEWARD), `verified_identities` (user_id, phone_hash),
`devices` (id, user_id, fingerprint_hash, bound_at, revoked_at),
`purchase_limits` (verified_phone_hash, match_id, seats_reserved
`CHECK (seats_reserved <= 4)`, PK both), `purchase_limit_reservations`
(order_id PK, seats).

## 5. Postgres — catalog (`catalog_db`) — sketch, Sprint 4

`competitions`, `teams`, `matches` (id, provider_id UNIQUE, home/away, kickoff_at,
booking_opens_at, status, importance, print_allowed), `standings`,
`live_scores` (projection), `sync_state` (feed, etag, last_synced_at), `outbox`.

## 6. Other stores

- **redis-gateway** (detailed in TKT-701/702):

  | Key | Type | Value | Purpose |
  |---|---|---|---|
  | `waitroom:{m}:registrants` | set | fanIds | who joined during the Registration Window |
  | `waitroom:{m}:queue` | zset | fanId → drawn position | the Draw's order; late joiners go to the back |
  | `waitroom:{m}:serving` | string | highest drawn position admitted so far (N) | one number for everyone: a Fan's place is `drawnPosition − N` |
  | `waitroom:{m}:admitted` | zset | fanId → admission deadline epoch ms | the Admission Cap (at most 10,000 with a deadline in the future) |
  | `waitroom:{m}:admitted-since` | hash | fanId → admitted epoch ms | the 30-minute ceiling |
  | channel `waitroom:{m}` | pub/sub | N | one broadcast per change, written to every open stream |

  The admission deadline is now + 10 min while the Fan has no live Hold, the Hold's
  `expiresAt` while one is live (the gateway reads it from the 201 of `POST /holds` as it
  passes through, so no event is needed), and never later than admitted + 30 min. An
  Order CONFIRMED ends it at once. Plus rate-limit buckets (TKT-1005).
- **redis-cache:** catalog read models, TTL + stale-while-revalidate.
- ⭐ Stretch: **Neo4j** (fraud graph) and **MinIO** (ticket documents).
