# ADR-0001 — Redis + Lua as the seat arbiter, Postgres as backstop

- **Status:** Accepted
- **Date:** 2026-11-09
- **Ticket:** TKT-106, TKT-202

## Context
Up to 50,000 Fans compete for 5000 seats in minutes. A Fan may hold up to 4 seats,
all-or-nothing. Holds are frequent and short-lived; sales are ~1250 per match.

## Decision
Seat State lives in a dedicated Redis instance. A Lua script atomically flips all
requested seats or none. Holds exist only in Redis with a TTL. Postgres records only
sales, with a partial unique index `UNIQUE (match_id, seat_id) WHERE status = 'SOLD'`
as the final arbiter. All keys of a match share the hash tag `match:{id}:`.

## Alternatives considered
| Option | Why rejected |
|---|---|
| `SELECT … FOR UPDATE` per seat | lock convoys and pool exhaustion under contention; holds would write Postgres |
| Optimistic locking (`@Version`) | retry storms on hot seats; fine for low-contention rows like Order status |
| `SETNX` per seat | not atomic across 4 seats → partial acquisition and rollback |
| Holds table in Postgres | ~10× more writes than sales, all on the hot path |

## Consequences
- Positive: one round trip per hold, all-or-nothing groups, O(1) occupancy.
- Negative: two stores to keep consistent; Lua must stay tiny and well tested;
  Redis loss drops live holds (acceptable — they are 8-minute intents).
- Revisit if: a sale must be accepted without Redis available.
