import { ACCEPTED_SECTION_VERSIONS, FIRST_VERSION } from './section-versions.ts'

/**
 * ONE-FORMAT OF17a (J365 (6), J367 (5), Q-T22 option (b), Q-T27 (a)): no host list ships. A section switches a primitive
 * on, and the server works out the list from the product's sections. The families and their hosts are the verdict
 * table, meta `docs/plans/one-format/HOSTS.md` (OF16a), pending Jake's corrections (OF16b).
 *
 * `on` says what turns a family on: `always` (every product has it), a section path whose value is a non-empty array or
 * object, or `later` while its row (`row`) has not given it a section yet. A family's version is its section's `@N`
 * (`ACCEPTED_SECTION_VERSIONS`): changes are additive, and a removal follows SHARD-COMPAT's rollout.
 */
/** An empty array or object switches nothing on. */
const NONE = 0

interface PrimitiveSwitch {
  readonly section: string
  readonly path: readonly string[]
}
interface Primitive {
  readonly name: string
  /** The ONE-FORMAT row that builds it. */
  readonly row: string
  /** The server hosts and page features it replaces (HOSTS.md). A host split across two families sits in the first. */
  readonly hosts: readonly string[]
  readonly on: PrimitiveSwitch | 'always' | 'later'
}
/** One family the server switched on, at the version of the section that switched it; no `section` for `always`. */
interface DerivedPrimitive {
  readonly name: string
  readonly section?: string
  readonly version: number
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
    on: 'later',
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
    on: 'later',
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
    on: 'later',
    hosts: ['boss.ground', 'boss.spawned', 'boss.held'],
  },
  {
    name: 'boss.arena',
    row: 'OF34',
    on: 'later',
    hosts: ['boss.arena', 'boss.open-arena'],
  },
  {
    name: 'riding',
    row: 'CC40',
    on: 'later',
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
    on: 'later',
    hosts: ['encounter.patrol', 'timed.encounters'],
  },
  {
    name: 'held.melee',
    row: 'OF38',
    on: 'later',
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
    on: 'later',
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
    on: 'later',
    hosts: ['water.sea', 'world.water'],
  },
  { name: 'water.field', row: 'OF40', on: 'later', hosts: ['water.field'] },
  { name: 'grapple', row: 'OF41', on: 'later', hosts: ['grapple'] },
  { name: 'portal', row: 'OF41', on: 'later', hosts: ['portal.ride'] },
]
const PRIMITIVES: readonly Primitive[] = Object.freeze(
  TABLE.map((row): Primitive => Object.freeze(row)),
)

/** Hosts HOSTS.md leaves out of the primitives: quest (Q-S5), opened as it is; Nalati's stealth entry (Q-S4). */
const OUT_OF_SCOPE_HOSTS: readonly string[] = Object.freeze([
  'quest.body-scripts',
  'quest.composition',
  'quest.chapter',
  'quest.kill-steps',
  'stealth.entry',
])

const HOST_FAMILY: ReadonlyMap<string, string> = new Map(
  PRIMITIVES.flatMap((row): (readonly [string, string])[] =>
    row.hosts.map((host): readonly [string, string] => [host, row.name]),
  ),
)

/** The family a host joins, or `undefined` for a host outside the table. */
function primitiveOfHost(host: string): string | undefined {
  return HOST_FAMILY.get(host)
}

function at(value: unknown, path: readonly string[]): unknown {
  let here = value
  for (const key of path) {
    if (typeof here !== 'object' || here === null || Array.isArray(here)) {
      return undefined
    }
    const next: unknown = Object.getOwnPropertyDescriptor(here, key)?.value
    here = next
  }
  return here
}
function filled(value: unknown): boolean {
  if (Array.isArray(value)) {
    return value.length > NONE
  }
  return (
    typeof value === 'object' &&
    value !== null &&
    Object.keys(value).length > NONE
  )
}
function newest(section: string): number {
  return Math.max(...(ACCEPTED_SECTION_VERSIONS[section] ?? [FIRST_VERSION]))
}

/**
 * The primitives a product's sections switch on, in table order: `sections` maps each section name to its admitted
 * value. A family is on when its switch path holds a non-empty array or object. `versions` are the `@N` the index named
 * (default: the newest this format reads).
 */
function derivePrimitives(
  sections: ReadonlyMap<string, unknown>,
  versions: ReadonlyMap<string, number> = new Map(),
): DerivedPrimitive[] {
  return PRIMITIVES.flatMap((row): DerivedPrimitive[] => {
    if (row.on === 'always') {
      return [{ name: row.name, version: FIRST_VERSION }]
    }
    if (
      row.on === 'later' ||
      !filled(at(sections.get(row.on.section), row.on.path))
    ) {
      return []
    }
    const { section } = row.on
    return [
      {
        name: row.name,
        section,
        version: versions.get(section) ?? newest(section),
      },
    ]
  })
}

export type { DerivedPrimitive, Primitive, PrimitiveSwitch }
export { OUT_OF_SCOPE_HOSTS, PRIMITIVES, derivePrimitives, primitiveOfHost }
