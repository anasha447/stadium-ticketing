# ADR-0004 — Spring Boot 4.1 with Java 21

- **Status:** Accepted
- **Date:** 2026-11-10
- **Ticket:** TKT-101

## Context
The original plan pinned Spring Boot 3.x. The 3.5.16 release (2026-06-25) was the last
open-source release of the 3.x generation; after it, patches are commercial only.
Spring Boot 4.1 (released 2026-06) is the current stable line, with OSS support until
about 2027-07. Boot 4.0 loses OSS support at the end of 2026-12.

Anas asked for 3.x "or 4.1 if fully backward compatible". **4.1 is not fully backward
compatible** with 3.x, but the breaks that touch this project are few and mechanical
(table below). Java 21 is supported by both.

## Decision
- **Spring Boot 4.1.x** (latest patch offered on start.spring.io), **Java 21**, Maven.
- Spring Cloud: the release train start.spring.io pairs with that Boot version.
- Every Boot 3 → 4 difference is flagged in the teaching loop when it first appears, so
  Boot 3 tutorials and Stack Overflow answers stay usable.

## Alternatives considered
| Option | Why rejected |
|---|---|
| Spring Boot 3.5 + Java 21 | no free security patches; looks dated in a 2026 portfolio; Boot 4 is what interviewers will ask about |
| Spring Boot 4.0 | OSS support ends in weeks — an immediate forced upgrade |
| Java 25 | newer LTS, but less learning material; no feature in this plan needs it |

## Boot 3 → 4 differences that affect this project

Use this table when a tutorial "doesn't work".

| Area | Boot 3 (tutorials) | Boot 4.1 (this project) | First hit |
|---|---|---|---|
| Web starter | `spring-boot-starter-web` | `spring-boot-starter-webmvc` (Initializr's "Spring Web" picks the right one) | TKT-101 |
| Auto-configuration | a library on the classpath activates its auto-config | auto-config split per starter — **use the starter, not the raw library** | TKT-101 |
| Flyway | `flyway-core` alone runs migrations | needs `spring-boot-starter-flyway`; with only `flyway-core`, migrations **silently never run** | TKT-103 |
| Mocking in slice tests | `@MockBean` | `@MockitoBean` (`org.springframework.test.context.bean.override.mockito`) | TKT-105 |
| MVC test slice | `@WebMvcTest` in `...boot.test.autoconfigure.web.servlet` | `org.springframework.boot.webmvc.test.autoconfigure`, plus the `spring-boot-starter-webmvc-test` dependency | TKT-105 |
| Jackson | Jackson 2, `com.fasterxml.jackson`, `ObjectMapper` | Jackson 3, `tools.jackson`, immutable `JsonMapper`; exceptions are unchecked; `java.time` works without a module | TKT-105, TKT-305 |
| Null-safety annotations | `@NonNullApi` (JSR-305) | JSpecify `@NullMarked` / `@Nullable` from `org.jspecify.annotations` | optional |
| JUnit | JUnit 4 still possible | JUnit 4 support removed — JUnit 5 (Jupiter) only | — |
| Test HTTP client | `TestRestTemplate`, `MockMvc` | adds `RestTestClient` (Spring Framework 7) | TKT-105 |

## Consequences
- Positive: supported framework, longest support window, interview-relevant.
- Negative: some copy-paste from older tutorials fails; the table above and the teaching
  loop make each failure a learning point instead of a blocker.
- Revisit if: a library this project needs has no Boot 4 support (check before adding it).
