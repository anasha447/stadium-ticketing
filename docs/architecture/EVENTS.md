# Events — Kafka Topic Catalog

Every cross-service fact travels as an event. Records live in the `contracts` module
as plain Java records (no Spring), each with a `schemaVersion` field.

## Rules

- **Key = `matchId`** unless stated, so all events of one match are ordered on one partition.
- **Producers that write Postgres publish through an Outbox** (same transaction as the
  state change). Producers that do not write Postgres publish directly and the event is
  **best-effort** (RF-14).
- **Consumers are idempotent:** dedupe on `(consumer_group, message_key)` in
  `processed_messages`, or the handler is naturally idempotent.
- Event names are past-tense facts: `seat.held`, never `hold.seat`.
- A breaking change → new `schemaVersion`; consumers handle both until migrated.

## Catalog

| Topic | Producer | Consumers | Guarantee | Payload (main fields) | Sprint |
|---|---|---|---|---|---|
| `match.scheduled` | catalog | inventory (generate Seat Map + warmup) | outbox | matchId, kickoffAt, bookingOpensAt, competitionTier | 4 |
| `match.importance.changed` | catalog | inventory (pricing input) | outbox, compacted | matchId, importance | 9 |
| `match.finished` | catalog | ticketing (Souvenir) | outbox | matchId, finalScore, attendance | 15 |
| `seat.held` | inventory | catalog (velocity), gateway (SSE) | **best-effort** | matchId, holdId, seatIds, heldAt | 3 |
| `hold.expired` | inventory | ticketing, catalog, gateway | **best-effort** | matchId, holdId, seatIds | 3 |
| `seat.released` | inventory | gateway (SSE) | best-effort (hold) / outbox (cancel) | matchId, seatIds, reason | 3 |
| `seat.sold` | inventory | gateway (SSE), analytics | outbox | matchId, seatIds, orderId | 4 |
| `price.changed` | inventory | gateway (SSE) | best-effort | matchId, tier, section, price | 9 |
| `demand.multiplier.changed` | catalog (Streams) | inventory | compacted | matchId, multiplier, validUntil | 14 |
| `order.confirmed` | ticketing | identity (riskgraph), ticketing (PDF) | outbox | orderId, fanId, matchId, seatIds, amount, paymentFingerprint | 6 |
| `order.cancelled` | ticketing | inventory (recycle seats) | outbox | orderId, matchId, seatIds, reason | 9 / 14 |
| `ticket.document.ready` | ticketing | ticketing API, frontend | outbox | ticketId, credentialClass, objectKey | 15 |
| `fraud.ring.detected` | identity | ticketing, admin UI | outbox, key = ringId | orderIds, confidence, reason | 16 |

## Why `seat.held` is allowed to be lost

It drives the live map and the demand signal. A lost event means a seat colour updates
on the next snapshot and velocity is off by one — no money moves. Paying for an outbox
would mean a Postgres write on the hold path, which the whole design forbids.
`seat.sold` moves money-adjacent state, so it is never best-effort.
