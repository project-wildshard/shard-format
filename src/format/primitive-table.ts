/**
 * ONE-FORMAT OF17a's primitive table: each family from meta `docs/plans/one-format/HOSTS.md` (approved, J420), the
 * hosts it replaces and what switches it on. `primitives.ts` derives a product's list from it.
 */
interface PrimitiveSwitch {
  readonly section: string
  readonly path: readonly string[]
  /** When set, the family is on only if some row of the list at `path` has this key (a dotted key reads a nested one). */
  readonly having?: string
  /** With `having`: only a row whose `having` key holds this value counts. */
  readonly equals?: string
  /** Only a row without this key counts. */
  readonly lacking?: string
}
interface Primitive {
  readonly name: string
  /** The ONE-FORMAT row that builds it. */
  readonly row: string
  /** The server hosts and page features it replaces (HOSTS.md). A host split across two families sits in the first. */
  readonly hosts: readonly string[]
  readonly on: PrimitiveSwitch | readonly PrimitiveSwitch[] | 'always' | 'later'
}
const TABLE: readonly Primitive[] = [
  {
    name: 'collision',
    row: 'OF41',
    on: 'always',
    hosts: ['collision', 'collision.pieces'],
  },
  {
    name: 'plumbing',
    row: 'OF18',
    on: 'always',
    hosts: [
      'commands',
      'decisions',
      'engine.creatures.update',
      'strings.register',
      'content.catalogue',
      'debug.expose',
      'audio.cues',
      'audio.scene',
      'player.enter',
      'bag.finds',
      'state.adventure',
    ],
  },
  {
    name: 'population',
    row: 'OF29',
    on: { section: 'actors/creatures', path: ['creatures', 'spawns'] },
    hosts: [
      'population.roster',
      'population.spawn-script',
      'population.shelter',
      'population.environment',
      'population.mixed',
      'population.poses',
      'population.reactions',
      'population.settle',
      'population.homes',
      'population.wildlife',
    ],
  },
  {
    name: 'elites',
    row: 'OF33',
    on: [
      {
        section: 'actors/creatures',
        path: ['creatures', 'spawns'],
        having: 'rank',
      },
      {
        section: 'combat/encounters',
        path: ['encounters'],
        having: 'kind',
        equals: 'elite',
      },
    ],
    hosts: [
      'population.elites',
      'population.elites-ready',
      'riding.elites',
      'riding.elites-ready',
      'elite.entry',
      'elite.construct',
    ],
  },
  {
    name: 'boss',
    row: 'OF34',
    on: [
      {
        section: 'combat/encounters',
        path: ['encounters'],
        having: 'kind',
        equals: 'boss',
      },
      { section: 'actors/spawns', path: ['runtime', 'spawns', 'bosses'] },
    ],
    hosts: ['boss.ground', 'boss.spawned', 'boss.held'],
  },
  {
    name: 'boss.arena',
    row: 'OF34',
    on: {
      section: 'combat/encounters',
      path: ['encounters'],
      having: 'arena.bounds',
    },
    hosts: ['boss.arena', 'boss.open-arena'],
  },
  {
    name: 'riding',
    row: 'CC40',
    on: {
      section: 'actors/species',
      path: ['rows', 'species'],
      having: 'mount',
    },
    hosts: [
      'riding.mounted',
      'riding.roster',
      'riding.groups',
      'riding.hunt',
      'riding.trample',
      'riding.environment',
      'riding.taming',
      'riding.session',
      'taming.entry',
    ],
  },
  {
    name: 'patrol',
    row: 'OF37',
    on: { section: 'actors/creatures', path: ['creatures', 'patrols'] },
    hosts: ['encounter.patrol', 'timed.encounters'],
  },
  {
    name: 'held.melee',
    row: 'OF38',
    on: {
      section: 'combat/items',
      path: ['items', 'rows'],
      having: 'kind',
      equals: 'weapon',
      lacking: 'ranged',
    },
    hosts: [
      'item.swept',
      'held.melee',
      'held.arms',
      'held.claims',
      'held.cosmetics',
    ],
  },
  {
    name: 'held.ranged',
    row: 'OF38',
    on: { section: 'combat/items', path: ['items', 'rows'], having: 'ranged' },
    hosts: [
      'item.ranged',
      'combat.motion',
      'ammunition',
      'loadout',
      'held.ranged-feel',
      'held.ranged-page',
      'combat.targets',
    ],
  },
  {
    name: 'sky',
    row: 'OF41',
    on: { section: 'world/days', path: ['rows', 'days'] },
    hosts: ['day.toon', 'day.keyed-sky', 'day.declared'],
  },
  {
    name: 'weather',
    row: 'OF41',
    on: { section: 'world/weather', path: ['rows', 'weather'] },
    hosts: [
      'weather.program',
      'weather.native',
      'weather.forest',
      'weather.fields',
    ],
  },
  {
    name: 'water.sea',
    row: 'OF40',
    on: {
      section: 'world/water',
      path: ['water'],
      having: 'kind',
      equals: 'sea',
    },
    hosts: ['water.sea', 'world.water'],
  },
  {
    name: 'water.field',
    row: 'OF40',
    on: { section: 'world/field', path: [] },
    hosts: ['water.field'],
  },
  {
    name: 'grapple',
    row: 'OF41',
    on: { section: 'state/modes', path: ['modes', 'grapple'] },
    hosts: ['grapple'],
  },
  {
    name: 'portal',
    row: 'OF41',
    on: {
      section: 'world/edge',
      path: ['entryways'],
      having: 'kind',
      equals: 'portalLink',
    },
    hosts: ['portal.ride'],
  },
]
const PRIMITIVES: readonly Primitive[] = Object.freeze(
  TABLE.map((row): Primitive => Object.freeze(row)),
)

export type { Primitive, PrimitiveSwitch }
export { PRIMITIVES }
