# A red only counts if it fails for the right reason

In TKT-101 Anas added Actuator before ever running `HealthEndpointTest`, so the first run
was already green and proved nothing; he went back, removed the dependency and saw the
404. He also trusted IntelliJ's ▶ over the wrapper (a `ClassNotFoundException` that was
only an un-imported module). In later tickets ask for the **pasted red output from
`./mvnw` at the root** before any production code, and check that the failure message
matches the behaviour under test (status, assertion) — not a compile error or setup crash.

**Evidence:** TKT-101 — Actuator in the POM before the first test run; red seen only after
being asked (2026-11-13).
