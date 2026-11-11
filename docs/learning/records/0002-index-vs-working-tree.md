# The git index is separate from the working tree

Anas met the `AD` state (staged, then deleted on disk) and fixed it himself by removing
the file from the index only. He can now read `git status --short` columns. Future git
steps can assume staging vs disk is understood; teach rebasing and merge strategies on
top of it rather than re-explaining the index.

**Evidence:** TKT-100 — resolved the stale staged `.gitignore` without help (2026-11-10).
