# Merge is the last step, after review and close

In TKT-102 Anas merged PR #44 as soon as the check was green. That was before Claude's
review and before the close step (wrap-up, notes, status), which belongs on the ticket
branch. The close then needed its own follow-up PR. The new ruleset now makes green CI
mandatory, which makes it easier to read "green" as "done". It isn't: a green check
proves the build, not the review. In later tickets, say "approved, merge" explicitly and
only after the close commit is on the branch. Remind Anas at the PR step, before the
merge button.

**Evidence:** TKT-102. PR #44 was merged 2026-11-18 14:57 UTC, and the review and close
were requested afterwards.
