# shardfile: import from singleplayer

Status: finished 2026-11-05: imported, released and switched.
Singleplayer consumes `@wildshard/format` from `v0.2.0` and has deleted
its `src/format`. This repo is now the source of truth (J81 ended);
changing the format is in `docs/dev.md`.

One-page runbook for bringing this repo's code over from
`Raynos/project-wildshard-singleplayer`. The why and the full plan live in `Raynos/project-wildshard-meta`:
`docs/multi-repo/MULTI-REPO-PLAN.md`, `P1-IN-TREE.md`, `MOVES.md` (phase P2).
Live cross-repo status: `docs/multi-repo/STATE.md` there.

## What came in

From `Raynos/project-wildshard-singleplayer@36d00c6645`:

- `src/format/` → `src/format/` (410 files, tests included)
- `types/format-standards.d.ts` → `src/format/standards/`
- `docs/SHARDFILE.md`, `docs/PLATFORM-FILE-FAMILIES.md`,
  `docs/SCRIPT-ABI.md` → `docs/`
- the format half of `validate` (F3's `validateShardfileProduct`, in
  `src/format/productValidation.ts`) → behind `shardfile validate`

Not taken: `scripts/gen-format-schema.mjs`. J55 drops the JSON Schema
export; singleplayer's author tooling still generates JSON Schema
(`src/sdk/formatJsonSchema.ts`), which goes to sharddev in P4.

## Before the import

- F1: `a66fcd17f4` (installable alone as raw .ts)
- F2′ (J55): the valibot schemas are the contract; nothing to build
- F3: `a892b89f26` (`validateShardfileProduct`)
- J53 codemod: `36d00c6645` (explicit `.ts` imports, `nodenext`)

## Steps (MOVES.md, the standard move)

| # | Step | Done when | State |
|---|---|---|---|
| 1 | Freeze: tell the singleplayer lanes, pause commits to the moving paths, record the SHA | The SHA is in this plan | SHA recorded (`36d00c6645`); no freeze announced, so step 6 re-imports from a newer SHA first |
| 2 | Import commit: copy the paths at that SHA into this repo; the message names the SHA and paths (J12) | One commit, nothing else in it | Done: `0353d5d` (plus its journal entry) |
| 3 | Binaries over 1 MB go to R2 by hash (J13) | The pre-commit size cap passes without `ALLOW_BIG` | Done: none over 1 MB |
| 4 | Green: `pnpm check` and CI pass; imported code that fails the strict lint goes under a shrink-only ratchet (D28) | CI green on `main` | Done: D29 ratchet, `shardfile validate` |
| 5 | Release `v0.1.0` (raw `.ts` at the tag, J42) with repo-kit's `release.sh` | The tag installs as a git dependency | Done |
| 6 | Switch: singleplayer uses this repo (git dependency or deploy) instead of its own copy | Singleplayer CI green | Done: re-import `cfd1b77` from `1546ceedf8`, released `v0.2.0`, singleplayer `3f6f229e33` |
| 7 | Delete the paths from singleplayer in one commit naming this repo and tag | Gone from singleplayer | Done: singleplayer `9a449a8ed9` |
| 8 | Unfreeze; record the move in the meta repo's `STATE.md`; set this plan to finished | STATE.md says moved | Plan finished; `STATE.md` is the coordinator's to update |

Rollback: until step 7 singleplayer still has everything, so drop the import commit.
