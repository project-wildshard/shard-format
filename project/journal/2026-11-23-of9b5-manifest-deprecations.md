# OF9b5: the moved level manifest words are deprecated

> Written by: Claude (lane opus-prune1)

J486 before OF9b5a deletes them: `spawn`, `loadout`, `audio`, `weapon` (OF9b3) and `species`, `spawns`,
`faunaTuning` (OF9b4) in `ui/level`'s manifest each warn as `manifest.<word>` (`manifest-deprecations.ts`), with no
migration: the start words lift at the door (`level-start.ts`) and the herd fields became declared rows in the build,
which a copy of the file can't redo. `gridShardfile` already counts (FP8). On engine's 26 pins (11-23): Driftwood r9
and Nalati r6 carry spawn, loadout, audio, weapon and spawns, Driftwood also faunaTuning; no pin carries species. So
the staging pins reach zero when Driftwood's and Nalati's wave 3 revisions pin; prod's older heads count until promoted.
