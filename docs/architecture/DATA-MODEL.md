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

| Key | Type | Value | Written by | Purpose |
|---|---|---|---|---|
| `match:{m}:seats` | hash | seatId → `A` \| `H:<holdId>` \| `S` | warmup, all scripts | authoritative Seat State |
| `match:{m}:block:<blockId>` | bitmap | bit = `position_in_block`, 1 = taken | warmup, all scripts | Run search |
| `match:{m}:hold:<holdId>` | hash + **TTL** | `fanId`, `seatIds`, `quoteId`, `createdAt` | `hold_seats`, `find_and_hold_run` | **the clock of record** |
| `match:{m}:holds:expiring` | zset | holdId → expiry epoch ms | hold scripts | sweeper work list |
| `match:{m}:occupancy` | hash | `available`, `held`, `sold` | warmup, all scripts | O(1) occupancy |
| `match:{m}:fan:<fanId>:holds` | set | holdIds | hold scripts | 4-seat cap per Fan |
| `match:{m}:quote:<quoteId>` | hash + TTL | quote lines, total, currency | quote service | immutable Quote |
| `match:{m}:demand` | string | multiplier | demand consumer | pricing input (Sprint 14) |
| `matches:active` | set | matchIds with live holds | inventory adapter, **after** a successful script (no hash tag → never touched inside Lua) | sweeper iteration |

**Staging keys (RF-17):** warmup builds `match:{m}:seats:staging`,
`match:{m}:block:<b>:staging`, `match:{m}:occupancy:staging`, then `RENAME`s each.

### Lua script contracts

| Script | KEYS | ARGV | Returns |
|---|---|---|---|
| `hold_seats.lua` | seats, hold, expiring, occupancy, fanHolds, block bitmaps… | holdId, fanId, ttlMs, nowMs, maxSeats, then triples `seatId, blockKeyIndex, position` | `{1}` held · `{0, conflictSeatIds…}` · `{-1, "CAP", currentSeats}` |
| `release_hold.lua` | seats, hold, expiring, occupancy, fanHolds, block bitmaps… | holdId, fanId, reason, triples | `{1}` released · `{0}` already gone |
| `find_and_hold_run.lua` | as `hold_seats` + candidate block keys | holdId, fanId, ttlMs, nowMs, then candidates `blockKeyIndex, start, length, blockLength, orphanAllowed, seatIds…` | `{1, candidateIndex}` · `{0}` miss |
| `confirm_sold.lua` | seats, hold, expiring, occupancy, fanHolds | holdId | `{1, seatIds…}` · `{0, "EXPIRED"}` |
| `unconfirm.lua` | seats, occupancy, block bitmaps… | seatIds | `{1}` |

Script rules:
- Lua **never builds key names** — every key arrives in `KEYS[]`.
- A seat valued `H:<x>` whose hold key does not `EXISTS` is treated as `A`.
- `release_hold` only flips seats whose current value is exactly `H:<holdId>` (idempotent,
  safe to race with the sweeper).
- No unbounded loops; input size is bounded (≤ 4 seats, ≤ 5 candidates).

## 2. Postgres — inventory (`inventory_db`)

```sql
-- V1__seat_map.sql
CREATE TABLE seat_maps (
    match_id        BIGINT PRIMARY KEY,
    layout_version  VARCHAR(32) NOT NULL,
    seat_count      INT         NOT NULL,
    vip_count       INT         NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL
);   -- one row per Match: the idempotency key for generation

CREATE TABLE blocks (
    match_id        BIGINT      NOT NULL REFERENCES seat_maps(match_id),
    block_id        VARCHAR(32) NOT NULL,          -- e.g. W-S03-R07-B1
    section         VARCHAR(16) NOT NULL,
    row_label       VARCHAR(8)  NOT NULL,
    length          SMALLINT    NOT NULL CHECK (length > 0),
    PRIMARY KEY (match_id, block_id)
);

CREATE TABLE seats (
    match_id           BIGINT      NOT NULL,
    seat_id            VARCHAR(32) NOT NULL,       -- e.g. W-S03-R07-12
    section            VARCHAR(16) NOT NULL,
    row_label          VARCHAR(8)  NOT NULL,
    number             SMALLINT    NOT NULL,
    block_id           VARCHAR(32) NOT NULL,
    position_in_block  SMALLINT    NOT NULL,
    tier               VARCHAR(16) NOT NULL CHECK (tier IN ('STANDARD','VIP')),
    PRIMARY KEY (match_id, seat_id),
    FOREIGN KEY (match_id, block_id) REFERENCES blocks(match_id, block_id),
    UNIQUE (match_id, block_id, position_in_block)
);

CREATE TABLE seat_claims (
    id          BIGSERIAL PRIMARY KEY,
    match_id    BIGINT      NOT NULL,
    seat_id     VARCHAR(32) NOT NULL,
    status      VARCHAR(16) NOT NULL CHECK (status IN ('SOLD','CANCELLED')),
    order_id    UUID        NOT NULL,
    hold_id     UUID        NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (match_id, seat_id) REFERENCES seats(match_id, seat_id)
);

-- The overselling backstop: at most one SOLD claim per seat.
CREATE UNIQUE INDEX uniq_sold_seat ON seat_claims (match_id, seat_id)
    WHERE status = 'SOLD';

-- Deliberately NO holds table: holds are Redis-only (ADR-0001).
```

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

- **redis-gateway:** `waitroom:{m}:registrants` (set), `waitroom:{m}:queue` (zset),
  rate-limit buckets. Detailed in Sprint 6.
- **redis-cache:** catalog read models, TTL + stale-while-revalidate.
- ⭐ Stretch: **Neo4j** (fraud graph) and **MinIO** (ticket documents).
