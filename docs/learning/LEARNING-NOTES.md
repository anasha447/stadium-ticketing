# Learning Notes

One short section per ticket, newest first: what I did and what I learned.

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
