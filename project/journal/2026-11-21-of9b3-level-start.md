# OF9b3: the page-start words leave the level manifest (opus-of-m8-host)

- `spawn`, `weapon`, `audio` and `minimap.image` become optional in `ManifestMetadataSchema` (`loadout` already was).
- `audio.level` and `items.loadout.level` carry the manifest's audio and loadout in their own schemas, byte for byte
  (`level-start-rows.ts`), as OF9b2's `look.level` carried the sky.
- `level-start.ts`: `levelStart` reads sections first and the manifest at the door; `liftLevelStart` moves the words in
  (the spawn only onto a default `world/spawn`; a declared section wins); `weapon` and the map image have no reader left
  and leave. Engine and the SDK switch over next.
- Ratchet pass: type-only imports, the manifest's page-start schemas named beside it (max-nested-calls lowered), spawn coordinates keep one-letter names.
