# ADR-0008 — Seat States are one string per Block in Redis

- **Status:** Accepted
- **Date:** 2026-11-16

Redis keeps each Block's Seat States as one string, `match:{m}:states:<blockId>`, with
one character per Seat (`A`, `H`, `S`) in the Block's Row order. That is exactly the
shape `GET /matches/{id}/seat-states` returns (D-5), so the read is one `MGET` of 120
keys, about 60 KB, copied to the response. Lua reads and writes single characters with
`GETRANGE` / `SETRANGE` at offsets Java computes from the layout. Which Hold owns a held
Seat lives in a separate hash, `match:{m}:seat-holds`. The Run search reads one Row's
slice of the Block string, so there are no bitmaps.

The read happens once per admitted Fan each time their Match stream opens, which is the
moment the crowd arrives. It should cost Redis a copy, not a build.

## Considered options

| Option | Why not |
|---|---|
| A hash with one field per Seat, plus one bitmap per Row (the design before) | every read turns 60,560 hash fields into 120 strings, on Redis's single thread or in Java after an `HGETALL`; two structures to keep in step |
| Both: the hash for writes, the strings for reads | the same state twice; every script writes both, and a bug that updates one is a wrong map |

## Consequences

- The read path does not apply lazy expiry: an expired Seat shows `H` until the sweeper
  frees it, about 2 s (TKT-205). Holding still applies lazy expiry, so no Seat can be
  held twice or stay blocked; only a colour is late, the same trade as the best-effort
  `seat.held` event.
- Lazy expiry in the scripts reads the holder's expiry with `ZSCORE` on
  `holds:expiring`, so Lua never builds a key name.
- Warmup builds 120 staging strings and renames them all in one `MULTI`/`EXEC`.
- If a later screen wants the state of one Seat, it is one `GETRANGE`.
