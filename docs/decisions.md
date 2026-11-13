# shardfile: decisions

Living doc. Decisions that bind this repo, newest last. Cross-repo decisions
(J-numbers) are Jake's, from `Raynos/project-wildshard-meta` `docs/multi-repo/MULTI-REPO-PLAN.md`;
this repo's own decisions are D-numbers.

## Cross-repo (J)

- **J3**: **The shardfile is the raw format**: a tarball of JSON + assets that authors upload. The engine does not run on it. The build **cooks** it into **runtime packs**, which are GPU- and physics-ready and keyed by shardfile hash + engine build (singleplayer DOWNLOAD, `docs/plans/DOWNLOAD.md:152-158`)
- **J7**: `shardfile` holds spec + validator. The bake/build CLI goes to `sharddev`
- **J11**: Repos depend on each other through git dependencies pinned by tag; there is no registry
- **J23**: ~~Git dependencies get built output from `dist/` committed on tag-only release commits~~ Replaced by J42
- **J42**: Git dependencies ship **raw `.ts` at the tag**: no build step and no `dist/` commits. Consumers pin `github:project-wildshard/<repo>#vX.Y.Z` and run or bundle the `.ts` directly
- **J52**: `shardfile` moves only after F1, F2 and F3 have all landed, including the import-extension codemod (J53). It is the first real move
- **J53**: J42 holds, with two fixes. (1) A codemod rewrites `src/format`'s relative imports to explicit `.ts`, so it type-checks under `nodenext`. (2) Node CLIs that import git dependencies ship as an esbuild bundle built in CI, because Node will not type-strip `.ts` inside `node_modules`; the bundle embeds the version at build time
- **J55**: **No JSON Schema export.** Valibot in `@wildshard/format` is the only shardfile contract
- **J56**: **Valibot everywhere** across the org repos (the template's zod is swapped)

## This repo (D)

- **D25**: 2026-11-04: a commit of 30+ changed lines stages a
  `project/journal/` entry (from greenroom; `.githooks/pre-commit`).
- **D27**: 2026-11-04: main only: no branches, no worktrees, every
  agent commits on `main` by pathspec (from greenroom).
  Replaced for plan work by J240/J290 (2026-11-12): a plan may use
  `.worktrees/<slug>` on `plan/<slug>`, pushed and landed only by
  `land`; everything else still commits on `main`.
- **D28**: 2026-11-05: lint is the strictest of greenroom and
  wildshard-singleplayer (every oxlint category denied, type-aware, warnings
  denied, unused disable directives are errors, `import/no-nodejs-modules`
  outside Node-side folders). Imported code may arrive under a shrink-only
  ratchet (Jake, 2026-11-05).
- **D29**: 2026-11-05: the imported `src/format` is under a shrink-only
  ratchet, not exempt. `src/format/ratchet.json` holds, per file, how often
  each oxlint rule fires under the full D28 config, and which files oxfmt
  would change. `pnpm lint:format` (in `pnpm check`) fails when any count
  rises, a new file or rule appears, or a count falls without
  `pnpm lint:format update` locking it in; `update` refuses any rise.
  Plain `pnpm lint` and `pnpm format` skip `src/format/**`, so nothing
  loosens the rules for code outside it. At import: 38,892 findings in
  4,334 file-rule pairs, 407 unformatted files.
- **D30**: 2026-11-05: the package is named `@wildshard/format` and its
  `exports` sit in the root `package.json`, pointing at `src/format/*.ts`,
  so singleplayer's `@wildshard/format/<module>` imports work unchanged
  once it depends on this repo. Format's own modules import each other
  relatively, never by package name.
  2026-11-12 (meta J308): renamed `@wildshard/shard-format`; consumers
  may keep the old key as a pnpm alias until engine renames its imports.
- **D31**: 2026-11-05: format's imported tests keep vitest
  (`pnpm test:format`); new tests use `node:test` (`pnpm test` runs every
  `*.test.ts` outside `src/format`).
