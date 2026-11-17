# Format land hook fixtures

> Written by: Codex
> State: fixed, 2026-11-16.

Exact format branch CI43984327709 passed the format and wire suites.
The installed hook suite exposed two shared fixture assumptions: clone
identity supplied only by stripped GIT_* environment, and local-copy
expectations while inheriting hosted CI mode. Published kit source df2bc9c independently carries the fixes; its exact
shared templates are applied here. The duplicate local kit commit was
dropped during sync; no shared checkout remains mid-rebase. All14 real-Git cases pass under CI locally;
no production guard or assertion changes. The original format contract
and independent review remain unchanged.
