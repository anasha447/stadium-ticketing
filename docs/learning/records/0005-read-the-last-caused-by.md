# Read the last "Caused by", and tell Errors from Failures

In TKT-103 Anas pasted the **top** of a failing build several times (`Failed to load
ApplicationContext`, `Tests run: 19 … Errors: 19`), when the answer was in the last `Caused by:`
of `target/surefire-reports/*.txt`. The causes were all different: a missing Flyway module, a
syntax error in V1, an entity without `@Entity` (the planned red), and 360 Total Security blocking
Testcontainers. In later tickets, ask for the last `Caused by:` line first, and ask whether the
count says **Failures** (an assertion disagreed) or **Errors** (the test couldn't run), before
looking at any code. Every lesson's "If it goes wrong" table should quote that last line.

**Evidence:** TKT-103, 2026-11-21 to 2026-11-23: `Unsupported Database`, `syntax error at or near "("`,
`Not a managed type`, `Could not connect to Ryuk`, each first reported by its top line.
