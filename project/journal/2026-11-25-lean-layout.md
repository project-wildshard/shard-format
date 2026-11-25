# Moving to repo-kit's lean layout

Jake asked repo-kit's agent to move every repo to the lean layout
(repo-kit plan `opus-2026-11-25-shard-lean-layout`, R1). shard-format
keeps land (repo-kit's land audit), so `land.config.json` stays.

Step 1: on the old layout, `agent-sync --from` repo-kit and
`kit.mjs apply`. hc replaces the herdr guard. The bins move to the
kit's pnpm profile on npm-bin-deps 2.2.0 with
`binDependenciesProjectSettings: false`, so they share one cache entry
with every repo (L4). The git hooks, skills and kit scripts take the
kit's current copies.

The worktrees under `.worktrees/` are 5 to 8 days old and left as
they are. `plan/of24-phone-skins` and `release/v0.58.0` each hold one
commit not on main, and will rebase over the moved paths when they
land.
