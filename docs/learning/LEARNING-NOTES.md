# Learning Notes

One short section per ticket, newest first: what I did and what I learned.

---

## TKT-102 — CI on every pull request · Nov 18, 2026

**What I did**
- Added `.github/workflows/ci.yml`: every PR and every push to `main` runs `./mvnw -B verify` on Java 21 on a fresh Linux machine
- Made `mvnw` executable in git (`100644` → `100755`) before the first run, so it didn't die with "Permission denied"
- Broke `HealthEndpointTest` on purpose and watched the check go red with the same assertion I saw locally, then reverted it
- Made the repo public and added a ruleset: `main` now needs a PR and a green `build` check

**What I learned**
- **There's no "turn on Actions" button** — the YAML file in `.github/workflows/` is the setup. GitHub reads it on every event.
- **A PR build is a build of the merge** — `pull_request` checks out my branch merged into today's `main`, not my branch tip.
- **Windows hides file modes** — git stores the executable bit, and Linux needs it. `git update-index --chmod=+x` changes only the mode; the blob hash stays the same.
- **The cache is per branch** — my PR's second run restored it (22 s → 14 s of Maven), but the first run on `main` missed and saved its own.
- **A check reports, a ruleset enforces** — and the ruleset picks the check by job id (`build`), not the workflow name.
- **Merge is the last step** — I merged before the review and the close step, so the notes went in a follow-up PR. Green CI doesn't mean the work was reviewed.

---

## TKT-101 — Walking skeleton: root POM + inventory · Nov 13, 2026

**What I did**
- Made a root `pom.xml` that lists the modules and is also the parent of every service
- Generated `inventory` on start.spring.io and pointed its parent at the root POM
- Moved the Maven Wrapper to the root, so one `./mvnw clean verify` builds everything
- Added Actuator after seeing the health test fail with 404, then set the port to 8081

**What I learned**
- **Aggregator vs parent** — `<modules>` = what to build, `<parent>` = what to inherit. An empty `<relativePath/>` doesn't look at my disk at all.
- **No versions in the service POM** — Boot's parent already decides them.
- **Run tests with the wrapper, not just IntelliJ** — the IDE gave me ClassNotFound only because the module wasn't imported. Also 360 antivirus was blocking Java on localhost, so a weird network error isn't always my code.
- **A red only counts if it fails for the right reason** — I added Actuator too early and had to go back to see the 404.
- **YAML is strict** — I wrote `service:` instead of `server:` and `port:8081` without a space. Spring ignored both and stayed on 8080.
- **Staging a whole folder is risky** — it pulled in a file from the next slice.

---

## TKT-100 — Verify repository baseline · Nov 10, 2026

**What I did**
- Made the first commit on `main` (all planning docs, CLAUDE.md, GLOSSARY.md, PR template) and pushed it to GitHub
- Added a root `.gitignore` (build output, IDE files, `.env`, Claude local state)
- Added a root `.gitattributes` so every text file is stored and checked out with LF
- Fixed a misplaced `.gitignore` that was deep inside `src/main/java/...`

**What I learned**
- **`.gitignore` scope** — rules apply to the file's own folder and below. Only a root file covers the whole repo.
- **Index vs working tree** — git keeps what I staged (index) separately from what's on disk. Deleting a staged file left an `AD` state; `git rm --cached` removes it from the index only.
- **Line endings** — Windows uses CRLF, Linux uses LF. Git converts on `git add` (disk → repo) and on checkout (repo → disk).
- **First commit goes straight to `main`** — an empty repo has no base commit to branch from. Every ticket after this one uses a branch and a PR.
- **`git push -u`** — links local `main` to `origin/main`, so `git status` can say whether I'm ahead or behind.
