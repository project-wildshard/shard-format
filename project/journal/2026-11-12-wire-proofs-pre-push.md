# Wire proofs move into pre-push (TS16h)

> Written by: Claude

6 of 20 pushes went red in CI's `wire` job, 3 of them at "Prove complete dense recording admission"
(`graph-proof.mjs`), because the three recording proofs in `src/scripts/wire/` ran only in CI. They
now run as `pnpm check:wire-proofs` at the end of `check:wire`, so `pnpm check` (pre-push) runs them
before a push leaves. Together they take about 3.5 s locally. The `wire` job keeps one `pnpm
check:wire` step. The other red step, "Require private consumer read access", left with the retired
`wire-git-install` push job and has nothing to move.
