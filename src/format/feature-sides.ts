// SERVER-PARITY SS2 (meta docs/plans/SERVER-PARITY-PLAN.md): every content kind declares its side, and admission
// refuses a kind that has none, so a new page kind can't ship without saying whether the server needs a half.
import type { ClientFeatureRow } from './clientPlan.ts'
import type { WorldAssemblyStage } from './worldAssembly.ts'

/** `view`: page only, draws, never gameplay. `both`: the server owns the gameplay half and the page draws it.
 *  `server`: no page part. */
type FeatureSide = 'both' | 'server' | 'view'

/** A side, and for `both` or `server` the key the engine's server installer registers under (SS3). */
type SideEntry =
  | { readonly side: 'view' }
  | { readonly server: string; readonly side: 'both' | 'server' }

type ClientFeatureKind = ClientFeatureRow['kind']
type WorldAssemblyStageKind = WorldAssemblyStage['kind']

const VIEW: SideEntry = { side: 'view' }
const COLLISION: SideEntry = { server: 'collision', side: 'both' }

/** Builds a `both` entry naming its server installer. */
function both(server: string): SideEntry {
  return { server, side: 'both' }
}

/**
 * The side of each `client/plan` feature kind. Typed as a total record, so a kind added to `ClientFeatureSchema`
 * without a side fails typecheck here. A `both` kind the server reads straight from `client/plan` today
 * (`combat.targets`, `elite.construct`, `elite.entry`, `timed.encounters`, and `view.program`, whose pose views the
 * slots and open-arena bosses run) names the engine host that reads it; HS6 moves those reads into native-assembly rows.
 * `page.life` is `view` (SS7 refuses a `sim` script bound only by it).
 */
const CLIENT_FEATURE_SIDES: Readonly<Record<ClientFeatureKind, SideEntry>> =
  Object.freeze({
    'arena-room.entry': VIEW,
    'audio.cues': VIEW,
    'audio.scene': VIEW,
    'bag.finds': VIEW,
    'boss.held': both('heldBoss'),
    'boss.spawned': VIEW,
    'boss.telegraph': VIEW,
    'combat.targets': both('heldArms'),
    'content.catalogue': both('loadout'),
    'debug.expose': VIEW,
    'elite.construct': both('windElite'),
    'elite.entry': both('windElite'),
    'fx.trail': VIEW,
    'held.claims.enter': both('grapple'),
    'held.claims.install': both('heldArms'),
    'held.claims.prepare': both('heldArms'),
    'held.cosmetics': VIEW,
    'held.melee': both('melee'),
    'held.ranged-feel': VIEW,
    'held.ranged-page': both('heldRanged'),
    'light.emitters': VIEW,
    'look.painterly': VIEW,
    'motion.channels': VIEW,
    'page.life': VIEW,
    'player.enter': both('fallFloor'),
    'population.homes': VIEW,
    'population.hull-book': VIEW,
    'population.product-creatures': VIEW,
    'population.wildlife': VIEW,
    'portal.ride': both('portalRide'),
    'practice.course': VIEW,
    'quest.chapter-view': VIEW,
    'quest.composition': both('questComposition'),
    'quest.continuation': both('keepsakes'),
    'quest.page': both('questHost'),
    'quest.reference': both('places'),
    'quest.spawns': VIEW,
    'quest.views': VIEW,
    'quest.world': both('places'),
    'riding.session': VIEW,
    'species.program': VIEW,
    'state.adventure': both('saves'),
    'stealth.entry': both('stealth'),
    'strings.register': VIEW,
    'taming.entry': VIEW,
    'timed.encounters': both('slots'),
    'view.program': both('poseViews'),
    'weather.fields': VIEW,
    'weather.forest': VIEW,
    'world.ambient-life': both('harvest'),
    'world.assembly': COLLISION,
    'world.baked': COLLISION,
    // SS3b: named sets only list placed models for the sets explorer; a place's gameplay (respawn, discovery) is quest.world's
    'world.bind-sets': VIEW,
    'world.dressing': COLLISION,
    'world.forest-page': COLLISION,
    'world.meadow': VIEW,
    'world.movers': both('movers'),
    'world.paths': COLLISION,
    'world.runtime-hooks': both('fallFloor'),
    'world.scenes': COLLISION,
    'world.sets': VIEW,
    'world.updates': VIEW,
    'world.water': VIEW,
  })

/** The side of each `world.assembly` stage kind: a stage that places solids is `both` (the server's collision bake);
 *  a stage that only draws is `view`. */
const WORLD_ASSEMBLY_STAGE_SIDES: Readonly<
  Record<WorldAssemblyStageKind, SideEntry>
> = Object.freeze({
  'ambient-flock': VIEW,
  'arena-room': both('arenaRoom'),
  dressing: COLLISION,
  'dressing-anchor': COLLISION,
  'dressing-piece': COLLISION,
  'drawn-models': VIEW,
  entry: COLLISION,
  'fixed-draws': VIEW,
  group: COLLISION,
  mesh: COLLISION,
  'painted-reseed': VIEW,
  'painted-world': VIEW,
  place: COLLISION,
  'rope-chain': both('ropeDecks'),
  'rope-deck': both('ropeDecks'),
  site: COLLISION,
  'streamed-cover': VIEW,
  'water-surface': VIEW,
})

/** The tables admission checks against; tests pass a narrower one to prove a missing entry is refused. */
interface SideTables {
  readonly features: Readonly<Record<string, SideEntry>>
  readonly stages: Readonly<Record<string, SideEntry>>
}

const SIDE_TABLES: SideTables = Object.freeze({
  features: CLIENT_FEATURE_SIDES,
  stages: WORLD_ASSEMBLY_STAGE_SIDES,
})

/** An own property of a plain object, or `undefined`. */
function propOf(value: unknown, key: string): unknown {
  if (
    typeof value !== 'object' ||
    value === null ||
    !Object.hasOwn(value, key)
  ) {
    return undefined
  }
  const found: unknown = Reflect.get(value, key)
  return found
}

/** The `kind` of a plain object row, or `undefined` when the row isn't one. */
function kindOf(row: unknown): string | undefined {
  const kind = propOf(row, 'kind')
  return typeof kind === 'string' ? kind : undefined
}

/** An own array property of a plain object, or an empty list. */
function listOf(value: unknown, key: string): readonly unknown[] {
  const list = propOf(value, key)
  return Array.isArray(list) ? list : []
}

/** The kinds in `rows` that `table` has no entry for, each written as `<prefix> <kind>`. */
function missingKinds(
  rows: readonly unknown[],
  table: Readonly<Record<string, SideEntry>>,
  prefix: string,
): string[] {
  return rows.flatMap((row: unknown): string[] => {
    const kind = kindOf(row)
    return kind === undefined || Object.hasOwn(table, kind)
      ? []
      : [`${prefix} ${kind}`]
  })
}

/** Every feature and `world.assembly` stage kind in a raw `client/plan` payload that has no side, as
 *  `client/plan <kind>` or `world.assembly <kind>`. Rows without a string kind are left to the section schema. */
function unsidedKinds(
  plan: unknown,
  tables: SideTables = SIDE_TABLES,
): string[] {
  const features = listOf(plan, 'features')
  const stages = features
    .filter((feature: unknown): boolean => kindOf(feature) === 'world.assembly')
    .flatMap((feature: unknown): readonly unknown[] =>
      listOf(propOf(feature, 'rows'), 'stages'),
    )
  return [
    ...new Set([
      ...missingKinds(features, tables.features, 'client/plan'),
      ...missingKinds(stages, tables.stages, 'world.assembly'),
    ]),
  ]
}

/** Refuse a section that names a kind with no declared side. Only `client/plan` carries sided kinds today; every other
 *  section passes. Runs before the section schema, so the refusal names the missing side. */
function assertSectionSides(
  name: string,
  value: unknown,
  tables: SideTables = SIDE_TABLES,
): void {
  if (name !== 'client/plan') {
    return
  }
  const [first, ...rest] = unsidedKinds(value, tables)
  if (first !== undefined) {
    const missing = [first, ...rest]
    throw new Error(
      `Unsided content kind (no view, both or server entry): ${missing.join(', ')}`,
    )
  }
}

/** The declared side entry of one `client/plan` feature kind. */
function clientFeatureSide(kind: ClientFeatureKind): SideEntry {
  return CLIENT_FEATURE_SIDES[kind]
}

/** The declared side entry of one `world.assembly` stage kind. */
function worldAssemblyStageSide(kind: WorldAssemblyStageKind): SideEntry {
  return WORLD_ASSEMBLY_STAGE_SIDES[kind]
}

export {
  CLIENT_FEATURE_SIDES,
  SIDE_TABLES,
  WORLD_ASSEMBLY_STAGE_SIDES,
  assertSectionSides,
  clientFeatureSide,
  unsidedKinds,
  worldAssemblyStageSide,
}
export type { FeatureSide, SideEntry, SideTables }
