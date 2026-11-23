# FP26: the save lineage is `identity.saveRevision` (format 0.1.0.4)

> Written by: Claude (opus-nalati2, opus-nalati3)

Jake's J493 (2026-11-22): rename `identity.revision` to `saveRevision` now, with its save migration. The number keys
saves and only rises; calling it "revision" kept getting it read as the API's shard revision.

- Format 0.1.0.4 writes `saveRevision`. Either spelling reads, and both come out as `saveRevision`; only the old
  spelling in a 0.1.0.4 file refuses. Chain step `fp26-save-revision` renames the key; the number is kept, so every save
  keyed by it still matches. Deprecation `identity.revision`.
- The catch: the source hash and the cook preparation's inputs hash the parsed identity. A 0.1.0.3 file's hashes were
  taken over `revision`, so `asWrittenIdentity` spells it back for any format below 0.1.0.4 before hashing (validator,
  stream admit, cook preparation, chain rebuild, `shardfile pack`). Without it every pinned shard failed `source-hash`.
- The cli fixture's receipt restamps: `residentBytes` grows 16 bytes for the longer key.
- The helpers live in `save-revision.ts` (the src/format ratchet refused an import cycle through `outputIndex.ts`), and the identity schemas read both spellings through named functions.
