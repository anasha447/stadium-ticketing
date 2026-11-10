# ADR-0003 — Five deployable services instead of seven

- **Status:** Accepted
- **Date:** 2026-11-09

## Context
The first draft had seven services, including a separate Gatekeeper, realtime
fan-out service and pricing service.

## Decision
Five deployables: `gateway` (absorbs Gatekeeper + realtime), `identity`, `catalog`,
`inventory` (absorbs pricing), `ticketing` (orders + tickets).

## Alternatives considered
| Option | Why rejected |
|---|---|
| Separate pricing service | synchronous hop on the hot path for a pure function |
| Separate realtime service | shallow module whose only job is transport |
| Separate orders and tickets | Order + Payment + Ticket + Outbox need one local transaction |

## Consequences
- Positive: fewer network hops, fewer deployables to operate, seams kept as packages.
- Negative: gateway is the busiest and most critical deployable; ticketing's DB holds
  money and entry rights, so it has the strictest backup and audit needs.
- Revisit if: `riskgraph` outgrows identity → extract as the 6th service.
