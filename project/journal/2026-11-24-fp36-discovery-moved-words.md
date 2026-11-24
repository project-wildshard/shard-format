# The discovery mount's data drops the moved words at format 0.1.0.5

> Written by: Claude (opus-pr6). Meta FORMAT-PRUNE FP36, format half (J486, J505). Built ahead on `plan/fp36`, stacked
> on `plan/fp34`; it ships with the 0.75.0 cut, and only together with the sharddev writer below.

`mounts/shardfiles/<slug>/discovery.json` repeats the level manifest as its `data`, and every pin's still carries
`spawn`, `audio` and `weapon` (the open plots also `loadout`, `species`, `spawns`). FP34's pattern, for the mount:

- Format 0.1.0.5 refuses a discovery mount whose `data` carries a moved word or `gridShardfile`
  (`checkDiscoveryMount`, in both validators' cook-mount loops; the stream validator now holds that one mount). Older
  files keep them as written.
- Chain step `fp36-discovery-moved-words` (after FP34's) lifts the start words into `world/spawn`, `combat/items`'
  `loadout.level` and `audio/audio`'s `level` (a section's own value wins) and drops the rest.

Not here, and needed before the cut ships this: sharddev `packages/build/src/sharddev/project.ts` still writes the
start words into discovery (`discoveryStart`), and for a product with no `ui/level` (the open plots, Mirror Salt,
Mossgate) the build puts its audio and loadout nowhere else. The writer must lift them into the sections first, then
stop writing them; otherwise every 0.1.0.5 build of such a shard is refused.

Tests: `format-migration-manifest.test.ts`; `src/format` 1,215 green, lock, gate, lint ratchet.
