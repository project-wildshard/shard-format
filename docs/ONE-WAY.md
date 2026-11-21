# One way: M1 inventory and ceilings

> Written by: Codex
> State: pinned baseline and CI ratchet built, 2026-11-15; M1 land pending.

There is one shard format. `src/tools/one-way-baseline.json` records exact
source revisions, product archive hashes and byte counts, corpus JSON digests,
and ceilings. A drop is allowed; a rise or a new counter needs a fix.

## Sources and identity

- Engine: `df1554054fa58d16072d4173e6b5036cd574505e` (v0.1.23).
- SDK: `537b9f15f7c20432aa334146946a6983ab6b9a6c`.
- Format: the current checkout's sources, docs, root Markdown and workspace
  package sources/docs; corpus JSON is inventoried separately.
- Git inputs come from immutable objects, excluding loose edits. Every blob
  is checked against its Git object hash before decoding.
- Product tarballs come from that engine revision's pin catalogue, narrowed
  to the slugs the baseline's `pins` records (no slug list in code).
  Each must match its SHA-256 and exact byte length. Cached pins are read
  without writing a cache; public mirrors provide a fallback.
- Sky Reach is named `far-reach` in the engine catalogue. Other names:
  blender-template, template, sunscar-dunes, nine-dragon-stack,
  driftwood-isle, pine-hollow and nalati-grasslands.
- Corpus identities hash each shard's path-sorted JSON path/text list.
  Binary assets and validation reports are excluded from this text digest;
  product archive hashes separately cover the complete products.

## Counts and removal rows

| Counter | Ceiling | Removal row |
|---|---:|---|
| engine.kind-literals | 24 | OF5b, OF31 |
| engine.kit-registrations | 2 | OF5b |
| engine.look-fallbacks | 1 | OF5b |
| engine.temperament-guesses | 1 | CC4 |
| engine.grid-pointer-references | 21 | OF8 |
| sdk.grid-pointer-references | 0 | OF8 |
| format.grid-pointer-references | 5 | OF8 |
| engine.access-gate-references | 80 | OF10a to OF10c |
| engine.dangerous-gates | 4 | OF10c1 to OF10c4 |
| sdk.engine-kit-imports | 4 | OF5a / SDK-SPLIT SP3 |
| sdk.old-kind-source-rows | 6 | CC4, OF4 |
| engine.kind-keyed-tables | 2 | OF31 |
| format.kind-keyed-tables | 1 | OF31 |
| engine.retired-vocabulary | 908 | OF15 |
| format.retired-vocabulary | 198 | OF15 |
| sdk.retired-vocabulary | 84 | OF15 |
| products.rows-without-look | 0 | OF4, OF5b |
| products.species-program-sections | 4 | OF13, OF21 to OF24 |
| products.repeated-manifest-fields | 12 | OF6 to OF9b |
| products.single-shard-server-hosts | 41 | OF16, OF17, M8 |
| products.single-shard-page-features | 30 | OF16, M8 |
| corpus.rows-without-look | 0 | OF4, OF5b |
| corpus.species-program-sections | 0 | OF13 |
| corpus.repeated-manifest-fields | 11 | OF6 to OF9b |

## Scope and exclusions

Mechanism counters include runtime src and workspace package src. Tests,
specs and directories named test, __tests__ or e2e are excluded from these
counters. Vocabulary counters include source tests, docs and root Markdown;
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

Keep source ids and product identities reviewable. On a source-pin change,
collect that exact revision and compare it against the existing ceilings.
Lower a ceiling after its removal row passes; never increase it to pass.
Update corpus JSON identities alongside the corpus source change.
The normal Node test discovery includes one-way.test.ts. CI reads these
source ids and checks out both snapshots into lane scratch before the check.
Local worktrees find sibling checkouts through Git's common directory.
WS_ONE_WAY_ENGINE_ROOT and WS_ONE_WAY_SDK_ROOT override their locations;
WS_ONE_WAY_ENGINE_REVISION and WS_ONE_WAY_SDK_REVISION select branch proofs.
The comparison rejects any rise, unrecorded product pin or corpus identity.
Both fault drills use committed temporary Git snapshots, and each planted
change fails only its own counter. Advance the source ids to completed M1
branch commits before landing; the audit input is deliberately frozen until
that reviewed update.
