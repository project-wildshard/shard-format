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

Step 2: the move itself (repo-kit `scripts/lean-move.mjs`).
- **Kit:** its scripts are in `src/scripts/.kit/` (land stays), its
  tests in `src/test/.kit/`, and our own tooling tests in `src/test/`.
- **TypeScript:** the root `tsconfig.json` takes the old
  `kit/tsconfig.json` options (Node, nodenext) and its exact scope,
  so what's checked hasn't changed. `src/tsconfig.json` (which
  `src/format` and `packages/wire` extend) and
  `tsconfig.browser-tools.json` extend the root config now.
- **Lint:** one run of the root `.oxlintrc.author.json` over `src/`
  and `packages/` replaces lint.mjs's two runs. The old ignores (the
  format hook, `src/format`, wire's frozen and lib folders, the
  plain-JS tooling tests) and the `packages/wire/cli` Node glob come
  with it. The format ratchet keeps its own `.oxlintrc.ratchet.json`
  (the same rules, without the skips).
- **Format:** `.prettierignore` holds our skips; `src/format` stays
  skipped in the verbs.
- **One-way ceilings:** they count `src/`, so the repo's scripts and
  the kit's tests (both new to `src/`) are left out, as they were
  before. Otherwise the kit's `worktree.mjs` "trusted" counted as
  retired vocabulary.
- **Verbs** follow D33: `prepare` and `fix`, plus a `test` that runs
  the kit's, the hooks' and the agent hooks' tests.

Two local-only failures are not the move's. Both skip in a bare
checkout, like CI or the push gate:
- `one-way-source.test.ts` refuses
  `tmp/one-format-tests-one-way-source`, whose owner session is still
  live.
- The pine-hollow case in `shardfile-stream-pins.test.ts` reads
  engine's live pins, which the 0.5.1 roll is changing.

Step 3: `agent-sync --from` re-points the kit skills at `src/scripts/.kit/`.
