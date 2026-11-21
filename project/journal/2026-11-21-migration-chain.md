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

## The first repair step: journal glyph icons (Pine Hollow r1 to r6)

The FE3 corpus run found six Pine Hollow revisions refused at `rows.compendiums.0`: 036b383 made journal icons
image-only without a migration, and r5 is production's pointer. `journal-glyph-images` writes each retired glyph
(`antlers`, `ghost`, `ironhide`, `deer`, `boar`, `elk`, `bear`) as the inert SVG the engine drew for it, frozen in
`src/format/journal-glyphs.json`, and raises `admission.budgets.library.resident` by the new rasters. Because the
break landed inside 0.1.0.1, the step is a repair: `repairs` lets it run on a file already at its `to` version when
the old shape is there. Pine r5 is now a 0.1.0.0 corpus fixture; `pnpm test:chain` migrates and validates it.
