// The one JSON Schema projection of the format's valibot schemas (FORMAT-PRUNE FP9). Engine and the SDK import it from
// here; it moved byte for byte from the SDK's sharddev/formatJsonSchema.ts (once engine's host/formatJsonSchema), so its
// lint debt is waived below rather than counted, and it pays down as the file is touched.
/* oxlint-disable complexity, curly, max-lines, max-lines-per-function, max-statements, no-continue, no-magic-numbers, no-nested-ternary, no-use-before-define, prefer-destructuring, sort-vars, import/consistent-type-specifier-style, import/exports-last, import/group-exports, import/max-dependencies, typescript/explicit-function-return-type, typescript/no-unsafe-type-assertion, typescript/prefer-readonly-parameter-types, unicorn/consistent-function-scoping, unicorn/no-array-callback-reference, unicorn/no-immediate-mutation, unicorn/no-nested-ternary, unicorn/no-useless-undefined, unicorn/numeric-separators-style -- moved from the SDK as it was (FORMAT-PRUNE FP9); FP9 pays this down as rows touch it */
// oxlint-disable unicorn/prefer-string-raw -- Its patterns are schema bytes, kept as sharddev wrote them.

import { toJsonSchema, type JsonSchema } from '@valibot/to-json-schema'
import { finite, type GenericSchema } from 'valibot'

import { AccentSchema, ACCENT_IDS } from './accent.ts'
import { AchievementCounterDataSchema } from './achievementCounters.ts'
import { ActorMovesSchema } from './actorMoves.ts'
import { SHARDFILE_ADMISSION_LIMITS } from './admissionLimits.ts'
import { ForestLifeSchema } from './ambientLife.ts'
import {
  ArenaRoomDocumentSchema,
  ArenaRoomDocumentRowsSchema,
  ArenaKingRowsSchema,
} from './arenaRoomDocument.ts'
import {
  ArenaScriptFightFileSchema,
  ArenaScriptGeometrySchema,
} from './arenaScriptRows.ts'
import { AudioDataSchema } from './audio.ts'
import {
  AudioMusicSchema,
  AudioSamplesSchema,
  AudioZonesSchema,
} from './audioProfiles.ts'
import { AudioRoutingSchema } from './audioRouting.ts'
import { AudioSceneSchema } from './audioScene.ts'
import { BakedPlacementPlanSchema } from './bakedTiles.ts'
import { BinarySourceSchema } from './binarySource.ts'
import { BodySlotsSchema } from './bodySlots.ts'
import {
  RoamingEncounterSchema,
  WakeEncounterSchema,
  BossEncounterPresentationSchema,
  NativeBossBindingSchema,
} from './bossEncounter.ts'
import {
  BossProfileSchema,
  ArenaBossProfileSchema,
  RoamingBossProfileSchema,
  SpawnedBossProfileSchema,
  HeldBossProfileSchema,
  ScriptBossProfileSchema,
} from './bossProfiles.ts'
import { BowVariantSchema } from './bowVariantRows.ts'
import {
  StalkerSchema,
  GuardianPatternsSchema,
  SkirmisherSchema,
  ScriptBrainSchema,
  GuardianSchema,
  PerchHunterSchema,
} from './brains.ts'
import {
  BuildingLifeDocumentSchema,
  BakedBuildingLookSchema,
  BuildingLifeLookSchema,
  BuildingLifeRowsSchema,
  BuildingCloudPoseSchema,
} from './buildings.ts'
import { CatalogueEconomySchema } from './catalogueEconomy.ts'
import { CaveFileSchema, CaveInteriorSchema } from './caveInterior.ts'
import { ChapterDirectorSchema, ChapterWakeSchema } from './chapterDirector.ts'
import {
  HeldMeleeActionSchema,
  ClientChannelsSchema,
  ClientChannelProgramSchema,
  PrivateSceneSchema,
  WorldSceneSchema,
  NumericPoseSchema,
} from './clientChannels.ts'
import { RuntimeBoundsSchema } from './clientPlan.ts'
import { ClientScriptsSchema } from './clientScripts.ts'
import {
  ClientCheckpointSchema,
  ItemCheckpointStatesSchema,
  LogicalClientCheckpointSchema,
} from './clientState.ts'
import { CommonsCostsSchema } from './commonsCosts.ts'
import { ContractCatalogueSchema } from './contracts.ts'
import { CoverAppearanceSchema } from './coverAppearance.ts'
import {
  CreaturesSchema,
  CreatureHomeSchema,
  CreatureStrikeSchema,
} from './creatures.ts'
import { FlockSchema } from './crowds.ts'
import { CueDirectorWireSchema } from './cueDirector.ts'
import { DecisionScriptsSchema } from './decisionScripts.ts'
import { DirectorSchema } from './director.ts'
import { DirectorDocumentSchema } from './directorDocument.ts'
import { DirectorStagesSchema } from './directorStages.ts'
import { EdgeProfileSchema, EdgeProfilesSchema } from './edgeProfiles.ts'
import { EliteFeatureSchema } from './eliteFeature.ts'
import { EliteScriptSchema } from './eliteScripts.ts'
import {
  TimedEncountersSchema,
  CloudSpecimenSchema,
  CloudBodySchema,
} from './encounterRows.ts'
import { EncountersSchema } from './encounters.ts'
import { EntrywaysSchema } from './entryways.ts'
import { ExchangeSchema } from './exchange.ts'
import { FigureCatalogueSchema, FigureGroupSchema } from './figures.ts'
import { FindsCatalogueSchema } from './findsCatalogue.ts'
import { FixedDrawRowsSchema } from './fixedDraws.ts'
import {
  DiverSchema,
  OrbitDiverSchema,
  PatrolDiverSchema,
  BurstFlyerSchema,
} from './flyers.ts'
import { ForestNativeInputsSchema } from './forestNativeInputs.ts'
import {
  ForestGroundLayoutSchema,
  ForestPageSchema,
  LivingPageSitesSchema,
} from './forestPage.ts'
import { ForestWeatherSchema } from './forestWeather.ts'
import { GraphArmsSchema } from './graphArmsRows.ts'
import {
  RamGrazerSchema,
  ChallengeGrazerSchema,
  GrazerSchema,
} from './grazers.ts'
import { GroupBrainSchema } from './groupBrains.ts'
import {
  ToonArmsLookSchema,
  HeldArmsSchema,
  HeldGraphCardsSchema,
} from './heldArms.ts'
import { HeldFinishesSchema } from './heldFinishes.ts'
import { HeldJianDocumentSchema } from './heldJianDocument.ts'
import { HeldCueSchema, ArcWeaponItemSchema } from './heldMelee.ts'
import {
  BladeDocumentSchema,
  PolearmDocumentSchema,
  HeldSlotsDocumentSchema,
} from './heldWeaponDocuments.ts'
import { PopulationShelterSchema } from './herdShelter.ts'
import { HooksSchema } from './hooks.ts'
import { InputActionSchema, InputKeysSchema } from './inputDeclarations.ts'
import { FixedGeometryGroupsSchema } from './islandLibrary.ts'
import { ItemsSchema, ItemFamilyNameSchema } from './items.ts'
import { LedgerFactSchema, LedgerRulesSchema } from './ledger.ts'
import { LiftRiderSchema } from './liftRider.ts'
import { LimbCollisionBake } from './limbCollision.ts'
import { LimbRigSchema, LimbBlendSchema, BakedClipTable } from './limbRig.ts'
import { LootBagSchema } from './lootBag.ts'
import { MeshCollisionSchema } from './meshCollision.ts'
import { LogicalStateSchema, MigrationsSchema } from './migrations.ts'
import { PerchBodyFileSchema } from './mixedPopulation.ts'
import {
  ModesSchema,
  ZiplineModeSchema,
  UpdraftModeSchema,
  RideGaitsSchema,
  RideModeSchema,
  GrappleModeSchema,
  TraverseModeSchema,
} from './modes.ts'
import { MountedSpecimenSeatSchema } from './mountedSpecimenRows.ts'
import {
  MoverMotionSchema,
  MoverTrackSchema,
  MoverTriggerSchema,
  MoverDriverSchema,
} from './moverMotion.ts'
import { MoversSchema } from './movers.ts'
import {
  AdventurePersistenceSchema,
  ReturnProgramSchema,
  PageReturnRowsSchema,
  QuestTraderSchema,
  PosedLibrarySchema,
} from './namedJsonContracts.ts'
import { NativeGroundSchema } from './nativeGround.ts'
import { NativeGroundFileSchema } from './nativePhysics.ts'
import {
  NativeQuestCompositionSchema,
  NativeQuestServiceSpotsSchema,
} from './nativeQuestComposition.ts'
import { NavigationSchema } from './navigation.ts'
import {
  NpcRowSchema,
  NpcMotionSchema,
  NpcDialogueRowSchema,
  QuestNpcBindingSchema,
  QuestNpcBindingsSchema,
} from './npcs.ts'
import { PageLifeSchema } from './pageLife.ts'
import {
  PaintedAirSchema,
  PaintedGroundSchema,
  PaintedPanoramaSchema,
  PainterKeyLightSchema,
  PainterlyWorldSchema,
} from './paintedResources.ts'
import {
  PanelDefinitionSchema,
  QuestPanelCatalogueSchema,
} from './panelTemplate.ts'
import { PlumbingSchema } from './plumbing.ts'
import {
  PopulationFieldSchema,
  PopulationHabitatSchema,
} from './populationEnvironment.ts'
import { PopulationKeeperRowsSchema } from './populationKeeper.ts'
import {
  PopulationProjectionSchema,
  EnemyPlacementsSchema,
} from './populationProjection.ts'
import {
  NativePopulationRowsSchema,
  TamingPoseFileSchema,
} from './populationRoster.ts'
import { PortalLinkSchema } from './portalLink.ts'
import {
  PostGraphLookSchema,
  ScaledPostInputSchema,
  postGraphIdentityTransforms,
} from './postGraphLook.ts'
import {
  PracticeSceneSchema,
  RidingPracticeSchema,
  PracticeControllerSchema,
  FixedPracticeFileSchema,
} from './practiceCourseRows.ts'
import { PresentationSchema } from './presentation.ts'
import { QuestContinuationSchema } from './questContinuation.ts'
import { QuestFiguresSchema, KitFigureCardsSchema } from './questFigures.ts'
import { QuestGraphSchema } from './questGraph.ts'
import { QuestHostSchema } from './questHost.ts'
import {
  InteractionRowsSchema,
  QuestPageInteractionsSchema,
} from './questInteractions.ts'
import { QuestInteractionSourceSchema } from './questInteractionSource.ts'
import {
  QuestPageSchema,
  QuestPageCompositionSchema,
  ChapterViewSchema,
} from './questPageComposition.ts'
import { QuestRuntimeDocumentSchema } from './questRuntime.ts'
import { QuestDataSchema } from './quests.ts'
import {
  QuestStepRowsSchema,
  QuestServiceActionsSchema,
  QuestKillRowsSchema,
  QuestHintRowsSchema,
  CarriedQuestSchema,
} from './questSteps.ts'
import {
  QuestStorySchema,
  ChapterStoryPresentationSchema,
  AdventureContentSchema,
} from './questStory.ts'
import { QuestStoryBindingsSchema } from './questStoryBindings.ts'
import { QuestWorldSchema } from './questWorld.ts'
import { RainPresentationSchema } from './rainPresentation.ts'
import {
  ForestWeatherObservationSchema,
  RangedPageSchema,
} from './rangedPage.ts'
import {
  registeredJsonContract,
  type RegisteredSchemaJsonName,
} from './registeredJson.ts'
import {
  ReturnProgramDocumentSchema,
  ReturnProgramWireDocumentSchema,
} from './returnProgramDocument.ts'
import { ReturnProjectionV2Schema } from './returnProjectionV2.ts'
import { ClientRidingSessionSchema } from './riding.ts'
import { RoamingCombatSchema } from './roamingCombat.ts'
import { RowsSchema } from './rows.ts'
import { RuntimeSchema, ClientPlanRuntimeSchema } from './runtime.ts'
import { RuntimeBindsSchema } from './runtimeBinds.ts'
import {
  MemoryMeasurementSchema,
  RuntimeCostSchema,
  RegionalSimCostSchema,
} from './runtimeCost.ts'
import { RuntimeSpawnsSchema } from './runtimeSpawns.ts'
import {
  ScalarChannelSchema,
  ScalarLatticeSchema,
  ScalarTripletSchema,
} from './scalarChannel.ts'
import { SceneBuffersSchema } from './sceneBuffers.ts'
import {
  SceneScatterPageSchema,
  SceneDressingSchema,
  SceneBakedGeometrySchema,
} from './sceneDressing.ts'
import {
  SceneModelSourceSchema,
  SceneBakeSourceSchema,
} from './sceneSources.ts'
import { ReturnModulesSchema } from './scriptContract.ts'
import { ScriptBindingsSchema } from './scripts.ts'
import {
  ShardNaturalSchema,
  ShardFiniteSchema,
  ShardHashSchema,
  ShardReferenceSchema,
  ShardReferencesSchema,
  ShardNamesSchema,
  CellBoundsSchema,
  IdentitySchema,
  RequiresSchema,
  BudgetsSchema,
  SimSchema,
  AuthorCapsSchema,
  ServerBudgetSchema,
  FilesSchema,
  TilesSchema,
  LibrarySchema,
  CriticalSchema,
  FarSchema,
  SpawnSchema,
} from './shardSections.ts'
import {
  CreatureSkinClipNameSchema,
  SkinClipNameSchema,
  SkinRowSchema,
  SkinBindingSchema,
} from './skinData.ts'
import { SkinPoseLayerSchema } from './skinLayers.ts'
import {
  SkinLookParametersSchema,
  SkinClipParametersSchema,
  ShardSkinFileSchema,
} from './skins.ts'
import { SocketLiftSchema } from './socketLift.ts'
import { SpeciesActorsFileSchema as SpeciesActorsDocumentSchema } from './speciesActorsFile.ts'
import { SpeciesActorsFileSchema } from './speciesBookRows.ts'
import {
  CreatureInstallSchema,
  PackedCreatureLooksSchema,
} from './speciesLooks.ts'
import { SpeciesSchema, NativeHuntSchema } from './speciesPrograms.ts'
import { ScriptSpeciesSchema } from './speciesScripts.ts'
import { SpecimenBookSchema } from './specimenCatalogue.ts'
import { StateSchema } from './state.ts'
import { StreamedCoverSchema, CoverCompositionSchema } from './streamedCover.ts'
import { StrikeDebrisJsonGuard } from './strike-debris.ts'
import { TargetsSchema } from './targets.ts'
import { TerrainSchema, ForestRowsSchema, GroundRowsSchema } from './terrain.ts'
import { TraversalSchema } from './traversal.ts'
import { UiSchema } from './ui.ts'
import { uniformIdentityTransforms } from './uniformRows.ts'
import { WaterSchema } from './water.ts'
import { WaterWorldSchema } from './waterWorld.ts'
import {
  WeaponProfileSchema,
  MeleeWeaponProfileSchema,
  BowWeaponProfileSchema,
  FirearmWeaponProfileSchema,
  ThrownWeaponProfileSchema,
  LashWeaponProfileSchema,
  ConeWeaponProfileSchema,
  HeldBowBaseSchema,
  HeldBowRowsSchema,
  HeldBowDefinitionSchema,
  HeldBowFileSchema,
  HeldFirearmPageSchema,
} from './weaponProfiles.ts'
import { WeatherBundleSchema, WeatherDocumentSchema } from './weatherBundle.ts'
import {
  WeatherEffectsSchema,
  WeatherGeometrySchema,
  WeatherGeometryDataSchema,
} from './weatherEffects.ts'
import { WeatherProgramSchema, WeatherHitTagSchema } from './weatherProgram.ts'
import { WildlifePopulationSchema } from './wildlifePopulation.ts'
import { WorldAssemblySchema } from './worldAssembly.ts'
import { WorldSceneModelsSchema } from './worldSceneModels.ts'
import { WorldScenePageSchema } from './worldScenePages.ts'
import {
  WorldScenePlacementSchema,
  WorldScenePlacementPageSchema,
} from './worldScenePlacement.ts'
import {
  WorldSceneWeldSchema,
  WorldSceneWeldNodeSchema,
} from './worldSceneWeld.ts'
import { WorldUpdatesSchema } from './worldUpdates.ts'

/** JSON Schema plus explicit admission checks that JSON Schema cannot express. */
export interface FormatJsonSchema extends JsonSchema {
  'x-wildshard-checks'?: string[]
  'x-wildshard-string-length'?: 'utf16-code-units'
}

const plumbing = PlumbingSchema.pipe[2]
const input = plumbing.entries.input.pipe[0].item
const debug = plumbing.entries.debug.pipe[0].item
// These identities are the defining schemas, not message-based permissions for arbitrary author code.
const customSchemas = new Map<object, FormatJsonSchema>([
  [
    WeatherHitTagSchema,
    { type: 'string', pattern: '^[a-z][a-zA-Z0-9.-]*\\.[a-zA-Z0-9.*-]+$' },
  ],
  [
    InputActionSchema.options[1],
    {
      type: 'string',
      maxLength: 128,
      pattern: '^[a-z][a-zA-Z0-9-]*(?:\\.[a-zA-Z0-9-]+)+$',
    },
  ],
  [
    input.entries.id,
    {
      type: 'string',
      maxLength: 128,
      pattern: '^[a-z][a-z0-9-]*(?:\\.[a-z][a-zA-Z0-9-]*)+$',
    },
  ],
  [debug.entries.ask, { type: 'string', pattern: '^E[1-9][0-9]*$' }],
])
// JSON text has already excluded accessors/functions; bridge only this exact defining preflight.
customSchemas.set(StrikeDebrisJsonGuard, {})
// The defining native hunt tag guard retains its bounded dotted namespace.
customSchemas.set(
  schemaAt(
    NativeHuntSchema,
    '/entries/hit/entries/tags/pipe/0/item',
  ) as GenericSchema,
  {
    type: 'string',
    maxLength: 128,
    pattern: '^[a-z][a-zA-Z0-9.-]*\\.[a-zA-Z0-9.-]+$',
  },
)
// Faithful projection of the native four-field header predicate. Registered
// post documents additionally run complete scaled-post and graph admission.
customSchemas.set(ScaledPostInputSchema, {
  type: 'object',
  required: ['programs', 'draws', 'targets', 'outputs'],
  'x-wildshard-checks': [
    '@wildshard/format/scaledPostContract#parseScaledPostRow',
  ],
} satisfies FormatJsonSchema)
customSchemas.set(HeldCueSchema, {
  type: 'string',
  pattern: '^cue\\.[a-z][a-zA-Z0-9.-]*$',
})
customSchemas.set(ArcWeaponItemSchema, {
  type: 'string',
  pattern: '^weapon\\.[a-z][a-zA-Z0-9.-]*$',
})
const postIdentityTransforms = new Set([
  ...postGraphIdentityTransforms,
  ...uniformIdentityTransforms,
])
const namedClipTransform = schemaAt(
  CreatureSkinClipNameSchema,
  '/options/1/pipe/3',
)
// FP26 (format 0.1.0.4): the identity transform folds the old `revision` spelling into `saveRevision`.
const identitySaveRevision = schemaAt(IdentitySchema, '/pipe/2')
const skinPoseLayersRecord = schemaAt(
  SkinBindingSchema,
  '/entries/poseLayers/wrapped',
)
const skinPoseLayerValues = schemaAt(
  SkinBindingSchema,
  '/entries/poseLayers/wrapped/value',
) as GenericSchema
customSchemas.set(HeldMeleeActionSchema, {
  type: 'string',
  pattern: '^[a-z][a-zA-Z0-9-]*\\.[a-zA-Z0-9.-]+$',
})
const bowVariant = BowVariantSchema.pipe[2].entries
customSchemas.set(bowVariant.id, {
  type: 'string',
  pattern: '^weapon\\.[a-z0-9.-]+$',
})
customSchemas.set(bowVariant.sourceTag, {
  type: 'string',
  pattern: '^[^.]+\\..+$',
})
customSchemas.set(CreatureStrikeSchema.entries.tags.pipe[0].item, {
  type: 'string',
  maxLength: 128,
  pattern: '^[a-z][a-zA-Z0-9.-]*\\.[a-zA-Z0-9.*-]+$',
})
// Exact fixed-palette validator; a caller's new custom schema receives no bridge.
customSchemas.set(AccentSchema.pipe[2], {
  type: 'string',
  enum: [...ACCENT_IDS],
})
// Template-literal item identities keep their exact native predicates; only these defining schema objects bridge.
const itemRows = ItemsSchema.pipe[2].entries.rows.pipe[0].item
const weaponRow = itemRows.options[0],
  toolRow = itemRows.options[1]
customSchemas.set(weaponRow.entries.id, {
  type: 'string',
  maxLength: 128,
  pattern: '^weapon\\.[a-z][a-zA-Z0-9.-]*$',
})
customSchemas.set(toolRow.entries.id, {
  type: 'string',
  maxLength: 128,
  pattern: '^tool\\.[a-z][a-zA-Z0-9.-]*$',
})
customSchemas.set(weaponRow.entries.slot, {
  type: 'string',
  maxLength: 128,
  pattern: '^declared\\.weapon\\.[a-z][a-zA-Z0-9.-]*$',
})
customSchemas.set(weaponRow.entries.light.entries.tags.pipe[0].item, {
  type: 'string',
  maxLength: 128,
  pattern: '^[a-z][a-zA-Z0-9.-]*\\.[a-zA-Z0-9.-]+$',
})
customSchemas.set(
  ConeWeaponProfileSchema.entries.gust.entries.tags.pipe[0].item,
  {
    type: 'string',
    maxLength: 128,
    pattern: '^[a-z][a-zA-Z0-9.-]*\\.[a-zA-Z0-9.-]+$',
  },
)
customSchemas.set(weaponRow.entries.light.entries.effect.wrapped, {
  type: 'string',
  pattern: '^effect\\.[a-z][a-zA-Z0-9.-]*$',
})
customSchemas.set(toolRow.entries.action.wrapped, {
  type: 'string',
  pattern: '^[a-z][a-zA-Z0-9.-]*\\.[a-zA-Z0-9.-]+$',
})
// The namespaced combat tag validator is the exact defining row object.
customSchemas.set(
  RowsSchema.pipe[2].entries.strikes.pipe[0].item.entries.tags.pipe[0].item,
  {
    type: 'string',
    maxLength: 128,
    pattern: '^[a-z][a-zA-Z0-9.-]*\\.[a-zA-Z0-9.-]+$',
  },
)
const unicodeRegexes = new Set<object>([
  plumbing.entries.namespace.pipe[1],
  InputKeysSchema.pipe[0].item.pipe[1],
  debug.entries.reviewBy.pipe[1],
])
const stateField = StateSchema.pipe[0].entries.shared.pipe[0].item
unicodeRegexes.add(stateField.entries.name.pipe[1])
unicodeRegexes.add(CommonsCostsSchema.pipe[0].key.pipe[1])
const edge = EdgeProfileSchema.pipe[0]
const finiteNumbers = new Set<object>([
  edge.entries.heights.item.pipe[1],
  stateField.entries.default.options[1].pipe[1],
  ...edge.entries.colours.item.items.map(channel => channel.pipe[1]),
])

// Only the exact retained defining roots grant action bridges. A caller's new check or transform never joins.
const wireRoots: Readonly<Record<string, GenericSchema>> = {
  'audioScene.AudioScene': AudioSceneSchema,
  'forestPage.LivingPageSites': LivingPageSitesSchema,
  'fixedDraws.FixedDrawRows': FixedDrawRowsSchema,
  'forestPage.ForestPage': ForestPageSchema,
  'forestPage.ForestGroundLayout': ForestGroundLayoutSchema,
  'caveInterior.CaveFile': CaveFileSchema,
  'caveInterior.CaveInterior': CaveInteriorSchema,
  'streamedCover.CoverComposition': CoverCompositionSchema,
  'speciesLooks.CreatureInstall': CreatureInstallSchema,
  'speciesLooks.PackedCreatureLooks': PackedCreatureLooksSchema,
  'questPageComposition.QuestPageComposition': QuestPageCompositionSchema,
  'chapterDirector.ChapterWake': ChapterWakeSchema,
  'bowVariantRows.BowVariant': BowVariantSchema,
  'scalarChannel.ScalarChannel': ScalarChannelSchema,
  'terrain.ForestRows': ForestRowsSchema,
  'clientPlan.RuntimeBounds': RuntimeBoundsSchema,
  'worldUpdates.WorldUpdates': WorldUpdatesSchema,
  'streamedCover.StreamedCover': StreamedCoverSchema,
  'practiceCourseRows.PracticeScene': PracticeSceneSchema,
  'graphArmsRows.GraphArms': GraphArmsSchema,
  'practiceCourseRows.RidingPractice': RidingPracticeSchema,
  'mountedSpecimenRows.MountedSpecimenSeat': MountedSpecimenSeatSchema,
  'speciesBookRows.SpeciesActorsFile': SpeciesActorsFileSchema,
  'arenaScriptRows.ArenaScriptFightFile': ArenaScriptFightFileSchema,
  'arenaScriptRows.ArenaScriptGeometry': ArenaScriptGeometrySchema,
  'encounterRows.TimedEncounters': TimedEncountersSchema,
  'encounterRows.CloudSpecimen': CloudSpecimenSchema,
  'roamingCombat.RoamingCombat': RoamingCombatSchema,
  'populationProjection.PopulationProjection': PopulationProjectionSchema,
  'populationProjection.EnemyPlacements': EnemyPlacementsSchema,
  'sceneDressing.SceneDressing': SceneDressingSchema,
  'clientChannels.NumericPose': NumericPoseSchema,
  'populationKeeper.PopulationKeeperRows': PopulationKeeperRowsSchema,
  'questInteractions.QuestPageInteractions': QuestPageInteractionsSchema,
  'questPageComposition.QuestPage': QuestPageSchema,
  'questContinuation.QuestContinuation': QuestContinuationSchema,
  'questWorld.QuestWorld': QuestWorldSchema,
  'questFigures.QuestFigures': QuestFiguresSchema,
  'questFigures.KitFigureCards': KitFigureCardsSchema,
  'cueDirector.CueDirectorWire': CueDirectorWireSchema,
  'questSteps.QuestHintRows': QuestHintRowsSchema,
  'questSteps.QuestKillRows': QuestKillRowsSchema,
  'questSteps.QuestServiceActions': QuestServiceActionsSchema,
  'exchange.Exchange': ExchangeSchema,
  'catalogueEconomy.CatalogueEconomy': CatalogueEconomySchema,
  'lootBag.LootBag': LootBagSchema,
  'contracts.ContractCatalogue': ContractCatalogueSchema,
  'achievementCounters.AchievementCounterData': AchievementCounterDataSchema,
  'herdShelter.PopulationShelter': PopulationShelterSchema,
  'panelTemplate.PanelDefinition': PanelDefinitionSchema,
  'heldFinishes.HeldFinishes': HeldFinishesSchema,
  'figures.FigureCatalogue': FigureCatalogueSchema,
  'figures.FigureGroup': FigureGroupSchema,
  'questStory.QuestStory': QuestStorySchema,
  'weatherProgram.WeatherProgram': WeatherProgramSchema,
  'forestWeather.ForestWeather': ForestWeatherSchema,
  'populationRoster.NativePopulationRows': NativePopulationRowsSchema,
  'chapterDirector.ChapterDirector': ChapterDirectorSchema,
  'eliteFeature.EliteFeature': EliteFeatureSchema,
  'coverAppearance.CoverAppearance': CoverAppearanceSchema,
  'pageLife.PageLife': PageLifeSchema,
  'worldSceneWeld.WorldSceneWeld': WorldSceneWeldSchema,
  'worldSceneModels.WorldSceneModels': WorldSceneModelsSchema,
  'sceneBuffers.SceneBuffers': SceneBuffersSchema,
  'worldScenePlacement.WorldScenePlacement': WorldScenePlacementSchema,
  'clientChannels.WorldScene': WorldSceneSchema,
  'buildings.BuildingLifeRows': BuildingLifeRowsSchema,
  'buildings.BuildingCloudPose': BuildingCloudPoseSchema,
  'bodySlots.BodySlots': BodySlotsSchema,
  'limbRig.LimbRig': LimbRigSchema,
  'limbRig.LimbBlend': LimbBlendSchema,
  'limbRig.BakedClipTable': BakedClipTable,
  'limbCollision.LimbCollisionBake': LimbCollisionBake,
  'plumbing.Plumbing': PlumbingSchema,
  'heldArms.ToonArmsLook': ToonArmsLookSchema,
  'npcs.QuestNpcBinding': QuestNpcBindingSchema,
  'questHost.QuestHost': QuestHostSchema,
  'npcs.QuestNpcBindings': QuestNpcBindingsSchema,
  'npcs.NpcRow': NpcRowSchema,
  'npcs.NpcMotion': NpcMotionSchema,
  'npcs.NpcDialogueRow': NpcDialogueRowSchema,
  'bossProfiles.BossProfile': BossProfileSchema,
  'bossProfiles.ArenaBossProfile': ArenaBossProfileSchema,
  'bossProfiles.RoamingBossProfile': RoamingBossProfileSchema,
  'bossProfiles.SpawnedBossProfile': SpawnedBossProfileSchema,
  'bossProfiles.HeldBossProfile': HeldBossProfileSchema,
  'bossProfiles.ScriptBossProfile': ScriptBossProfileSchema,
  'bossEncounter.RoamingEncounter': RoamingEncounterSchema,
  'bossEncounter.WakeEncounter': WakeEncounterSchema,
  'bossEncounter.BossEncounterPresentation': BossEncounterPresentationSchema,
  'bossEncounter.NativeBossBinding': NativeBossBindingSchema,
  'weaponProfiles.WeaponProfile': WeaponProfileSchema,
  'weaponProfiles.MeleeWeaponProfile': MeleeWeaponProfileSchema,
  'weaponProfiles.BowWeaponProfile': BowWeaponProfileSchema,
  'weaponProfiles.FirearmWeaponProfile': FirearmWeaponProfileSchema,
  'weaponProfiles.ThrownWeaponProfile': ThrownWeaponProfileSchema,
  'weaponProfiles.LashWeaponProfile': LashWeaponProfileSchema,
  'weaponProfiles.ConeWeaponProfile': ConeWeaponProfileSchema,
  'weaponProfiles.HeldBowBase': HeldBowBaseSchema,
  'weaponProfiles.HeldBowRows': HeldBowRowsSchema,
  'weaponProfiles.HeldBowDefinition': HeldBowDefinitionSchema,
  'brains.Skirmisher': SkirmisherSchema,
  'brains.Stalker': StalkerSchema,
  'brains.ScriptBrain': ScriptBrainSchema,
  'brains.Guardian': GuardianSchema,
  'brains.GuardianPatterns': GuardianPatternsSchema,
  'brains.PerchHunter': PerchHunterSchema,
  'flyers.Diver': DiverSchema,
  'flyers.OrbitDiver': OrbitDiverSchema,
  'flyers.PatrolDiver': PatrolDiverSchema,
  'flyers.BurstFlyer': BurstFlyerSchema,
  'grazers.Grazer': GrazerSchema,
  'grazers.RamGrazer': RamGrazerSchema,
  'grazers.ChallengeGrazer': ChallengeGrazerSchema,
  'groupBrains.GroupBrain': GroupBrainSchema,
  'creatures.Creatures': CreaturesSchema,
  'creatures.CreatureHome': CreatureHomeSchema,
  'crowds.Flock': FlockSchema,
  'encounters.Encounters': EncountersSchema,
  'audioProfiles.AudioMusic': AudioMusicSchema,
  'audioProfiles.AudioSamples': AudioSamplesSchema,
  'audioProfiles.AudioZones': AudioZonesSchema,
  'audioRouting.AudioRouting': AudioRoutingSchema,
  'audio.AudioData': AudioDataSchema,
  'ledger.LedgerFact': LedgerFactSchema,
  'ledger.LedgerRules': LedgerRulesSchema,
  'director.Director': DirectorSchema,
  'directorDocument.DirectorDocument': DirectorDocumentSchema,
  'directorStages.DirectorStages': DirectorStagesSchema,
  'migrations.LogicalState': LogicalStateSchema,
  'migrations.Migrations': MigrationsSchema,
  'traversal.Traversal': TraversalSchema,
  'runtimeBinds.RuntimeBinds': RuntimeBindsSchema,
  'runtimeSpawns.RuntimeSpawns': RuntimeSpawnsSchema,
  'skinLayers.SkinPoseLayer': SkinPoseLayerSchema,
  'presentation.Presentation': PresentationSchema,
  'meshCollision.MeshCollision': MeshCollisionSchema,
  'scripts.ScriptBindings': ScriptBindingsSchema,
  'actorMoves.ActorMoves': ActorMovesSchema,
  'decisionScripts.DecisionScripts': DecisionScriptsSchema,
  'hooks.Hooks': HooksSchema,
  'terrain.Terrain': TerrainSchema,
  'water.Water': WaterSchema,
  'accent.Accent': AccentSchema,
  'items.ItemFamilyName': ItemFamilyNameSchema,
  'items.Items': ItemsSchema,
  'targets.Targets': TargetsSchema,
  'quests.QuestData': QuestDataSchema,
  'questGraph.QuestGraph': QuestGraphSchema,
  'questSteps.QuestStepRows': QuestStepRowsSchema,
  'speciesPrograms.Species': SpeciesSchema,
  'buildings.BakedBuildingLook': BakedBuildingLookSchema,
  'buildings.BuildingLifeLook': BuildingLifeLookSchema,
  'questInteractions.InteractionRows': InteractionRowsSchema,
  'rows.Rows': RowsSchema,
  'movers.Movers': MoversSchema,
  'modes.Modes': ModesSchema,
  'modes.ZiplineMode': ZiplineModeSchema,
  'modes.UpdraftMode': UpdraftModeSchema,
  'modes.RideGaits': RideGaitsSchema,
  'modes.RideMode': RideModeSchema,
  'modes.GrappleMode': GrappleModeSchema,
  'modes.TraverseMode': TraverseModeSchema,
  'moverMotion.MoverMotion': MoverMotionSchema,
  'moverMotion.MoverTrack': MoverTrackSchema,
  'moverMotion.MoverTrigger': MoverTriggerSchema,
  'moverMotion.MoverDriver': MoverDriverSchema,
  'socketLift.SocketLift': SocketLiftSchema,
  'portalLink.PortalLink': PortalLinkSchema,
  'entryways.Entryways': EntrywaysSchema,
  'navigation.Navigation': NavigationSchema,
  'nativeGround.NativeGround': NativeGroundSchema,
  'ui.Ui': UiSchema,
  'clientScripts.ClientScripts': ClientScriptsSchema,
  'clientChannels.ClientChannels': ClientChannelsSchema,
  'clientChannels.ClientChannelProgram': ClientChannelProgramSchema,
  'clientChannels.PrivateScene': PrivateSceneSchema,
  'ambientLife.ForestLife': ForestLifeSchema,
  'runtimeCost.MemoryMeasurement': MemoryMeasurementSchema,
  'runtimeCost.RuntimeCost': RuntimeCostSchema,
  'runtimeCost.RegionalSimCost': RegionalSimCostSchema,
  'runtime.Runtime': RuntimeSchema,
  'runtime.ClientPlan': ClientPlanRuntimeSchema,
  'clientState.ClientCheckpoint': ClientCheckpointSchema,
  'clientState.ItemCheckpointStates': ItemCheckpointStatesSchema,
  'clientState.LogicalClientCheckpoint': LogicalClientCheckpointSchema,
  'liftRider.LiftRider': LiftRiderSchema,
  'speciesScripts.ScriptSpecies': ScriptSpeciesSchema,
  'eliteScripts.EliteScript': EliteScriptSchema,
  'skins.SkinLookParameters': SkinLookParametersSchema,
  'skins.SkinClipParameters': SkinClipParametersSchema,
  'skins.ShardSkinFile': ShardSkinFileSchema,
  'skinData.SkinClipName': SkinClipNameSchema,
  'skinData.SkinRow': SkinRowSchema,
  'skinData.SkinBinding': SkinBindingSchema,
  'shardSections.ShardNatural': ShardNaturalSchema,
  'shardSections.ShardFinite': ShardFiniteSchema,
  'shardSections.ShardHash': ShardHashSchema,
  'shardSections.ShardReference': ShardReferenceSchema,
  'shardSections.ShardReferences': ShardReferencesSchema,
  'shardSections.ShardNames': ShardNamesSchema,
  'shardSections.CellBounds': CellBoundsSchema,
  'shardSections.Identity': IdentitySchema,
  'shardSections.Requires': RequiresSchema,
  'shardSections.Budgets': BudgetsSchema,
  'shardSections.Sim': SimSchema,
  'shardSections.AuthorCaps': AuthorCapsSchema,
  'shardSections.ServerBudget': ServerBudgetSchema,
  'shardSections.Files': FilesSchema,
  'shardSections.Tiles': TilesSchema,
  'shardSections.Library': LibrarySchema,
  'shardSections.Critical': CriticalSchema,
  'shardSections.Far': FarSchema,
  'shardSections.Spawn': SpawnSchema,
  'terrain.GroundRows': GroundRowsSchema,
  'scalarChannel.ScalarLattice': ScalarLatticeSchema,
  'practiceCourseRows.Controller': PracticeControllerSchema,
  'scalarChannel.ScalarTriplet': ScalarTripletSchema,
  'returnProjectionV2.ReturnProjectionV2': ReturnProjectionV2Schema,
  'scriptContract.ReturnModules': ReturnModulesSchema,
  'nativePhysics.NativeGroundFile': NativeGroundFileSchema,
  'worldAssembly.WorldAssembly': WorldAssemblySchema,
  'binarySource.BinarySource': BinarySourceSchema,
  'namedJsonContracts.QuestTrader': QuestTraderSchema,
  'namedJsonContracts.AdventurePersistence': AdventurePersistenceSchema,
  'namedJsonContracts.PosedLibrary': PosedLibrarySchema,
  'populationEnvironment.PopulationField': PopulationFieldSchema,
  'namedJsonContracts.PageReturnRows': PageReturnRowsSchema,
  'worldScenePlacement.WorldScenePlacementPage': WorldScenePlacementPageSchema,
  'questSteps.CarriedQuest': CarriedQuestSchema,
  'nativeQuestComposition.NativeQuestComposition': NativeQuestCompositionSchema,
  'nativeQuestComposition.NativeQuestServiceSpots':
    NativeQuestServiceSpotsSchema,
  'panelTemplate.QuestPanelCatalogue': QuestPanelCatalogueSchema,
  'sceneDressing.SceneScatterPage': SceneScatterPageSchema,
  'buildings.BuildingLifeDocument': BuildingLifeDocumentSchema,
  'bakedTiles.BakedPlacementPlan': BakedPlacementPlanSchema,
  'sceneSources.SceneModelSource': SceneModelSourceSchema,
  'sceneSources.SceneBakeSource': SceneBakeSourceSchema,
  'worldScenePages.WorldScenePage': WorldScenePageSchema,
  'weatherBundle.WeatherBundle': WeatherBundleSchema,
  'weatherBundle.WeatherDocument': WeatherDocumentSchema,
  'weatherEffects.WeatherEffects': WeatherEffectsSchema,
  'rainPresentation.RainPresentation': RainPresentationSchema,
  'rangedPage.ForestWeatherObservation': ForestWeatherObservationSchema,
  'paintedResources.PaintedAir': PaintedAirSchema,
  'paintedResources.PaintedGround': PaintedGroundSchema,
  'paintedResources.PaintedPanorama': PaintedPanoramaSchema,
  'paintedResources.PainterKeyLight': PainterKeyLightSchema,
  'paintedResources.PainterlyWorld': PainterlyWorldSchema,
  'postGraphLook.PostGraphLook': PostGraphLookSchema,
  'questStory.ChapterStoryPresentation': ChapterStoryPresentationSchema,

  'mixedPopulation.PerchBodyFile': PerchBodyFileSchema,
  'returnProgramDocument.ReturnProgramDocument': ReturnProgramDocumentSchema,
  'returnProgramDocument.ReturnProgramWireDocument':
    ReturnProgramWireDocumentSchema,
  'populationEnvironment.PopulationHabitat': PopulationHabitatSchema,
  'populationRoster.TamingPoseFile': TamingPoseFileSchema,
  'questStory.AdventureContent': AdventureContentSchema,
  'findsCatalogue.FindsCatalogue': FindsCatalogueSchema,
  'wildlifePopulation.WildlifePopulation': WildlifePopulationSchema,
  'practiceCourseRows.FixedPracticeFile': FixedPracticeFileSchema,
  'islandLibrary.FixedGeometryGroups': FixedGeometryGroupsSchema,
  'specimenCatalogue.SpecimenBook': SpecimenBookSchema,
  'heldArms.HeldGraphCards': HeldGraphCardsSchema,
  'arenaRoomDocument.ArenaRoomDocument': ArenaRoomDocumentSchema,
  'riding.ClientRidingSession': ClientRidingSessionSchema,
  'rangedPage.RangedPage': RangedPageSchema,
  'speciesActorsFile.SpeciesActorsFile': SpeciesActorsDocumentSchema,

  'forestNativeInputs.ForestNativeInputs': ForestNativeInputsSchema,
  'waterWorld.WaterWorld': WaterWorldSchema,
  'weaponProfiles.HeldBowFile': HeldBowFileSchema,
  'weaponProfiles.HeldFirearmPage': HeldFirearmPageSchema,
  'heldWeaponDocuments.BladeDocument': BladeDocumentSchema,
  'heldWeaponDocuments.PolearmDocument': PolearmDocumentSchema,
  'heldWeaponDocuments.HeldSlotsDocument': HeldSlotsDocumentSchema,
  'heldJianDocument.HeldJianDocument': HeldJianDocumentSchema,
  'questInteractionSource.QuestInteractionSource': QuestInteractionSourceSchema,
  'questRuntime.QuestRuntimeDocument': QuestRuntimeDocumentSchema,
  'questStoryBindings.QuestStoryBindings': QuestStoryBindingsSchema,
  'questPageComposition.ChapterView': ChapterViewSchema,
}
const wireChecks = new Map<object, string>()
const wireFinite = new Set<object>()
const wireRegexes = new Set<object>()
const windDirections = new Set<object>()
function rememberActions(
  value: unknown,
  path: string,
  seen: WeakSet<object>,
): void {
  if (typeof value !== 'object' || value === null || seen.has(value)) return
  seen.add(value)
  const kind: unknown = Reflect.get(value, 'kind'),
    type: unknown = Reflect.get(value, 'type')
  if (kind === 'schema' && type === 'lazy') {
    const getter: unknown = Reflect.get(value, 'getter')
    if (typeof getter === 'function') {
      const nested: unknown = Reflect.apply(getter, undefined, [undefined])
      rememberActions(nested, `${path}.wrapped`, seen)
    }
  }
  if (kind === 'validation') {
    if (type === 'check' && !wireChecks.has(value)) wireChecks.set(value, path)
    else if (type === 'finite') wireFinite.add(value)
    else if (
      type === 'some_item' &&
      path.endsWith('.entries.wind.wrapped.entries.toward.pipe.1')
    )
      windDirections.add(value)
    else if (type === 'regex') {
      const regex: unknown = Reflect.get(value, 'requirement')
      if (regex instanceof RegExp && regex.flags === 'u') wireRegexes.add(value)
    }
  }
  for (const [key, child] of Object.entries(value))
    rememberActions(child, `${path}.${key}`, seen)
}
for (const [key, schema] of Object.entries(wireRoots)) {
  const module = key.slice(0, key.indexOf('.')),
    binding = key.slice(key.indexOf('.') + 1)
  rememberActions(
    schema,
    `@wildshard/format/${module}#${binding}Schema`,
    new WeakSet(),
  )
}
// A composed quest host shares this exact check object; its nested path must not rename the defining public check.
wireChecks.set(
  DirectorStagesSchema.pipe[1],
  '@wildshard/format/directorStages#DirectorStagesSchema.pipe.1',
)
// ChapterWake borrows this check; composition cannot rename its defining public identity.
const wakePipe: unknown = Reflect.get(WakeEncounterSchema, 'pipe')
const wakeCheck: unknown = Array.isArray(wakePipe) ? wakePipe[1] : undefined
if (
  typeof wakeCheck !== 'object' ||
  wakeCheck === null ||
  Reflect.get(wakeCheck, 'kind') !== 'validation' ||
  Reflect.get(wakeCheck, 'type') !== 'check'
) {
  throw new Error('Missing defining wake encounter validation')
}
wireChecks.set(
  wakeCheck,
  '@wildshard/format/bossEncounter#WakeEncounterSchema.pipe.1',
)

/** Share only complete native grammars within these exact documents. The
 * defining format parsers still own every semantic and resource admission. */
function encounterDefinitions(
  schema: GenericSchema,
): Record<string, GenericSchema> | undefined {
  if (schema === ArenaScriptFightFileSchema)
    return {
      room: ArenaRoomDocumentRowsSchema,
      king: ArenaKingRowsSchema,
      privateScene: PrivateSceneSchema,
      bossProfile: BossProfileSchema,
      legacyReturn: ReturnProgramSchema,
      completeReturn: ReturnProgramDocumentSchema,
      projection: ReturnProjectionV2Schema,
    }
  if (schema === ArenaRoomDocumentSchema)
    return {
      room: ArenaRoomDocumentRowsSchema,
      privateScene: PrivateSceneSchema,
      bossProfile: BossProfileSchema,
      legacyReturn: ReturnProgramSchema,
      completeReturn: ReturnProgramDocumentSchema,
      projection: ReturnProjectionV2Schema,
    }
  if (schema === ArenaScriptGeometrySchema)
    return {
      privateScene: PrivateSceneSchema,
      nativeGeometry: WeatherGeometrySchema,
      channelPrograms: ClientChannelsSchema,
    }
  if (schema === CloudSpecimenSchema)
    return {
      cloudBody: CloudBodySchema,
      privateScene: PrivateSceneSchema,
      nativeGeometry: WeatherGeometrySchema,
      channelPrograms: ClientChannelsSchema,
    }
  if (schema === ClientRidingSessionSchema)
    return {
      legacyReturn: ReturnProgramSchema,
      completeReturn: ReturnProgramDocumentSchema,
      projection: ReturnProjectionV2Schema,
    }
  if (schema === TimedEncountersSchema)
    return {
      nativeGeometryData: WeatherGeometryDataSchema,
      projection: ReturnProjectionV2Schema,
    }
  if (schema === MountedSpecimenSeatSchema)
    return { bakedGeometry: SceneBakedGeometrySchema }
  return undefined
}

/** Complete repeated grammars factored only within the approved native documents. */
function heldDocumentDefinitions(
  schema: GenericSchema,
): Record<string, GenericSchema> | undefined {
  if (schema === HeldJianDocumentSchema)
    return {
      graphArms: GraphArmsSchema,
      postGraph: PostGraphLookSchema,
      channels: ClientChannelsSchema,
    }
  if (
    schema === BladeDocumentSchema ||
    schema === PolearmDocumentSchema ||
    schema === HeldSlotsDocumentSchema
  )
    return {
      completeReturn: ReturnProgramDocumentSchema,
      projection: ReturnProjectionV2Schema,
    }
  if (schema === WaterWorldSchema)
    return {
      sceneNode: WorldSceneWeldNodeSchema,
      completeReturn: ReturnProgramDocumentSchema,
      projection: ReturnProjectionV2Schema,
    }
  if (schema === HeldFirearmPageSchema)
    return { channels: ClientChannelsSchema }
  return undefined
}

/**
 * Convert an author schema with the official converter, refusing every unrecognised custom check or transform.
 * The extracted format checks have explicit bridges. Plumbing's cross-field checks remain named mandatory
 * admission checks; Valibot string bounds use UTF-16 code units, unlike JSON Schema's Unicode code points.
 * The custom-section bridge uses draft-07; existing wire documents keep draft-2020-12.
 * This structural document never replaces the defining format parser's admission verdict.
 */
export function formatJsonSchema(
  schema: GenericSchema,
  target: 'draft-07' | 'draft-2020-12' = 'draft-2020-12',
): FormatJsonSchema {
  const heldDefinitions = heldDocumentDefinitions(schema)
  const definitions = encounterDefinitions(schema)
  return toJsonSchema(schema, {
    target,
    errorMode: 'throw',
    typeMode: 'output',
    // Both page kinds share the complete node grammar. A local definition
    // retains every constraint without repeating that grammar per branch.
    ...(schema === WorldScenePageSchema
      ? { definitions: { sceneNode: WorldSceneWeldNodeSchema } }
      : {}),
    // Both existing weather wires contain the same complete phase program.
    ...(schema === WeatherDocumentSchema
      ? { definitions: { weatherProgram: WeatherProgramSchema } }
      : {}),
    ...(heldDefinitions === undefined ? {} : { definitions: heldDefinitions }),
    // The complete sheep document keeps both original return envelopes and
    // exact-input script/projection constraints, shared without repetition.
    ...(schema === SpeciesActorsDocumentSchema
      ? {
          definitions: {
            legacyReturn: ReturnProgramSchema,
            wireReturn: ReturnProgramWireDocumentSchema,
            projection: ReturnProjectionV2Schema,
          },
        }
      : {}),
    ...(definitions === undefined ? {} : { definitions }),
    // The population's six identical return descriptors share their complete
    // native grammars; the defining parser and every wire constraint remain.
    ...(schema === WildlifePopulationSchema
      ? {
          definitions: {
            legacyReturn: ReturnProgramSchema,
            projection: ReturnProjectionV2Schema,
          },
        }
      : {}),
    ...(schema === PopulationProjectionSchema || schema === PerchBodyFileSchema
      ? {
          definitions: {
            legacyReturn: ReturnProgramSchema,
            wireReturn: ReturnProgramWireDocumentSchema,
            projection: ReturnProjectionV2Schema,
          },
        }
      : {}),
    overrideSchema: ({ valibotSchema }) => {
      if (valibotSchema !== skinPoseLayersRecord)
        return customSchemas.get(valibotSchema)
      // The converter cannot project a union as a record key. Keep both exact key rules and the value grammar.
      const { $schema: _keyDialect, ...propertyNames } = formatJsonSchema(
        CreatureSkinClipNameSchema,
        target,
      )
      const { $schema: _valueDialect, ...additionalProperties } =
        formatJsonSchema(skinPoseLayerValues, target)
      return { type: 'object', propertyNames, additionalProperties }
    },
    overrideAction: ({ valibotAction, jsonSchema, errors }) => {
      if (postIdentityTransforms.has(valibotAction)) return jsonSchema
      // The defining steer-wind action requires at least one nonzero axis.
      if (windDirections.has(valibotAction))
        return { ...jsonSchema, not: { const: [0, 0] } }
      // Exact one-pass sample transforms retain the original wire grammar; JSON numbers are finite.
      if (valibotAction === SkinPoseLayerSchema.entries.times.pipe[1])
        return {
          type: 'array',
          items: { type: 'number' },
          minItems: 2,
          maxItems: 4097,
        }
      if (
        valibotAction ===
        SkinPoseLayerSchema.entries.tracks.pipe[0].item.entries.values.pipe[1]
      )
        return { type: 'array', items: { type: 'number' }, maxItems: 300000 }
      if (valibotAction === GraphArmsSchema.entries.rig.entries.sockets.pipe[3])
        return { ...jsonSchema, uniqueItems: true }
      if (valibotAction === HeldArmsSchema.options[1].entries.tools.pipe[2])
        return { ...jsonSchema, uniqueItems: true }
      // This defining transform only omits empty optional namespaces; all nonempty maps retain the schema below.
      if (valibotAction === DecisionScriptsSchema.pipe[7]) return jsonSchema
      if (valibotAction === EdgeProfileSchema.pipe[1]) {
        // Both arrays must have the same native sample count; bound each branch exactly.
        return {
          ...jsonSchema,
          anyOf: [256, 257].map(count => ({
            properties: {
              heights: { minItems: count, maxItems: count },
              colours: { minItems: count, maxItems: count },
            },
          })),
        }
      }
      if (valibotAction === PlumbingSchema.pipe[3]) {
        return {
          ...jsonSchema,
          'x-wildshard-checks': ['@wildshard/format/plumbing#plumbingRules'],
        } satisfies FormatJsonSchema
      }
      if (valibotAction === StateSchema.pipe[1]) {
        return {
          ...jsonSchema,
          'x-wildshard-checks': ['@wildshard/format/state#stateRules'],
        } satisfies FormatJsonSchema
      }
      if (valibotAction === CommonsCostsSchema.pipe[1]) {
        return {
          ...jsonSchema,
          maxProperties: SHARDFILE_ADMISSION_LIMITS.commons,
        }
      }
      // Only the defining query form derives an omitted collider reference from its required sampling file.
      if (valibotAction === TerrainSchema.options[1].pipe[1])
        return {
          ...jsonSchema,
          required: [...(jsonSchema.required ?? []), 'collider'],
          'x-wildshard-checks': [
            '@wildshard/format/terrain#TerrainSchema.options.1.pipe.1',
          ],
        } satisfies FormatJsonSchema
      // Both defining clip transforms brand the validated string without changing it.
      if (
        valibotAction === SkinClipNameSchema.pipe[2] ||
        valibotAction === namedClipTransform
      )
        return jsonSchema
      // The output identity always carries `saveRevision` and never the old `revision` spelling.
      if (valibotAction === identitySaveRevision) {
        const { revision: _old, ...properties } = jsonSchema.properties ?? {}
        return {
          ...jsonSchema,
          properties,
          required: [
            ...new Set([...(jsonSchema.required ?? []), 'saveRevision']),
          ],
        }
      }
      // `v.readonly()` only narrows the output type (format 0.43.0's grapple owners and hooks); the value is unchanged.
      if (valibotAction.type === 'readonly') return jsonSchema
      const check = wireChecks.get(valibotAction)
      if (check !== undefined) {
        const before =
          (jsonSchema as FormatJsonSchema)['x-wildshard-checks'] ?? []
        return {
          ...jsonSchema,
          'x-wildshard-checks': [...before, check],
        } satisfies FormatJsonSchema
      }
      // JSON numbers cannot contain NaN or infinity. The existing ASCII regexes only use the Unicode flag.
      if (
        valibotAction.reference === finite ||
        finiteNumbers.has(valibotAction) ||
        unicodeRegexes.has(valibotAction) ||
        wireFinite.has(valibotAction) ||
        wireRegexes.has(valibotAction)
      )
        return jsonSchema
      if (
        errors === undefined &&
        jsonSchema.type === 'string' &&
        (valibotAction.type === 'min_length' ||
          valibotAction.type === 'max_length')
      ) {
        return {
          ...jsonSchema,
          'x-wildshard-string-length': 'utf16-code-units',
        } satisfies FormatJsonSchema
      }
      return undefined
    },
  })
}

const namedSchemas = new WeakMap<
  GenericSchema,
  Readonly<Record<string, unknown>>
>()
/** Build-only draft-07 structure for a named JSON producer's defining schema.
 * Like the custom-section bridge, omit documentation annotations that Ajv does
 * not implement; the producer and defining reader retain semantic admission.
 * Unknown checks and transforms still refuse conversion. Never infer from data.
 * New named JSON requests provenance: only an exact defining format root receives
 * its source identity. The default preserves every existing schema byte. */
export function namedJsonSchema(
  schema: GenericSchema,
  options: { provenance?: boolean } = {},
): Readonly<Record<string, unknown>> {
  if (options.provenance === true) {
    const entry = Object.entries(wireRoots).find(([, root]) => root === schema)
    if (entry === undefined)
      throw new Error(
        'Named JSON provenance requires a defining shared format root',
      )
    const [key] = entry,
      split = key.indexOf('.')
    return {
      ...namedJsonSchema(schema),
      $comment: `@wildshard/format/${key.slice(0, split)}#${key.slice(split + 1)}Schema`,
    }
  }
  const previous = namedSchemas.get(schema)
  if (previous !== undefined) return previous
  const structural = (value: unknown): unknown => {
    if (typeof value === 'string' && value.startsWith('#/$defs/'))
      return value.replace('#/$defs/', '#/definitions/')
    if (Array.isArray(value)) return value.map(structural)
    if (typeof value !== 'object' || value === null) return value
    return Object.fromEntries(
      Object.entries(value)
        .filter(
          ([key]) =>
            key !== 'x-wildshard-checks' && key !== 'x-wildshard-string-length',
        )
        .map(([key, child]) => [
          key === '$defs' ? 'definitions' : key,
          structural(child),
        ]),
    )
  }
  const wire = structural(formatJsonSchema(schema, 'draft-07'))
  if (typeof wire !== 'object' || wire === null || Array.isArray(wire))
    throw new Error('Named JSON requires a defining object schema')
  const result: Readonly<Record<string, unknown>> = Object.fromEntries(
    Object.entries(wire),
  )
  namedSchemas.set(schema, result)
  return result
}

/** Project one registered consumer contract to its exact named draft-07 document.
 * Author tools name the contract without borrowing the format's Valibot object. */
export function namedFormatJsonSchema(
  name: string,
): Readonly<Record<string, unknown>> {
  if (!Object.hasOwn(wireRoots, name))
    throw new Error(`Unknown named format contract: ${name}`)
  const schema = wireRoots[name]
  if (schema === undefined)
    throw new Error(`Missing named format contract: ${name}`)
  return namedJsonSchema(schema)
}

/** Build-only provenance catalogue from the defining format objects, independently checked by the product freeze. */
export function namedFormatJsonSchemas(): Readonly<
  Record<string, Readonly<Record<string, unknown>>>
> {
  return Object.fromEntries(
    Object.values(wireRoots).map(schema => {
      const document = namedJsonSchema(schema, { provenance: true })
      return [String(document['$comment']), document]
    }),
  )
}

/** Publish the exact defining schema of a registered logical JSON name.
 * Only metadata changes; the caller retains the original document bytes. */
export function registeredJsonSchema(
  name: RegisteredSchemaJsonName,
): Readonly<Record<string, unknown>>
export function registeredJsonSchema(
  name: string,
): Readonly<Record<string, unknown>> | undefined
export function registeredJsonSchema(
  name: string,
): Readonly<Record<string, unknown>> | undefined {
  const contract = registeredJsonContract(name)
  if (contract === undefined) return undefined
  const document = namedJsonSchema(contract.schema, { provenance: true })
  if (document['$comment'] !== contract.source)
    throw new Error(`Registered JSON defining binding differs: ${name}`)
  return document
}

/** The migrated wire roots, generated from their defining Valibot schemas; whole-shard extraction remains open. */
export function formatJsonSchemas(): Readonly<
  Record<string, FormatJsonSchema>
> {
  const document = (name: string, schema: GenericSchema): FormatJsonSchema => {
    try {
      return {
        ...formatJsonSchema(schema),
        title: name,
        $comment:
          'DO-NOT-EDIT: generated from @wildshard/format by scripts/gen-format-schema.mjs. Structural schema; named checks and UTF-16 bounds still require the defining Valibot parser.',
      }
    } catch (error) {
      throw new Error(`Format schema ${name}: ${String(error)}`, {
        cause: error,
      })
    }
  }
  return {
    'edge-profiles': document('edge-profiles', EdgeProfilesSchema),
    plumbing: document('plumbing', PlumbingSchema),
    state: document('state', StateSchema),
    'commons-costs': document('commons-costs', CommonsCostsSchema),
    ...Object.fromEntries(
      Object.entries(wireRoots).map(([name, schema]) => [
        name,
        document(name, schema),
      ]),
    ),
  }
}

/** JSON-only declaration discovery. Rules describe admission; this document never grants admission. */
export interface SchemaDeclaration {
  kind: string
  rules: {
    kind: string
    requirement?: string | number | boolean
    message?: string
  }[]
  properties?: Record<string, SchemaDeclaration>
  items?: SchemaDeclaration[]
  item?: SchemaDeclaration
  alternatives?: SchemaDeclaration[]
  wrapped?: SchemaDeclaration
  optional?: boolean
  default?: string | number | boolean | null | object
  value?: string | number | boolean
  values?: (string | number | boolean)[]
  key?: SchemaDeclaration
  valueSchema?: SchemaDeclaration
  rest?: SchemaDeclaration
}

function declarationOf(value: unknown): SchemaDeclaration {
  if (typeof value !== 'object' || value === null)
    throw new Error('Expected a defining schema')
  const read = (key: string): unknown => Reflect.get(value, key)
  const type = read('type')
  if (typeof type !== 'string')
    throw new Error('Expected a defining schema type')
  const pipeline = read('pipe')
  if (Array.isArray(pipeline)) {
    const schemas = pipeline.filter(
      (part: unknown) =>
        typeof part === 'object' &&
        part !== null &&
        Reflect.get(part, 'kind') === 'schema',
    )
    const base: unknown = schemas.at(-1)
    if (base === undefined) throw new Error('Missing pipeline schema')
    const declaration = declarationOf(base)
    for (const part of pipeline) {
      if (
        typeof part !== 'object' ||
        part === null ||
        Reflect.get(part, 'kind') === 'schema'
      )
        continue
      const kind: unknown = Reflect.get(part, 'type'),
        requirement: unknown = Reflect.get(part, 'requirement'),
        message: unknown = Reflect.get(part, 'message')
      if (typeof kind !== 'string')
        throw new Error('Missing admission rule type')
      declaration.rules.push({
        kind,
        ...(requirement instanceof RegExp
          ? { requirement: requirement.source }
          : typeof requirement === 'number' ||
              typeof requirement === 'string' ||
              typeof requirement === 'boolean'
            ? { requirement }
            : {}),
        ...(typeof message === 'string' ? { message } : {}),
      })
    }
    return declaration
  }
  const declaration: SchemaDeclaration = { kind: type, rules: [] }
  const entries = read('entries'),
    items = read('items'),
    item = read('item'),
    alternatives = read('options'),
    wrapped = read('wrapped')
  if (typeof entries === 'object' && entries !== null)
    declaration.properties = Object.fromEntries(
      Object.entries(entries).map(([key, schema]) => [
        key,
        declarationOf(schema),
      ]),
    )
  if (Array.isArray(items)) declaration.items = items.map(declarationOf)
  if (typeof item === 'object' && item !== null)
    declaration.item = declarationOf(item)
  if (Array.isArray(alternatives)) {
    if (
      alternatives.every(
        (option: unknown) =>
          typeof option === 'string' ||
          typeof option === 'number' ||
          typeof option === 'boolean',
      )
    )
      declaration.values = alternatives
    else declaration.alternatives = alternatives.map(declarationOf)
  }
  if (typeof wrapped === 'object' && wrapped !== null)
    declaration.wrapped = declarationOf(wrapped)
  for (const [source, target] of [
    ['key', 'key'],
    ['value', 'valueSchema'],
    ['rest', 'rest'],
  ] as const) {
    const child = read(source)
    if (typeof child === 'object' && child !== null)
      declaration[target] = declarationOf(child)
  }
  if (type === 'optional' || type === 'exact_optional')
    declaration.optional = true
  const fallback = read('default'),
    literal = read('literal')
  if (
    fallback === null ||
    typeof fallback === 'string' ||
    typeof fallback === 'number' ||
    typeof fallback === 'boolean' ||
    typeof fallback === 'object'
  )
    declaration.default = structuredClone(fallback)
  if (
    typeof literal === 'string' ||
    typeof literal === 'number' ||
    typeof literal === 'boolean'
  )
    declaration.value = literal
  return declaration
}

/** Inspect every defining field, tuple and union without reaching into Valibot; semantic rules remain mandatory. */
export function schemaDeclaration(schema: GenericSchema): SchemaDeclaration {
  return declarationOf(schema)
}

/** Select an existing JSON document field by RFC 6901 pointer; malformed escapes and absent fields refuse. */
export function schemaAt(document: object, pointer = ''): unknown {
  if (pointer === '') return document
  if (!pointer.startsWith('/'))
    throw new Error('Schema pointer must be empty or start with /')
  let value: unknown = document
  for (const token of pointer.slice(1).split('/')) {
    if (/~(?![01])/u.test(token))
      throw new Error('Invalid schema pointer escape')
    const key = token.replaceAll('~1', '/').replaceAll('~0', '~')
    if (
      typeof value !== 'object' ||
      value === null ||
      !Object.hasOwn(value, key)
    )
      throw new Error(`Unknown schema pointer: ${pointer}`)
    value = Reflect.get(value, key)
  }
  return value
}

/** Declarative author composition; named strings resolve only defining format roots. */
