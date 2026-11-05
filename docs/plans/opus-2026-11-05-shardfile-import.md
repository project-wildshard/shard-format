# shardfile: import from singleplayer

Status: in progress 2026-11-05: steps 1–5 done (imported from
singleplayer `36d00c6645`, green, v0.1.0 tagged); steps 6–8 wait on the
CI token (P0.2) and a go from the singleplayer side.

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
| 6 | Switch: singleplayer uses this repo (git dependency or deploy) instead of its own copy | Singleplayer CI green | Waits: singleplayer CI has no org token (P0.2) |
| 7 | Delete the paths from singleplayer in one commit naming this repo and tag | Gone from singleplayer | Waits on 6 |
| 8 | Unfreeze; record the move in the meta repo's `STATE.md`; set this plan to finished | STATE.md says moved | Waits on 7 |

Rollback: until step 7 singleplayer still has everything, so drop the import commit.
