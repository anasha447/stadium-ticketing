# ADR-0002 — Quotes are immutable and never recomputed

- **Status:** Accepted
- **Date:** 2026-11-09
- **Ticket:** TKT-304

## Context
Prices move (Importance, Demand Multiplier, Time Decay). If the price is recomputed at
payment time, a Fan can be charged an amount different from the one shown.

## Decision
A Quote is issued at Hold time, identified (`quoteId`), immutable, and expires with the
Hold. The Order copies the Quote's lines and total. Nothing recomputes a price after a
Quote exists.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Recompute at checkout | charged ≠ shown under concurrent repricing |
| Lock prices during booking window | kills Time Decay and demand pricing |
| Store quotes in Postgres | a Postgres write on the hold path |

## Consequences
- Positive: what the Fan sees is what they pay; pricing stays a pure function.
- Negative: a Quote can be "stale" for up to one Hold TTL — accepted and disclosed.
