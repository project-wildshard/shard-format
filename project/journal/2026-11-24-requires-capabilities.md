> Written by: Claude (opus-grid)

# 2026-11-24: requires.capabilities leaves the format (FP4)

FORMAT-PRUNE FP4 (J505 build-ahead), its last field. `requires.capabilities` was kept in 0.1.0.2 (`03d0c38`) because a
writer whose source still carried `capabilities: []` failed the strict schema. It is now optional, so such a writer still
validates, and a repair step `fp4-drop-requires-capabilities` (to 0.1.0.4) drops it from every copy; the copy's source
hash is re-sealed as for any data step. The empty shard file no longer carries it, and the FE7 deprecation names the step.
Brasscap's SS3 copy validates without it; next, sharddev `author.ts` and shard-stranger `src/shard.json` stop writing it.
