## TKT-### — <title>

**Ticket:** docs/scrum/sprints/SPRINT-NN.md#tkt-###

### What changed
-

### Why this approach (and what was rejected)
-

### Acceptance Criteria
- [ ] AC 1 — proven by `TestName` (seen red: yes)
- [ ] AC 2 — proven by `TestName` (seen red: yes)

### How to verify
```bash
./mvnw -pl services/<service> verify
```

### Checklist (Definition of Done)
- [ ] Every piece of logic was driven by a test I ran **red** first
- [ ] `./mvnw verify` green locally and the CI check is green
- [ ] Unit tests for pure logic, integration tests for I/O
- [ ] I can explain every annotation in this diff
- [ ] Glossary words used; `GLOSSARY.md` updated if a new term appeared
- [ ] Docs updated (DATA-MODEL / API / EVENTS / ADR) where relevant
- [ ] Journal entry written
- [ ] Conventional Commits

### Open questions for the reviewer
-
