# One way: M1 inventory and ceilings

> Written by: Codex
> State: the ratchet reads today's mains and every engine pin, 2026-11-24
> (FORMAT-PRUNE FP42; the frozen M1 snapshot let a rise on main pass).

There is one shard format. `src/tools/one-way-baseline.json` records the
ceilings and the corpus JSON digests. A drop is allowed; a rise or a new
counter needs a fix, never a raised ceiling.

## Sources and identity

- Engine and SDK: each sibling's fetched `origin/main` (its checked-out head
  when there is none); CI checks out both mains. M1 recorded engine
  `df1554054fa5` (v0.1.23) and SDK `537b9f15f7c2`.
- Format: the current checkout's sources, docs, root Markdown and workspace
  package sources/docs; corpus JSON is inventoried separately.
- Git inputs come from immutable objects, excluding loose edits. Every blob
  is checked against its Git object hash before decoding.
- Product tarballs are every pin in that engine revision's catalogue (no
  slug list in code); the kinds the literal counter knows come from them.
  Each must match its SHA-256 and exact byte length. Cached pins are read
  without writing a cache; public mirrors provide a fallback.
- Corpus identities hash each shard's path-sorted JSON path/text list.
  Binary assets and validation reports are excluded from this text digest;
  product archive hashes separately cover the complete products.

## Counts and removal rows

Ceilings as of 2026-11-24, M1's in brackets. Removal rows are meta's
FORMAT-PRUNE rows.

| Counter | Ceiling | Removal row |
|---|---:|---|
| engine.kind-literals | 10 (24) | FP42; the rest are kit species and non-creature names |
| engine.kit-registrations | 0 (2) | done |
| engine.look-fallbacks | 0 (1) | done |
| engine.temperament-guesses | 0 (1) | done |
| engine.grid-pointer-references | 1 (21) | FP44 |
| sdk.grid-pointer-references | 0 (0) | done |
| format.grid-pointer-references | 5 (5) | FP44 |
| engine.access-gate-references | 0 (80) | done |
| engine.dangerous-gates | 0 (4) | done |
| sdk.engine-kit-imports | 0 (4) | done |
| sdk.old-kind-source-rows | 0 (6) | done (FP45) |
| engine.kind-keyed-tables | 0 (2) | done |
| format.kind-keyed-tables | 0 (1) | done |
| engine.retired-vocabulary | 0 (908) | done (FP46) |
| format.retired-vocabulary | 0 (198) | done (FP46) |
| sdk.retired-vocabulary | 0 (84) | done (FP46) |
| products.rows-without-look | 0 (0) | done |
| products.species-program-sections | 0 (4) | done |
| products.repeated-manifest-fields | 7 (12) | FP47 |
| products.single-shard-server-hosts | 16 (41) | FP48 |
| products.single-shard-page-features | 23 (30) | FP49 |
| corpus.rows-without-look | 0 (0) | done |
| corpus.species-program-sections | 0 (0) | done |
| corpus.repeated-manifest-fields | 9 (11) | FP47 |

## Scope and exclusions

Mechanism counters include runtime src and workspace package src. Tests,
specs and directories named test, __tests__ or e2e are excluded from these
counters. Vocabulary counters include source tests, docs and root Markdown,
except a format migration step, the deprecations and their tests, which
name the old shape they rewrite;
camelCase boundaries are split before matching. Corpus payloads do not count
as authored wording. Dependencies, build output, binaries, caches, journals
and Git metadata are excluded.

The SDK old-row counter reads authored rows.json and species.json inputs.
It counts an old-label species with variants while its body or temperament
is absent. A complete explicit row may keep its kind label; a preset name
is not an old-row expansion. The engine literal counter counts quoted labels
drawn from every pinned native, page and open species row.

Looks come from both actors/species and look/materials rows. Server hosts
come from addressed native-assembly documents; page features come from
client/plan. Repeated manifest fields count unique field names, rather than
all appearances across shards.

J367 (7) excludes page families world.*, view.* and page.life (world rendering,
view programs and page lifetime). debug.expose remains in scope. No server
host is excluded. Distinct users are catalogue shard names; repeating a host
within one shard never supplies another user. Corpus copies do not become
extra runtime users: their row, section and manifest counts are separate.

## Relation to the November 15 audit

The audit surveyed older commits and local output. Both inventories find
two registrations, one look fallback, twelve repeated manifest names and
41 single-shard server hosts. The page count is 30 after the stated J367
exclusions. Exact vocabulary ceilings are 908 / 198 / 84, replacing the
audit's approximate 840 / 190 / 85. Every pinned open species now has a look,
including the Template boar; its historical omission cannot raise a ceiling.

## Updating the inventory

Lower a ceiling after its removal row lands; never increase it to pass.
Update corpus JSON identities alongside the corpus source change.
The normal Node test discovery includes one-way.test.ts. CI checks out the
engine and SDK mains into lane scratch before the check, so a rise on either
main turns this repo's CI red: fix it on that main. Local worktrees find
sibling checkouts through Git's common directory and read their fetched main.
WS_ONE_WAY_ENGINE_ROOT and WS_ONE_WAY_SDK_ROOT override their locations;
WS_ONE_WAY_ENGINE_REVISION and WS_ONE_WAY_SDK_REVISION select branch proofs.
The comparison rejects any rise or unrecorded corpus identity. The fault
drills use committed temporary Git snapshots, and each planted change fails
only its own counter; one plants a kind literal on a fixture's newest main.
