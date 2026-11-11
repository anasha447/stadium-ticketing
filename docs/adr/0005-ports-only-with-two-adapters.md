# ADR-0005 — A port only where two adapters exist

- **Status:** Accepted
- **Date:** 2026-11-11

A port (a Java interface at a seam, with an adapter behind it) is introduced only when at
least two adapters are justified, typically a production adapter plus a test or fixture
adapter that really differ. With one adapter the seam is hypothetical: the interface
adds a file and an indirection that every reader and every test must cross, and buys
nothing. So `inventory` calls its Redis + Lua code directly through a concrete class
(tested against real Redis with Testcontainers), and the domain stays pure because the
domain never needs Redis, not because a port hides it.

**Ports we keep (two adapters each):** `MatchFeed` and `WeatherFeed` (live API + offline
fixtures), `PaymentGateway` (mock PSP + Stripe test mode), `OtpSender` (console adapter +
any real SMS provider), `PricingSignals` (constant + event-fed), `HoldEventPublisher`
(no-op + Kafka).

**Removed:** the `SeatStateStore` port in `inventory`, and the `FraudGraph` port (Fraud
Ring Detection is now a stretch goal).

## Considered options

| Option | Why not |
|---|---|
| Hexagonal everywhere (a port for every I/O dependency) | most ports would have one adapter; more files, shallower modules, tests that mock the port instead of exercising real Redis behaviour |
| No ports at all | loses the clean swap for the live/fixture feeds and the mock/real PSP, where two adapters genuinely exist |

## Consequences

- When a second adapter becomes real, introduce the port in that ticket, not earlier.
- Tests for Redis/Lua behaviour are integration tests against a real container; a fake
  in-memory store would prove nothing about Lua atomicity (ADR-0001).
