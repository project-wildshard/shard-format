import { PRIMITIVES } from './primitive-table.ts'
import { ACCEPTED_SECTION_VERSIONS, FIRST_VERSION } from './section-versions.ts'

import type { Primitive, PrimitiveSwitch } from './primitive-table.ts'

/**
 * ONE-FORMAT OF17a (J365 (6), J367 (5), Q-T22 option (b), Q-T27 (a)): no host list ships. A section switches a primitive
 * on, and the server works out the list from the product's sections. The families and their hosts are the verdict
 * table, meta `docs/plans/one-format/HOSTS.md` (OF16a), approved by Jake (OF16b, J420).
 *
 * `on` says what turns a family on: `always` (every product has it), one or more section paths whose value is a non-empty
 * array or object (the first that matches names the section), or `later` while its row (`row`) has not given it a section
 * yet. OF17d: a family a shard already declares in an existing section switches on from it. A family's version is its
 * section's `@N` (`ACCEPTED_SECTION_VERSIONS`): changes are additive, and a removal follows SHARD-COMPAT's rollout.
 */
/** An empty array or object switches nothing on. */
const NONE = 0

/** One family the server switched on, at the version of the section that switched it; no `section` for `always`. */
interface DerivedPrimitive {
  readonly name: string
  readonly section?: string
  readonly version: number
}

/** Hosts HOSTS.md leaves out of the primitives: Nalati's stealth entry (Q-S4). The quest hosts (Q-S5) joined the `quest`
 * family when FORMAT-PRUNE FP16 gave them a home (`server/quest`, ONE-FORMAT OF17b3). */
const OUT_OF_SCOPE_HOSTS: readonly string[] = Object.freeze(['stealth.entry'])

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
/** A row's key, or a nested one by a dotted key (`arena.bounds`). */
function field(row: object, key: string): { has: boolean; value?: unknown } {
  const keys = key.split('.')
  const last = keys.pop() ?? key
  const holder = at(row, keys)
  if (typeof holder !== 'object' || holder === null) {
    return { has: false }
  }
  return {
    has: Object.hasOwn(holder, last),
    value: Object.getOwnPropertyDescriptor(holder, last)?.value,
  }
}
function rowCounts(row: unknown, rule: PrimitiveSwitch): boolean {
  if (typeof row !== 'object' || row === null) {
    return false
  }
  const { having, equals, lacking } = rule
  if (lacking !== undefined && Object.hasOwn(row, lacking)) {
    return false
  }
  if (having === undefined) {
    return true
  }
  const found = field(row, having)
  return found.has && (equals === undefined || found.value === equals)
}
function switchedOn(value: unknown, rule: PrimitiveSwitch): boolean {
  if (rule.having === undefined && rule.lacking === undefined) {
    return filled(value)
  }
  return (
    Array.isArray(value) &&
    value.some((row: unknown): boolean => rowCounts(row, rule))
  )
}
/** A family's switches, as a list. */
function switchesOf(on: Primitive['on']): readonly PrimitiveSwitch[] {
  if (on === 'always' || on === 'later') {
    return []
  }
  return 'section' in on ? [on] : on
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
    const hit = switchesOf(row.on).find((rule: PrimitiveSwitch): boolean =>
      switchedOn(at(sections.get(rule.section), rule.path), rule),
    )
    if (hit === undefined) {
      return []
    }
    const { section } = hit
    return [
      {
        name: row.name,
        section,
        version: versions.get(section) ?? newest(section),
      },
    ]
  })
}

export type { DerivedPrimitive }
export type { Primitive, PrimitiveSwitch } from './primitive-table.ts'
export { PRIMITIVES } from './primitive-table.ts'
export { OUT_OF_SCOPE_HOSTS, derivePrimitives, primitiveOfHost, switchesOf }
