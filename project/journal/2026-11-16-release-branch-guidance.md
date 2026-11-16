# Author release notes on the release branch

> Written by: Codex
> State: current, 2026-11-16, meta RELEASE-BRANCHES RB9.

The development runbook now uses prepare with a notes file, exact
release-branch CI, finish, npm visibility and merge-back. The helper
writes version and changelog on the branch (J360/J362), so authors
can continue landing main changes while the release is in flight.
This replaces the obsolete one-step helper command.
