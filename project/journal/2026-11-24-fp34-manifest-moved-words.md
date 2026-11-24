# The moved words leave the level manifest at format 0.1.0.5

> Written by: Claude (opus-pr6). Meta FORMAT-PRUNE FP34 (J486, J505). Built ahead on `plan/fp34`; it ships with the
> 0.75.0 cut.

ONE-FORMAT OF9b3 and OF9b4 moved the level manifest's page-start words (`spawn`, `loadout`, `audio`, `weapon`) into
their sections and its herd fields (`species`, `spawns`, `faunaTuning`) into declared rows; SDK 0.4.25 writes none of
them, and `gridShardfile` became `shardfile` (FP8). Older products still carry them, so they leave the FP33 way rather
than by a plain schema delete:

- Format 0.1.0.5 refuses a `ui/level` manifest that carries any of them (`checkNoMovedWords`, in
  `assembleOutputShardfile`, so both validators). An older file keeps them as written and its source hash still
  matches.
- Chain step `fp34-manifest-moved-words` (to 0.1.0.5) lifts the start words into `world/spawn`, `combat/items`'
  `loadout.level` and `audio/audio`'s `level` as `liftLevelStart` does at the door (a section's own value wins), and
  drops `weapon` and the herd fields: a copy can't redo a build's declared rows.
- The seven `manifest.<word>` deprecations name the step, so a migrated copy counts none of them.

The schema entries themselves stay until no kept file carries them (FE13), with the discovery mount's copy (FP36).
Tests: `format-migration-manifest.test.ts`, `deprecations.test.ts`; `src/format` 1,212 green, lock and gate green.

Rebased on 97ca4ec (11-24): its chain step has FE11 goldens now (`format-goldens.chain.ts --write`); every push checks each step has one.
