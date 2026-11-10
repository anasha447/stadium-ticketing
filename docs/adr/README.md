# Architecture Decision Records

One file per significant decision: context, decision, alternatives, consequences.
ADRs are never edited after acceptance — a new ADR supersedes an old one.

| ADR | Title | Status |
|---|---|---|
| [0001](0001-redis-as-seat-arbiter.md) | Redis + Lua as the seat arbiter, Postgres as backstop | Accepted |
| [0002](0002-quote-immutability.md) | Quotes are immutable and never recomputed | Accepted |
| [0003](0003-five-service-consolidation.md) | Five deployable services instead of seven | Accepted |
| [0004](0004-spring-boot-4.md) | Spring Boot 4.1 with Java 21 | Accepted |

**When to write one:** you chose between real alternatives and someone could
reasonably ask "why not X?" in a review or interview. Copy [0000-template.md](0000-template.md).
