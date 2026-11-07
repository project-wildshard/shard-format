# Developing shardfile

Living doc: commands, layout, code rules and git hooks. AGENTS.md links
here; what the repo does is `docs/prd.md`, how it is built `docs/design.md`.

## Commands

Run from the repo root.

- `pnpm install`: installs deps and points `core.hooksPath` at `.githooks/`,
  through `pnpm:devPreinstall`, which runs only in this repo. Never use
  `prepare` here: pnpm then builds the git dependency in every consumer,
  and pnpm 10.26+ refuses that unless the consumer allowlists it.
- `pnpm check`: typecheck + lint + the src/format ratchet + format:check
  + unit tests + format's tests + asks. The pre-push hook and CI run it.
- `pnpm typecheck`: `src/tsconfig.json` (CLI, tools, tests),
  `src/format/tsconfig.json` (format and its tests, Node types) and
  `src/format/tsconfig.lib.json` (the library alone: ES2022, no Node,
  no DOM).
- `pnpm test`: `node:test` on every `*.test.ts` outside `src/format`,
  run as .ts by Node's type stripping.
- `pnpm test:format`: format's imported vitest tests (D31).
- `pnpm test:ci`: `src/ci`, outer-edge bug tests. CI only, never a hook (J186).
- `pnpm lint:format`: the src/format ratchet (D29). `pnpm lint:format
  update` lowers the baseline after a fix; it refuses any rise.
- `pnpm test:hooks`: the `.githooks/` suite (CI, and pre-commit when hooks change).
- `pnpm lint:fix` / `pnpm format`: the hooks only check; these fix.
- `node src/cli/main.ts --help`: the CLI without installing it.
- `node src/cli/main.ts validate <dir>`: validate a built product folder.
- `pnpm md:wrap`: rewraps Markdown prose to ~72 columns.
- `src/scripts/ask-new.sh "<Jake's words>"`: opens an ask (`docs/tasks/asks/README.md`).

## Changing the format

This repo is the source of truth for `@wildshard/format`. Singleplayer
deleted its `src/format` when it switched to `v0.2.0` (MOVES.md step 7),
which ended J81. Nothing edits format anywhere else.

1. Change `src/format` here, with its tests. `pnpm check`, commit, push.
2. Batch changes, then release:
   `ASSISTED_BY=Claude-Code:<model> ../leftover/src/repo-kit/release.sh vX.Y.Z`.
3. In singleplayer, set the tag in all four manifests (root, `src/game`,
   `src/sdk`, `src/commons`) and update `pnpm-lock.yaml` with pnpm 10.34.9
   or newer. An older pnpm can record the annotated tag's object id
   instead of its commit (10.21 and 10.26.0 both do), and an install
   from an empty store then fails with `ERR_PNPM_GIT_CHECKOUT_FAILED`.
   A warm store hides this locally. Check the lock's `commit:` against
   `git rev-parse vX.Y.Z^{commit}`.
4. A new module needs its entry in `exports` here before singleplayer
   can import it, and any path outside `src/format` and `src/cli` also
   needs one in `files`, or the git dependency installs without it.

## Layout

The root stays thin: README.md and AGENTS.md (humans only), CLAUDE.md
(`@AGENTS.md`), package.json, pnpm-lock.yaml, .npmrc, .gitignore,
.editorconfig, `docs/`, `project/`, `src/` and the dot dirs. Scratch
goes in `tmp/<task>/` and is deleted when done.

- `src/format/`: the `@wildshard/format` package, imported from
  singleplayer; its `exports` are in the root `package.json` (D30).
  `standards/` holds the globals it may use; `ratchet.json` is the
  D29 baseline.
- `src/hook/`: `@wildshard/format/formatHook`, the strip-types hook every
  Node consumer installs before it imports format. Plain JS on purpose:
  as .ts, nothing could load it from `node_modules`.
- `src/cli/`: the `shardfile` CLI (`validate <dir>`, `--version`, `--help`).
- `src/tools/`: repo tooling in TypeScript (the format ratchet).
- `src/test/helpers/`: shared test helpers; `git.ts` makes real git repos in temp dirs.
- `src/test/fixtures/`: test inputs, outside oxfmt (a product's JSON is
  canonical and hash-bound).
- `src/scripts/`: repo tooling (asks, md-wrap), plain JS.
- `docs/`: living docs. `docs/plans/` is the queue, `docs/tasks/asks/`
  the receipts.
- `project/`: history. `journal/`, `origins/` (the meta-repo plans this
  repo came from), `archive/`.

## Code rules

- TypeScript only, imports with explicit `.ts`/`.tsx` extensions.
- `src/format` is held by the D29 ratchet instead of plain `pnpm lint`:
  a new file there must be lint-clean and formatted, and a count in an
  imported file may only fall. Fixing imported code: fix, then
  `pnpm lint:format update` in the same commit.
- A module shared with other repos goes here if both already depend on
  format (J27): `tar` (the tarball, read and write), `uploadWire`,
  `gridCatalogue`, `standaloneCatalogue`.
- The library (`src/format`, not its tests) imports only `valibot`,
  `meshoptimizer/decoder` and its own modules, by relative `./x.ts`
  path, never by its package name.
- Every function has an explicit return type. `src/.oxlintrc.json` denies
  every category (D28); disable a rule only with a one-line reason beside it.
- Pin dependencies exactly (`.npmrc` has `save-exact=true`).
- Other Wildshard repos are git dependencies pinned by tag
  (`github:project-wildshard/<repo>#vX.Y.Z`). They are private, so CI reads
  them with the org GitHub App token.
- Tests use real things (git in temp dirs, real files and processes); never
  mock git. No LLM, `claude`, herdr or network in tests.

## Git hooks

| Hook | Checks | Bypass |
| --- | --- | --- |
| commit-msg | Conventional Commits subject ≤ 50, body ≤ 72, one `Assisted-by: AGENT:MODEL` trailer, no AI `Co-Authored-By` | `SKIP_ATTRIB=1` (human-only commit) |
| pre-commit | `main` in the main checkout (D27), staged set echo, whitespace, 1 MB cap, credentials, sh / mjs syntax, new-plan Status line, journal (D25) | `ALLOW_BRANCH=1`, `ALLOW_BIG=1`, `ALLOW_SECRET=1`, `SKIP_JOURNAL=1` |
| pre-commit | lint + format:check on staged code (src/format is skipped: the ratchet runs at push), typecheck; 8 s budget | `SKIP_BUDGET=1` (time only), `SKIP_CHECK=1` |
| pre-push | outgoing commits: size, credentials, syntax; then `pnpm check` | `ALLOW_BIG=1`, `ALLOW_SECRET=1`, `SKIP_CHECK=1` |

Bypasses are for the case they name, never for a red gate: fix the code,
not the gate.
