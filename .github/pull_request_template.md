## TKT-### — <title>

Closes #<issue>

### What changed
-

### Why this approach (and what was rejected)
-

### Acceptance criteria
- [ ] AC 1 — proven by `TestName` (seen red: yes)
- [ ] AC 2 — proven by `TestName` (seen red: yes)

### How to verify
```bash
./mvnw -pl services/<service> verify
```

### Checklist (Definition of Done)
- [ ] Every piece of logic was driven by a test I ran **red** first
- [ ] `./mvnw verify` green locally and the CI check is green
- [ ] `/code-review` run; refactors committed with tests green
- [ ] I can explain every annotation in this diff
- [ ] Glossary words used; `GLOSSARY.md` updated if a new term appeared
- [ ] Docs / ADRs updated where relevant
- [ ] Lesson wrap-up written; `docs/learning/LEARNING-NOTES.md` updated
- [ ] Conventional Commits

### Open questions for the reviewer
-
