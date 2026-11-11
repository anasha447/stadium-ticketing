# CI and TDD are different safety nets

Anas first thought the CI ticket's "see it go red first" step and TDD did the same job.
Corrected on 2026-11-11: TDD drives *his code* (red before green, per slice); CI proves
the *pipeline* catches failures on every PR. Expect this confusion to return when the CI
ticket (TKT-102) asks for a deliberately red run — tie it back to this record.

**Evidence:** raised the question himself in the plan review; accepted the distinction (Q8).
