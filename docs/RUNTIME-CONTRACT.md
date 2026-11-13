# Runtime contract: what a shard may declare

> Written by: Claude

> **State:** living, 2026-11-13 (SHARD-AUTHORING SA19). The engine host columns were copied from engine `8f613824`.

A shard is data. A shard file never carries code that engine imports: it declares names, and engine runs only the
**trusted hosts** compiled into it, on the page (the browser client) and on the server (rooms, and the worker that runs
the server's code inside every page, offline included). This page lists every name a shard may declare, which engine
host serves it, and what validation refuses. An agent can read it without reading engine.

Read with [SHARDFILE.md](SHARDFILE.md) (the fields inside each section), [SCRIPT-ABI.md](SCRIPT-ABI.md) (the Wasm
scripts) and [PLATFORM-FILE-FAMILIES.md](PLATFORM-FILE-FAMILIES.md) (the named files).

Words: **page** is the game's web client; **server** is rooms and the offline worker; **both** means engine's shared
code, run by both sides; **shard-format** means the host parses the section with this package's schema. **Validation**
is shard-format's check of a shard file, which runs on the author's machine, in the API and in engine; every "refused"
below is validation (or engine's load, where named) failing.

## Generated and hand-kept

Every table below between `generated` markers comes from this package's code, through `node src/tools/runtime-contract.ts write`.
`src/tools/runtime-contract.test.ts` fails when the page differs from the code. Two columns are engine's alone and are
hand-kept in [`src/tools/runtime-hosts.json`](../src/tools/runtime-hosts.json): a section's **Engine host** (engine
`scripts/host-ruler/roots.mjs` `SECTION_HOSTS`) and a kind's **Page host** and **Reads sections** (engine
`src/client/game/shardfile/clientPlan.ts` `CLIENT_FEATURES`). The test fails when that file misses a section or a kind
this package defines, or names one it doesn't. It cannot see an engine host that was renamed: when engine changes either
table, copy it again and rerun `write`. The follow-up that closes this gap is an engine check (HOST-RULER) that reads
`@wildshard/shard-format/runtime-hosts.json` (it ships in the package) from the pinned shard-format and fails when `SECTION_HOSTS` or `CLIENT_FEATURES` differ from it.

## 1. Sections

A section is one file, `sections/<name>.json` in the shard file folder, listed in `shard.json` `sections[]` with its
schema id. Every section is at version 1: the schema id is exactly `wildshard:<name>@1`. A shard may list at most 256
sections; together they may not pass `sourceBytes` (section 7). There are no custom sections.

**Holds** says what the file contains. A **root** section is a slice of the shard file's root fields (the tables in
[SHARDFILE.md](SHARDFILE.md)): `{ "tiles": …, "far": … }`, `{ "rows": { "species": … } }` or `{ "runtime": { "spawns": … } }`,
and nothing else. A **plain value** section holds its own schema's value, defined in `src/format/platformDataSections.ts`.

<!-- generated:sections -->
| Section | Schema | Holds | Engine host |
| --- | --- | --- | --- |
| `actors/creatures` | `wildshard:actors/creatures@1` | root `creatures` | `installDeclaredBrains` (server) |
| `actors/crowds` | `wildshard:actors/crowds@1` | root `crowds` | `prepareDeclaredCrowds` (both) |
| `actors/moves` | `wildshard:actors/moves@1` | plain value | `ActorMoveRunner` (server), `parseActorMoves` (shard-format) |
| `actors/npcs` | `wildshard:actors/npcs@1` | root `questNpcs` | `installDeclaredQuestHost` (server) |
| `actors/return-scripts` | `wildshard:actors/return-scripts@1` | plain value | `ReturnProgram` (both), `parseDecisionScripts` (shard-format) |
| `actors/spawn-scripts` | `wildshard:actors/spawn-scripts@1` | plain value | `SpawnScript` (server), `parseSpawnScript` (shard-format) |
| `actors/spawns` | `wildshard:actors/spawns@1` | root `runtime.spawns` | `installDeclaredBrains` (server) |
| `actors/species` | `wildshard:actors/species@1` | root `rows.species` | `speciesResolver` (server), `clientSpeciesLooks` (page) |
| `actors/species-programs` | `wildshard:actors/species-programs@1` | plain value | none: Metadata lent to existing page/native species and hunt owners. |
| `actors/strikes` | `wildshard:actors/strikes@1` | plain value | none: Consumed by the runtime's explicitly imported creature host. |
| `audio/audio` | `wildshard:audio/audio@1` | root `audio` | `installDeclaredAudio` (page) |
| `client/plan` | `wildshard:client/plan@1` | plain value | `installClientPhase` (page) |
| `collections/displays` | `wildshard:collections/displays@1` | plain value | `CollectionCatalogue` (page) |
| `combat/encounters` | `wildshard:combat/encounters@1` | root `encounters` | `createShardfileSim` (server) |
| `combat/items` | `wildshard:combat/items@1` | root `items` | `installDeclaredItems` (both) |
| `combat/strikes` | `wildshard:combat/strikes@1` | root `rows.strikes` | `createShardfileSim` (server) |
| `economy/ledger` | `wildshard:economy/ledger@1` | root `ledger` | `Ledger` (both), `installLedgerEmitter` (both) |
| `economy/loot` | `wildshard:economy/loot@1` | root `rows.loot` | `declaredLootPresentation` (both) |
| `explore/catalogue` | `wildshard:explore/catalogue@1` | plain value | `explorerRoster` (page) |
| `held/arms` | `wildshard:held/arms@1` | plain value | `HeldClaims` (page), `HeldView` (page) |
| `held/equipment` | `wildshard:held/equipment@1` | plain value | `HeldEquipment` (page) |
| `held/finishes` | `wildshard:held/finishes@1` | plain value | `HeldFinishes` (page) |
| `held/gear` | `wildshard:held/gear@1` | plain value | `heldGear` (page) |
| `held/loadout` | `wildshard:held/loadout@1` | plain value | `installHeldLoadout` (page) |
| `look/colour-functions` | `wildshard:look/colour-functions@1` | plain value | `materialColourGraph` (page) |
| `look/hull-book` | `wildshard:look/hull-book@1` | plain value | `productHullBook` (page) |
| `look/keyed-sky` | `wildshard:look/keyed-sky@1` | plain value | `keyedSkyBackdrop` (page) |
| `look/look` | `wildshard:look/look@1` | root `look`, `presentation` | `shardfileLook` (page) |
| `look/map` | `wildshard:look/map@1` | root `map` | `reserveMapImage` (page) |
| `look/materials` | `wildshard:look/materials@1` | root `rows.looks` | `clientMaterials` (page) |
| `look/painted` | `wildshard:look/painted@1` | plain value | `productPaintedLook` (page) |
| `look/rigged-hulls` | `wildshard:look/rigged-hulls@1` | plain value | `productRiggedHulls` (page) |
| `look/toon` | `wildshard:look/toon@1` | plain value | `toonLook` (page) |
| `models/island-library` | `wildshard:models/island-library@1` | plain value | `IslandLibrary` (page) |
| `player/stealth` | `wildshard:player/stealth@1` | plain value | `StealthController` (page), `StealthRowsSchema` (shard-format) |
| `quests/directors` | `wildshard:quests/directors@1` | root `directors` | `DirectorStageLane` (both) |
| `quests/host` | `wildshard:quests/host@1` | root `questHost` | `installDeclaredQuestHost` (server) |
| `quests/quests` | `wildshard:quests/quests@1` | root `quests` | `DeclaredQuests` (both) |
| `sim/bodies` | `wildshard:sim/bodies@1` | plain value | `DeclaredBodyOps` (server), `DeclaredBodyOpsSchema` (shard-format) |
| `sim/client-channels` | `wildshard:sim/client-channels@1` | root `clientChannels` | `ClientScriptViews` (page) |
| `sim/client-scripts` | `wildshard:sim/client-scripts@1` | root `clientScripts` | `createShardfileClientScripts` (page) |
| `sim/hooks` | `wildshard:sim/hooks@1` | root `hooks` | `createShardfileScriptLane` (server) |
| `sim/plumbing` | `wildshard:sim/plumbing@1` | root `plumbing` | `installDeclaredPlumbing` (page) |
| `sim/runtime-plan` | `wildshard:sim/runtime-plan@1` | plain value | `prepareProductRuntimePlan` (server) |
| `sim/scripts` | `wildshard:sim/scripts@1` | plain value | `DecisionHost` (server), `parseDecisionScripts` (shard-format) |
| `sim/sim` | `wildshard:sim/sim@1` | root `sim` | `createShardfileScriptLane` (server) |
| `state/migrations` | `wildshard:state/migrations@1` | root `migrations` | `logicalStateFromLane` (both) |
| `state/modes` | `wildshard:state/modes@1` | root `modes` | `playerModes` (both) |
| `state/state` | `wildshard:state/state@1` | root `state` | `numericScriptState` (server) |
| `ui/card` | `wildshard:ui/card@1` | root `accent` | none: Discovery metadata; no per-shard executable implementation. |
| `ui/compendium` | `wildshard:ui/compendium@1` | root `rows.compendiums` | `declaredProductCompendium` (both) |
| `ui/completion` | `wildshard:ui/completion@1` | plain value | `installCompletion` (page) |
| `ui/level` | `wildshard:ui/level@1` | root `manifest` | none: Metadata read by another host. |
| `ui/strings` | `wildshard:ui/strings@1` | plain value | none: Read by an explicitly imported consumer, not executed. |
| `ui/ui` | `wildshard:ui/ui@1` | root `ui`, `targets` | `mountDeclaredUi` (page), `installDeclaredTargets` (page) |
| `view/modules` | `wildshard:view/modules@1` | plain value | `ViewModulesSchema` (shard-format), `admitScriptContract` (shard-format) |
| `world/collision` | `wildshard:world/collision@1` | root `meshCollision` | `installShardfileColliders` (both) |
| `world/days` | `wildshard:world/days@1` | root `rows.days` | `declaredDay` (both) |
| `world/edge` | `wildshard:world/edge@1` | root `edge`, `entryways` | `createPortalTraversal` (both) |
| `world/movers` | `wildshard:world/movers@1` | root `movers` | `createComposedMoverHost` (server), `installClientMoverOwners` (page) |
| `world/navigation` | `wildshard:world/navigation@1` | root `navigation` | `installProductNavigation` (page) |
| `world/physics` | `wildshard:world/physics@1` | plain value | none: Handed to the runtime's explicitly imported native host. |
| `world/props` | `wildshard:world/props@1` | root `props` | `propColliderDescriptors` (both) |
| `world/scenes` | `wildshard:world/scenes@1` | plain value | `installWorldScenes` (page) |
| `world/spawn` | `wildshard:world/spawn@1` | root `spawn` | none: Level admission metadata. |
| `world/targets` | `wildshard:world/targets@1` | plain value | `WorldTargetHost` (both) |
| `world/terrain` | `wildshard:world/terrain@1` | root `terrain`, `nativeGround` | `clientGround` (both) |
| `world/tiles` | `wildshard:world/tiles@1` | root `tiles`, `far`, `near`, `ring` | `clientTileViews` (page) |
| `world/traversal` | `wildshard:world/traversal@1` | root `traversal` | `createPortalTraversal` (both) |
| `world/trees` | `wildshard:world/trees@1` | plain value | `productTreeSet` (page), `placeForestPageModels` (page) |
| `world/water` | `wildshard:world/water@1` | root `water` | `installClientWater` (page), `shardfileWater` (page) |
| `world/weather` | `wildshard:world/weather@1` | root `rows.weather` | `declaredWeather` (both) |
<!-- /generated:sections -->

## 2. `client/plan` kinds

`client/plan` is `{ "version": 1, "features": [ … ] }`, at most 64 features. Each feature's `kind` picks one
compiled-in page host; a feature never names a module, owner or property path. The server's code ignores `client/plan`
except for the five reads engine's server-parity audit lists (HS6 moves them into native-assembly rows).

**Side** comes from `src/format/feature-sides.ts`: `view` draws on the page and writes no gameplay; `both` means the
server owns the gameplay and the page draws it, and **Server host** names the server installer. A kind with no side
is refused ("Unsided content kind"). **Reads sections** must be present in the shard file, or engine's load refuses
("Missing feature section"), with four exceptions: `world.updates` without a `toon-look` row, `held.claims.prepare` with
a `source`, and `content.catalogue` without finishes need none; `species.program` with a `catalogue` needs
`look/hull-book`.

<!-- generated:kinds -->
| Kind | Side | Server host | Page host | Reads sections |
| --- | --- | --- | --- | --- |
| `arena-room.entry` | view | — | `installArenaRoomEntry` | — |
| `audio.cues` | view | — | `installClientCues` | `world/scenes` |
| `audio.scene` | view | — | `enterClientAudioScene`, `installClientAudioScene` | — |
| `bag.finds` | view | — | `installClientFinds` | — |
| `boss.held` | both | `heldBoss` | `installClientBossFight` | `sim/runtime-plan` |
| `boss.spawned` | view | — | `installClientBossFight` | `sim/runtime-plan` |
| `boss.telegraph` | view | — | `installClientBossTelegraph` | `sim/runtime-plan`, `actors/strikes` |
| `combat.targets` | both | `heldArms` | `installCombatTargets` | — |
| `content.catalogue` | both | `loadout` | `installClientCatalogue` | `held/finishes` |
| `debug.expose` | view | — | `SceneDressing` | — |
| `elite.construct` | both | `windElite` | `installClientEliteConstruction` | — |
| `elite.entry` | both | `windElite` | `installClientEliteEntry` | — |
| `fx.trail` | view | — | `installClientTrails` | `world/scenes` |
| `held.claims.enter` | both | `grapple` | `entryOwner` | `held/arms` |
| `held.claims.install` | both | `heldArms` | `installHeldClaimsEntry` | — |
| `held.claims.prepare` | both | `heldArms` | `prepareHeldClaimsEntry` | `held/arms` |
| `held.cosmetics` | view | — | `installClientCosmeticFinishes` | `held/finishes` |
| `held.melee` | both | `melee` | `enterClientHeldMelee`, `installClientHeldMelee` | `look/painted` |
| `held.ranged-feel` | view | — | `installHeldRangedFeel` | — |
| `held.ranged-page` | both | `heldRanged` | `installEntryRangedPage`, `prepareRangedPage` | `held/finishes` |
| `light.emitters` | view | — | `installLightEmitters` | `world/scenes` |
| `look.painterly` | view | — | `setPainterlyLook` | — |
| `motion.channels` | view | — | `installSceneMotion` | `world/scenes` |
| `page.life` | view | — | `installClientPageLife` | — |
| `player.enter` | both | `fallFloor` | `enterClientPlayer`, `installClientPlayerEnter` | — |
| `population.homes` | view | — | `installClientPopulation` | `sim/runtime-plan`, `sim/scripts` |
| `population.hull-book` | view | — | `prepareDeclaredHullBookKit` | `actors/species-programs`, `explore/catalogue` |
| `population.product-creatures` | view | — | `installProductCreatures` | `actors/species-programs` |
| `population.wildlife` | view | — | `clientWildlife`, `installClientWildlife` | — |
| `portal.ride` | both | `portalRide` | `installDeclaredPortalRide` | — |
| `practice.course` | view | — | `installPracticeCourse` | — |
| `quest.chapter-view` | view | — | `installEntryChapterView` | — |
| `quest.composition` | both | `questComposition` | `installEntryQuestComposition` | — |
| `quest.continuation` | both | `keepsakes` | `installQuestContinuationFile` | — |
| `quest.page` | both | `questHost` | `finishClientQuestPage`, `installClientQuestPage` | `world/scenes`, `world/targets`, `look/painted` |
| `quest.reference` | both | `places` | `installEntryQuestReference` | — |
| `quest.spawns` | view | — | `installDeclaredQuestSpawns`, `publishEntryOwner` | — |
| `quest.views` | view | — | `installEntryQuestViews` | `world/scenes` |
| `quest.world` | both | `places` | `prepareQuestWorldEntry` | — |
| `riding.session` | view | — | `installClientRiding` | — |
| `species.program` | view | — | `installClientSpeciesProgram`, `prepareClientSpeciesCatalogue` | `actors/species-programs`, `sim/scripts`, `sim/runtime-plan` |
| `state.adventure` | both | `saves` | `installClientAdventurePersistence` | — |
| `stealth.entry` | both | `stealth` | `installClientStealthEntry`, `prepareClientStealthEntry` | `player/stealth` |
| `strings.register` | view | — | `levelRegistrations.strings` | `ui/strings` |
| `taming.entry` | view | — | `installTamingEntry` | — |
| `timed.encounters` | both | `slots` | `installClientTimedEncounters` | — |
| `view.program` | both | `poseViews` | `installViewProgram` | `view/modules` |
| `weather.fields` | view | — | `installWeatherFields` | — |
| `weather.forest` | view | — | `installClientForestWeather` | — |
| `world.ambient-life` | both | `harvest` | `installClientAmbientLife` | — |
| `world.assembly` | both | `collision` | `installClientWorldAssembly` | `world/scenes` |
| `world.baked` | both | `collision` | `installClientBakedTiles` | — |
| `world.bind-sets` | view | — | `bindEnteredClientPlaceSets` | — |
| `world.dressing` | both | `collision` | `SceneDressing` | `world/scenes` |
| `world.forest-page` | both | `collision` | `enterClientForestPage`, `installClientForestPage` | — |
| `world.meadow` | view | — | `installClientMeadow` | — |
| `world.movers` | both | `movers` | `installClientMoverOwners` | `world/movers` |
| `world.paths` | both | `collision` | `installClientPathRamps` | — |
| `world.runtime-hooks` | both | `fallFloor` | `installClientRuntimeHooks` | — |
| `world.scenes` | both | `collision` | `StreamingCamera`, `cameraCone`, `followResidentTiles`, `installWorldScenes`, `noteTileBytes`, `productTileRing`, `residentTiles` | `world/scenes` |
| `world.sets` | view | — | `installClientPlaceSets` | — |
| `world.updates` | view | — | `installWorldUpdates` | `look/toon` |
| `world.water` | view | — | `installClientWaterSurfaces` | — |
<!-- /generated:kinds -->

### `world.assembly` stages

A `world.assembly` feature's `rows.stages[]` each carry a `kind`, sided the same way. A stage that places solids is
`both`, built on the server by the `collision` bake.

<!-- generated:stages -->
| Stage | Side | Server host |
| --- | --- | --- |
| `ambient-flock` | view | — |
| `arena-room` | both | `arenaRoom` |
| `drawn-models` | view | — |
| `dressing` | both | `collision` |
| `dressing-anchor` | both | `collision` |
| `dressing-piece` | both | `collision` |
| `entry` | both | `collision` |
| `fixed-draws` | view | — |
| `group` | both | `collision` |
| `mesh` | both | `collision` |
| `painted-reseed` | view | — |
| `painted-world` | view | — |
| `place` | both | `collision` |
| `rope-chain` | both | `ropeDecks` |
| `rope-deck` | both | `ropeDecks` |
| `site` | both | `collision` |
| `streamed-cover` | view | — |
| `water-surface` | view | — |
<!-- /generated:stages -->

## 3. Server-class files

`server/native-assembly.json` is a shard's native runtime plan; any other `server/<name>.json` is plain rows the plan
reads (J90). They ship only in `shard.json` `admission.server`: never in `files`, a section or a pack, so no page can
fetch one (J91). The plan's `features[]` each name a server host:

<!-- generated:server -->
`server/native-assembly.json` `features[].host`, 46 hosts: `ammunition`, `boss.arena`, `boss.ground`, `boss.open-arena`, `collision`, `collision.pieces`, `combat.motion`, `commands`, `day.declared`, `day.keyed-sky`, `day.toon`, `decisions`, `encounter.patrol`, `grapple`, `held.arms`, `item.ranged`, `item.swept`, `loadout`, `population.elites`, `population.elites-ready`, `population.environment`, `population.mixed`, `population.poses`, `population.reactions`, `population.roster`, `population.settle`, `population.shelter`, `population.spawn-script`, `portal.ride`, `quest.body-scripts`, `quest.chapter`, `quest.composition`, `quest.kill-steps`, `riding.elites`, `riding.elites-ready`, `riding.environment`, `riding.groups`, `riding.hunt`, `riding.mounted`, `riding.roster`, `riding.taming`, `riding.trample`, `water.field`, `water.sea`, `weather.native`, `weather.program`.

`sim/runtime-plan` `kind`: `held-melee`.
<!-- /generated:server -->

A shard with neither plan runs on engine's data cell, which builds its world from the sections alone.

## 4. Named files

A JSON file in `files` with a `name` must match a registered family, and validation runs that family's defining schema
on it. An unregistered name is refused ("Unregistered named JSON"), and `custom/` names are retired. Unnamed files
(GLB, KTX2, audio, Wasm, tiles, binaries, images) are referenced by hash from the sections. How a family is admitted:
[PLATFORM-FILE-FAMILIES.md](PLATFORM-FILE-FAMILIES.md). **Defining schema** is the registry's schema id, which keeps the old
`@wildshard/format` spelling; it is a string, not an import path (import from `@wildshard/shard-format`).

<!-- generated:families -->
| Name pattern | Defining schema |
| --- | --- |
| `^server\/native-assembly\.json$` | `@wildshard/format/nativeAssembly#NativeAssemblySchema` |
| `^server\/[a-z0-9][a-z0-9.-]*\.json$` | `@wildshard/format/nativeAssembly#NativeAssemblyDataSchema` |
| `^quests\/runtime\.json$` | `@wildshard/format/questRuntime#QuestRuntimeDocumentSchema` |
| `^quests\/forest-story\.json$` | `@wildshard/format/questStoryBindings#QuestStoryBindingsSchema` |
| `^quests\/content\.json$` | `@wildshard/format/questPageComposition#ChapterViewSchema` |
| `^actors\/projection\.json$` | `@wildshard/format/populationProjection#PopulationProjectionSchema` |
| `^poses\/monkey\.json$` | `@wildshard/format/mixedPopulation#PerchBodyFileSchema` |
| `^quests\/interaction-source\.json$` | `@wildshard/format/questInteractionSource#QuestInteractionSourceSchema` |
| `^sim\/enemy-placement\.json$` | `@wildshard/format/populationProjection#EnemyPlacementsSchema` |
| `^sim\/population-metadata\.json$` | `@wildshard/format/populationEnvironment#PopulationHabitatSchema` |
| `^sim\/taming-poses\.json$` | `@wildshard/format/populationRoster#TamingPoseFileSchema` |
| `^quests\/native-spots\.json$` | `@wildshard/format/nativeQuestComposition#NativeQuestServiceSpotsSchema` |
| `^quests\/contracts\.json$` | `@wildshard/format/contracts#ContractCatalogueSchema` |
| `^quests\/discovery\.json$` | `@wildshard/format/questStory#AdventureContentSchema` |
| `^quests\/hints\.json$` | `@wildshard/format/questSteps#QuestHintRowsSchema` |
| `^quests\/wake-boss\.json$` | `@wildshard/format/chapterDirector#ChapterWakeSchema` |
| `^quests\/carried\.json$` | `@wildshard/format/questSteps#CarriedQuestSchema` |
| `^quests\/finds\.json$` | `@wildshard/format/findsCatalogue#FindsCatalogueSchema` |
| `^actors\/creature-install\.json$` | `@wildshard/format/speciesLooks#CreatureInstallSchema` |
| `^sim\/returns\.json$` | `@wildshard/format/namedJsonContracts#PageReturnRowsSchema` |
| `^actors\/roster\.json$` | `@wildshard/format/populationRoster#NativePopulationRowsSchema` |
| `^actors\/elites\.json$` | `@wildshard/format/eliteFeature#EliteFeatureSchema` |
| `^actors\/shelter\.json$` | `@wildshard/format/herdShelter#PopulationShelterSchema` |
| `^actors\/sheep\.json$` | `@wildshard/format/speciesActorsFile#SpeciesActorsFileSchema` |
| `^actors\/wildlife\.json$` | `@wildshard/format/wildlifePopulation#WildlifePopulationSchema` |
| `^combat\/roaming\.json$` | `@wildshard/format/roamingCombat#RoamingCombatSchema` |
| `^client\/ranged-page\.json$` | `@wildshard/format/rangedPage#RangedPageSchema` |
| `^combat\/room-entry\.json$` | `@wildshard/format/arenaRoomDocument#ArenaRoomDocumentSchema` |
| `^combat\/timed-encounters\.json$` | `@wildshard/format/encounterRows#TimedEncountersSchema` |
| `^combat\/titan-fight\.json$` | `@wildshard/format/arenaScriptRows#ArenaScriptFightFileSchema` |
| `^combat\/titan-geometry\.json$` | `@wildshard/format/arenaScriptRows#ArenaScriptGeometrySchema` |
| `^models\/cloud-specimen\.json$` | `@wildshard/format/encounterRows#CloudSpecimenSchema` |
| `^riding\/mounted-figure\.json$` | `@wildshard/format/mountedSpecimenRows#MountedSpecimenSeatSchema` |
| `^riding\/session\.json$` | `@wildshard/format/riding#ClientRidingSessionSchema` |
| `^geometry\/fixed-kits\.json$` | `@wildshard/format/practiceCourseRows#FixedPracticeFileSchema` |
| `^models\/fixed-geometry\.json$` | `@wildshard/format/islandLibrary#FixedGeometryGroupsSchema` |
| `^models\/cover-phone\.json$` | `@wildshard/format/specimenCatalogue#SpecimenBookSchema` |
| `^models\/cover-desktop\.json$` | `@wildshard/format/specimenCatalogue#SpecimenBookSchema` |
| `^models\/gear-book\.json$` | `@wildshard/format/specimenCatalogue#SpecimenBookSchema` |
| `^models\/held-cards\.json$` | `@wildshard/format/heldArms#HeldGraphCardsSchema` |
| `^look\/cover-appearance\.json$` | `@wildshard/format/coverAppearance#CoverAppearanceSchema` |
| `^world\/island\/plan-(?:phone\|desktop)\.json$` | `@wildshard/format/bakedTiles#BakedPlacementPlanSchema` |
| `^people\/cards\.json$` | `@wildshard/format/questFigures#KitFigureCardsSchema` |
| `^world\/building-life\.json$` | `@wildshard/format/buildings#BuildingLifeDocumentSchema` |
| `^world\/cover-composition\.json$` | `@wildshard/format/streamedCover#CoverCompositionSchema` |
| `^models\/shape-book\.json$` | `@wildshard/format/fixedDraws#FixedDrawRowsSchema` |
| `^quests\/chapters\.json$` | `@wildshard/format/questStory#ChapterStoryPresentationSchema` |
| `^world\/weather\.json$` | `@wildshard/format/weatherBundle#WeatherDocumentSchema` |
| `^audio\/scene\.json$` | `@wildshard/format/audioScene#AudioSceneSchema` |
| `^look\/post\.json$` | `@wildshard/format/postGraphLook#PostGraphLookSchema` |
| `^world\/scene-pages\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\.json$` | `@wildshard/format/worldScenePages#WorldScenePageSchema` |
| `^world\/sources\/bakes\.json$` | `@wildshard/format/sceneSources#SceneBakeSourceSchema` |
| `^world\/sources\/(?:models\|heroes\|sky)\.json$` | `@wildshard/format/sceneSources#SceneModelSourceSchema` |
| `^world\/(?:casts\|fabric)\.json$` | `@wildshard/format/worldSceneWeld#WorldSceneWeldSchema` |
| `^world\/placement-pages\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\.json$` | `@wildshard/format/worldScenePlacement#WorldScenePlacementPageSchema` |
| `^(?:scenes\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\|world\/scenes\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\|world\/portals\/scene)\.json$` | `@wildshard/format/clientChannels#WorldSceneSchema` |
| `^world\/(?:fields\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\|cards\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,179}\|portals\/sparks)\.json$` | `@wildshard/format/sceneBuffers#SceneBuffersSchema` |
| `^models\/world-scenes\.json$` | `@wildshard/format/worldSceneModels#WorldSceneModelsSchema` |
| `^quests\/achievements\.json$` | `@wildshard/format/achievementCounters#AchievementCounterDataSchema` |
| `^people\/catalogue\.json$` | `@wildshard/format/figures#FigureCatalogueSchema` |
| `^quests\/page-composition\.json$` | `@wildshard/format/questPageComposition#QuestPageCompositionSchema` |
| `^quests\/stall\.json$` | `@wildshard/format/namedJsonContracts#QuestTraderSchema` |
| `^(?:look\/creature-looks\|actors\/species-looks)\.json$` | `@wildshard/format/speciesLooks#PackedCreatureLooksSchema` |
| `^look\/[A-Za-z0-9_-][A-Za-z0-9_.-]{0,173}-draw\.json$` | `@wildshard/format/namedJsonContracts#PosedLibrarySchema` |
| `^quests\/story\.json$` | `@wildshard/format/questStory#QuestStorySchema` |
| `^actors\/page-life\.json$` | `@wildshard/format/pageLife#PageLifeSchema` |
| `^quests\/chapter-director\.json$` | `@wildshard/format/chapterDirector#ChapterDirectorSchema` |
| `^quests\/(?:trader\|mill-door\|lanterns)\.json$` | `@wildshard/format/questInteractions#QuestPageInteractionsSchema` |
| `^quests\/services\.json$` | `@wildshard/format/questSteps#QuestServiceActionsSchema` |
| `^directors\/main\.json$` | `@wildshard/format/directorProduct#DirectorProductSchema` |
| `^quests\/panels\.json$` | `@wildshard/format/panelTemplate#QuestPanelCatalogueSchema` |
| `^world\/forest-weather\.json$` | `@wildshard/format/forestWeather#ForestWeatherSchema` |
| `^quests\/persistence\.json$` | `@wildshard/format/namedJsonContracts#AdventurePersistenceSchema` |
| `^world\/weather-fx\.json$` | `@wildshard/format/weatherEffects#WeatherEffectsSchema` |
| `^world\/rain\.json$` | `@wildshard/format/rainPresentation#RainPresentationSchema` |
| `^world\/weather-observations\.json$` | `@wildshard/format/rangedPage#ForestWeatherObservationSchema` |
| `^world\/dressing-pages\/0\.json$` | `@wildshard/format/sceneDressing#SceneScatterPageSchema` |
| `^world\/dressing-pages\/1\.json$` | `@wildshard/format/sceneDressing#SceneScatterPageSchema` |
| `^world\/dressing-phone\.json$` | `@wildshard/format/sceneDressing#SceneDressingSchema` |
| `^world\/dressing-desktop\.json$` | `@wildshard/format/sceneDressing#SceneDressingSchema` |
| `^world\/floor\.json$` | `@wildshard/format/forestPage#ForestGroundLayoutSchema` |
| `^world\/crag-cave\.json$` | `@wildshard/format/caveInterior#CaveFileSchema` |
| `^world\/cave-interior\.json$` | `@wildshard/format/caveInterior#CaveInteriorSchema` |
| `^world\/forest-page\.json$` | `@wildshard/format/forestPage#ForestPageSchema` |
| `^world\/building-sites\.json$` | `@wildshard/format/forestPage#LivingPageSitesSchema` |
| `^data\/physics\.generated\.json$` | `@wildshard/format/forestNativeInputs#ForestNativeInputsSchema` |
| `^world\/meadow\.json$` | `@wildshard/format/populationEnvironment#PopulationFieldSchema` |
| `^world\/water\.json$` | `@wildshard/format/waterWorld#WaterWorldSchema` |
| `^weapons\/bow-page\.json$` | `@wildshard/format/weaponProfiles#HeldBowFileSchema` |
| `^weapons\/rifle-page\.json$` | `@wildshard/format/weaponProfiles#HeldFirearmPageSchema` |
| `^weapons\/sabre\.json$` | `@wildshard/format/heldWeaponDocuments#BladeDocumentSchema` |
| `^weapons\/spear\.json$` | `@wildshard/format/heldWeaponDocuments#PolearmDocumentSchema` |
| `^held\/slots\.json$` | `@wildshard/format/heldWeaponDocuments#HeldSlotsDocumentSchema` |
| `^weapons\/jian-row\.json$` | `@wildshard/format/heldJianDocument#HeldJianDocumentSchema` |
<!-- /generated:families -->

## 5. Scripts

A shard's only code is Wasm, compiled from AssemblyScript by the SDK and admitted by reading its bytes, never by
running them ([SCRIPT-ABI.md](SCRIPT-ABI.md)). Scripts are declared in:

| Where | What runs it | Side |
|---|---|---|
| `sim/scripts` (ABI v1, `side: "sim"`) | engine's decision host | both: the server owns the gameplay |
| `sim/scripts` (ABI v1, `side: "view"`) | refused: only the server's decision host reads `sim/scripts` | — |
| `actors/return-scripts` | engine's return program (shared code) | both |
| `actors/spawn-scripts` | engine's spawn script host | server |
| `view/modules` | the page's view program (the `view.program` kind); a pose view also runs on the server | view, `view.program` is both |
| ABI v2 lanes `sim` / `project` / `view` | the server's batch / both / the page | server / both / view |

A `view` row may command only `timer`, `cue` and `channel`. A `sim` row that only a page-only feature runs is refused
(Pine's live shard is the one grandfathered exception). Admission refuses `memory.grow`, tables, start sections, passive
data, indirect calls and bulk operations. Engine enforces these call limits at run time (engine's decision host; the
numbers and sources are in SCRIPT-ABI.md's limits table): fuel 400,000 per call and 2,000,000 per decision tick; at most
64 binding calls per decision tick; at most 16 events delivered and 32 commands per call, 128 commands per tick; at most
4 spawns and 8 timers per call; the third refusal disables a binding.

## 6. Budgets

A shard declares its own ceilings in `shard.json` `admission`, and validation holds its measured costs to them:

- `budgets`: `library` (`resident`, `compressed`, optional `downloadAllowance`), `sim` (`resident`, `compressed`),
  `overlap`, and optional `client`. SHARDFILE.md gives the platform caps (library resident ≤25 MB, wire ≤8 MB; sim
  resident ≤25 MB, critical wire ≤2 MB).
- `serverBudget`: `tickMicros` ≤16,666, `memory` ≤25 MB, `entities` ≤10,000, `commandsPerTick` ≤1,024.
- `authorCaps`: `players` 1 to 32, in-cell `speed` 0 to 15 m/s.

The page's memory caps (`src/format/memoryGates.json`) are in report-only mode until SHARD-PLATFORM closes: memory
checks print their numbers and do not refuse.

## 7. Limits held as constants

<!-- generated:limits -->
| Limit | Value | Means | Constant |
| --- | --- | --- | --- |
| `sourceBytes` | 2000000 | bytes of canonical `shard.json` source; also all sections together | `SHARDFILE_ADMISSION_LIMITS` |
| `files` | 4096 | file rows | `SHARDFILE_ADMISSION_LIMITS` |
| `commons` | 1024 | commons references | `SHARDFILE_ADMISSION_LIMITS` |
| `stateFields` | 128 | state fields per scope | `SHARDFILE_ADMISSION_LIMITS` |
| `waterBodies` | 64 | water bodies | `SHARDFILE_ADMISSION_LIMITS` |
| `idCharacters` | 128 | characters in an id or name | `SHARDFILE_ADMISSION_LIMITS` |
| `textCharacters` | 4096 | characters of free text | `SHARDFILE_ADMISSION_LIMITS` |
| `wireBytes` | 256000000 | distinct declared download bytes, commons included | `SHARDFILE_ADMISSION_LIMITS` |
| `major` | 1 | script ABI v1 major version | `SCRIPT_V1_LAYOUT` |
| `slotBytes` | 8 | bytes per slot (one f64) | `SCRIPT_V1_LAYOUT` |
| `header` | 8 | header slots | `SCRIPT_V1_LAYOUT` |
| `state` | 16 | declared state slots per script | `SCRIPT_V1_LAYOUT` |
| `params` | 32 | declared parameters per script | `SCRIPT_V1_LAYOUT` |
| `events` | 16 | events delivered per call | `SCRIPT_V1_LAYOUT` |
| `eventWidth` | 6 | slots per event | `SCRIPT_V1_LAYOUT` |
| `commands` | 32 | commands per call | `SCRIPT_V1_LAYOUT` |
| `commandWidth` | 5 | slots per command | `SCRIPT_V1_LAYOUT` |
| `fixedHz` | 60 | fixed simulation steps per second | `SCRIPT_V1_LAYOUT` |
| `decisionDivisor` | 6 | steps per decision tick (60 / 6 = 10 Hz) | `SCRIPT_V1_LAYOUT` |
| `maximumPages` | 4 | 64 KiB memory pages per v1 module | `SCRIPT_V1_LAYOUT` |
| `version` | 0 | core script ABI version (v0) | `SCRIPT_ABI` |
| `assemblyscript` | 0.28.20 | pinned AssemblyScript compiler | `SCRIPT_ABI` |
| `binaryen` | 132.0.0 | pinned Binaryen | `SCRIPT_ABI` |
| `maxBytes` | 262144 | bytes per Wasm module | `SCRIPT_ABI` |
| `memoryPages` | 64 | 64 KiB memory pages per v0 module | `SCRIPT_ABI` |
| `maxFunctions` | 512 | functions and types per module | `SCRIPT_ABI` |
| `maxGlobals` | 128 | globals per module | `SCRIPT_ABI` |
| `maxLocals` | 1024 | locals per function | `SCRIPT_ABI` |
| `callDepth` | 64 | call depth | `SCRIPT_ABI` |
<!-- /generated:limits -->

## 8. What is refused

- A section name not in section 1, or a schema id other than `wildshard:<name>@1`; a section path other than
  `sections/<name>.json`; a duplicate section.
- A `client/plan` kind not in section 2, a kind or `world.assembly` stage with no side, or a feature field its schema
  doesn't list (every feature schema is strict).
- A native-assembly host not in section 3; a server file that is also a client file.
- A named JSON file outside section 4; any `custom/` name.
- Runtime TypeScript: `runtime.files` must be empty and `runtime.lines` 0, so no shard ships code engine imports.
- Anything that isn't plain bounded JSON: no module URLs, callbacks, fallbacks or simulation owners, in any section or
  plan.
- A Wasm module outside the admitted instruction set, or a script on the wrong side (section 5).
- A shard file over a limit in section 7 or a budget in section 6 (memory checks report only, for now).
- `sdk: "0.3"` without `cook.json` (author preparation: run `wildshard prepare`).
