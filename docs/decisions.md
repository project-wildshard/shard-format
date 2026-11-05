# shardfile: decisions

Living doc. Decisions that bind this repo, newest last. Cross-repo decisions
(J-numbers) are Jake's, from `Raynos/project-wildshard-meta` `docs/multi-repo/MULTI-REPO-PLAN.md`;
this repo's own decisions are D-numbers.

## Cross-repo (J)

- **J3**: **The shardfile is the raw format**: a tarball of JSON + assets that authors upload. The engine does not run on it. The build **cooks** it into **runtime packs**, which are GPU- and physics-ready and keyed by shardfile hash + engine build (singleplayer DOWNLOAD, `docs/plans/DOWNLOAD.md:152-158`)
- **J7**: `shardfile` holds spec + validator. The bake/build CLI goes to `sharddev`
- **J11**: Repos depend on each other through git dependencies pinned by tag; there is no registry
- **J23**: Git dependencies get built output from **`dist/` committed on tag-only release commits**

## This repo (D)

- **D25**: 2026-11-04: a commit of 30+ changed lines stages a
  `project/journal/` entry (from greenroom; `.githooks/pre-commit`).
- **D27**: 2026-11-04: main only: no branches, no worktrees, every
  agent commits on `main` by pathspec (from greenroom).
- **D28**: 2026-11-05: lint is the strictest of greenroom and
  wildshard-singleplayer (every oxlint category denied, type-aware, warnings
  denied, unused disable directives are errors, `import/no-nodejs-modules`
  outside Node-side folders). Imported code may arrive under a shrink-only
  ratchet (Jake, 2026-11-05).
