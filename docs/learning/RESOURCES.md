# Resources

The trusted sources lessons are built from. Every "Under the hood" claim in a lesson cites
one of these, and every lesson names one **primary source** to read. Claude checks the
source when writing the lesson instead of trusting memory — this matters most for
Spring Boot 4.1, which differs from most tutorials (ADR-0004).

Rules: high-trust only (official docs, primary authors). One line on when to use each.
Remove anything that turns out wrong or shallow. Missing an area? Add it under **Gaps**.

## Knowledge

### Spring
- [Spring Boot reference documentation](https://docs.spring.io/spring-boot/index.html)
  Auto-configuration, starters, Actuator, configuration properties, testing. Use for: almost every Boot lesson.
- [Spring Boot 4.0 Migration Guide](https://github.com/spring-projects/spring-boot/wiki/Spring-Boot-4.0-Migration-Guide)
  What changed from Boot 3. Use for: every "Boot 4 note" in a lesson.
- [Spring Framework reference](https://docs.spring.io/spring-framework/reference/)
  Beans, proxies, `@Transactional`, MVC, `ProblemDetail`. Use for: the mechanism under an annotation.
- [Spring Data JPA reference](https://docs.spring.io/spring-data/jpa/reference/)
  Repositories, entities, persistence context. Use for: TKT-103 onwards.
- [Spring Data Redis reference](https://docs.spring.io/spring-data/redis/reference/)
  Lettuce, templates, scripting, pipelining. Use for: TKT-106, Sprint 2.
- [Spring for Apache Kafka reference](https://docs.spring.io/spring-kafka/reference/)
  `KafkaTemplate`, listeners, transactions. Use for: TKT-305 onwards.

### Data stores and messaging
- [Redis — Lua scripting](https://redis.io/docs/latest/develop/interact/programmability/eval-intro/)
  Atomicity of scripts, `EVAL` / `EVALSHA`. Use for: TKT-202 and every Lua ticket.
- [Redis cluster specification — hash tags](https://redis.io/docs/latest/operate/oss_and_stack/reference/cluster-spec/)
  Why `match:{id}:` keeps a script's keys in one slot. Use for: key design.
- [PostgreSQL — partial indexes](https://www.postgresql.org/docs/current/indexes-partial.html)
  The overselling backstop. Use for: TKT-103.
- [Flyway documentation](https://documentation.red-gate.com/flyway)
  Versioned migrations, checksums. Use for: TKT-103.
- [Apache Kafka documentation](https://kafka.apache.org/documentation/)
  Partitions, ordering, delivery semantics. Use for: Sprint 3 onwards.

### Testing
- [JUnit 5 user guide](https://junit.org/junit5/docs/current/user-guide/) — parameterized and repeated tests.
- [Testcontainers for Java](https://java.testcontainers.org/) — real Postgres/Redis/Kafka in tests.
- [jqwik user guide](https://jqwik.net/docs/current/user-guide.html) — property-based testing (TKT-301, TKT-303).

### Build, git and CI
- [Maven — Introduction to the POM](https://maven.apache.org/guides/introduction/introduction-to-the-pom.html)
  Inheritance vs aggregation. Use for: TKT-101.
- [Git reference](https://git-scm.com/docs) and [Pro Git](https://git-scm.com/book)
  `gitignore`, `gitattributes`, the index. Use for: any git question.
- [GitHub Actions documentation](https://docs.github.com/en/actions) — workflows, caching, branch protection (TKT-102).

### Distributed-systems patterns
- [microservices.io — Saga](https://microservices.io/patterns/data/saga.html) and
  [Transactional Outbox](https://microservices.io/patterns/data/transactional-outbox.html)
  by Chris Richardson. Use for: Sprints 4–6.
- *Designing Data-Intensive Applications* — Martin Kleppmann (book). Use for: consistency,
  delivery guarantees, the "why" behind Redis vs Postgres.

## Wisdom (communities)

Optional — none joined yet. Candidates when a question needs real-world practice:
Stack Overflow tags `spring-boot`, `redis`, `apache-kafka`.

## Gaps

- None known yet.
