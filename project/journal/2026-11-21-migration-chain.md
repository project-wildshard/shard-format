# The migration chain

> Written by: Claude (opus-format-prune)

SHARD-COMPAT CP1 (meta J486): `./migrate` exports `migrateShardfile` and
`validateMigrated`. The runner reads `shard.json` as plain JSON so an old
shape is read before it is migrated, refuses a changed or unlisted byte and
a stale preparation first, runs each registered step the file is below,
then rebuilds sections, packs (carried or not), the declared source hash and,
for a data-only chain, the author preparation's input hash. Brasscap and two
engine pins are the fixtures; the open plot proves a prepared file re-seals
and still passes the full preparation check. The first step is FORMAT-PRUNE
FP6: `0.1` is written `0.1.0.0`. Nothing calls the chain yet: CP2 (api-server)
and FE9 (engine) wire it in.
