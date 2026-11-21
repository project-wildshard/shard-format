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

## FP8 and FP3: same-version steps, and JSON cook mounts

`fp8-shardfile-pointer` renames `gridShardfile` to `shardfile` and `fp3-drop-runtime-trust` drops `runtime.trust`.
Both write a shape a 0.1.0.1 reader already admits, so they are repairs at 0.1.0.1 and need no format bump; refusing
the old shape in new uploads waits until the API and engine read migrated copies. Nalati r4 and Pine r9 also carry
the old pointer in their discovery mount, so a step can now edit JSON cook mounts under `mounts/`: the chain writes a
changed mount, points its cook rows and fence entry at the new hash and re-seals the preparation over it. Nalati r4,
Pine r9 and Driftwood r8 are 0.1.0.1 corpus fixtures; their copies validate with the author preparation re-sealed.

## FE8: ops, the registry check, and file routing

Steps now build from `format-migration-ops.ts`: `rename` (key order kept; both keys set to different values refused),
`drop`, `fill`, `map`, `moveSection` (payload, index row, path and schema id move together; the copy drops the old
path) and `renameKind`. `checkMigrations` runs before every chain run and refuses a repeated id, a `to` that is not a
format version, steps out of version order, and a save-affecting step with no `saveMigration`. `touches: 'files'`
routes like `affects: render`: the copy's author preparation is stale and the box's cook prepares again. Editing named
JSON blobs (FP10) stays out until a step needs it, since a blob's path carries its hash and other rows depend on it.

## FP12: the slug-keyed memory tables go

CP10 judges a stored original by its stored verdict, so the four held products no longer need a hold and the J412
baselines are never read for them. `memory-ratchet.ts` (four slug-keyed baselines and `staleRevision`) and
`memory-armed.json`'s `held` block are deleted; its four decisions (`ratchetLimit`, `ratchetSeverity`, `ratchetNote`,
`staleReadingAdmitted`) live in `memory-armed.ts` and read only the armed list. The four zones stay unarmed, as they
were; the armed list itself moves to the API catalogue at FP27.

## FE7: the deprecation counter

`src/format/deprecations.ts` lists each deprecated path with `since`, `replacement` and the chain step that mends it
(or none). Both validators add one warning per used path and a `deprecations` id list (`DeprecationReport`), so
`shard-format validate` prints them and the API can put them on the receipt. `shard-format corpus` counts the kept
originals using each (`corpus-deprecations.ts`); a valid verdict cached before FE7 is judged again. Seeded with
`version.two-part` (FP6), `manifest.gridShardfile` (FP8) and `runtime.trust` (FP3).
