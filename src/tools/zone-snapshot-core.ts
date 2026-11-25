// ZONE-SNAPSHOTS ZS1 (J507): the zone-snapshot rules, pure. Tests read the live pins by slug, Brasscap's one
// script-written export at the current format and made-up chain fixtures; no other checked-in copy of a zone may
// come back. zone-snapshot-guard.ts runs it in `pnpm check` against a shrink-only baseline.

interface GuardInput {
  readonly paths: readonly string[]
  readonly read: (file: string) => string
  readonly current: string
  readonly zones: readonly string[]
}
interface Verdict {
  readonly added: readonly string[]
  readonly gone: readonly string[]
}
interface ShardRules {
  readonly current: string
  readonly slugs: ReadonlySet<string>
}

const NONE = 0
const VERSION_PARTS = 4
const VALUE = 1
const SCOPE = ['src/', 'corpus/', 'test/', 'src/scripts/', 'packages/']
const SELF = new Set([
  'src/tools/zone-snapshot-core.ts',
  'src/tools/zone-snapshot-guard.ts',
  'src/tools/zone-snapshot-guard.test.ts',
  'src/tools/zone-snapshot-baseline.json',
])
const TEXT = /\.(?:json|ts|mts|mjs|js|cjs)$/u
/** Zones that left the grid but whose names still mark a snapshot. */
const RETIRED = ['ink-cel-valley', 'pastel-plain', 'far-reach']
/** Short names the tree uses for zones beside their slugs. */
const ALIASES = [
  'dunes',
  'nine',
  'pine',
  'nalati',
  'sunscar',
  'brasscap',
  'driftwood',
  'mossgate',
  'glowfen',
]
const SLUG_HASH =
  /["']?slug["']?\s*:\s*["'][a-z0-9-]+["'][^{}]{0,400}?["']?(?:hash|sha256|sourceHash)["']?\s*:\s*["'][0-9a-f]{64}["']|["']?(?:hash|sha256|sourceHash)["']?\s*:\s*["'][0-9a-f]{64}["'][^{}]{0,400}?["']?slug["']?\s*:\s*["'][a-z0-9-]+["']/u
const PIN_TAR = /pins\/[0-9a-f]{64}\.tar/u
const PIN_CACHE = /wildshard\/pins|\.cache\/wildshard['"`,\s)]+[^\n]{0,40}pins/u
const HASH = /['"][0-9a-f]{64}['"]/u
/** The one export a pin file may sit beside. */
const MADE_UP = 'src/test/fixtures/'
const EXPORT_PIN = /^corpus\/exports\/[^/]+\.pin\.json$/u
/** Chain fixtures and goldens may not name a real old file. */
const CHAIN_FILE = /^corpus\/(?:format-versions\/|format-goldens\.json$)/u
const CHAIN_SNAPSHOT = /"pin"\s*:|chainOf|corpus\/legacy/u
const KNOWN_FAILURES = 'corpus/known-failures.json'

function partAt(parts: readonly number[], index: number): number {
  return parts[index] ?? NONE
}

function compareVersions(left: string, right: string): number {
  const one = left.split('.').map(Number)
  const two = right.split('.').map(Number)
  const steps = Array.from(
    { length: VERSION_PARTS },
    (_unused: unknown, index: number): number =>
      partAt(one, index) - partAt(two, index),
  )
  return steps.find((step: number): boolean => step !== NONE) ?? NONE
}

function zoneNames(zones: readonly string[]): readonly string[] {
  return [...new Set([...zones, ...RETIRED, ...ALIASES])].toSorted(
    (left: string, right: string): number => right.length - left.length,
  )
}

function field(json: unknown, key: string): unknown {
  if (json === null || typeof json !== 'object') {
    return undefined
  }
  const entry = Object.entries(json).find(
    ([name]: readonly [string, unknown]): boolean => name === key,
  )
  return entry?.[VALUE]
}

function stringField(json: unknown, key: string): string | undefined {
  const value = field(json, key)
  return typeof value === 'string' ? value : undefined
}

function shardVersion(json: unknown): string | undefined {
  return stringField(json, 'formatVersion') ?? stringField(json, 'version')
}

function parse(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

function pinned(text: string): boolean {
  return (
    SLUG_HASH.test(text) ||
    PIN_TAR.test(text) ||
    (PIN_CACHE.test(text) && HASH.test(text))
  )
}

function textOffences(file: string, text: string): readonly string[] {
  return [
    ...(pinned(text) && !EXPORT_PIN.test(file) ? [`pin-record ${file}`] : []),
    ...(CHAIN_FILE.test(file) && CHAIN_SNAPSHOT.test(text)
      ? [`chain-snapshot ${file}`]
      : []),
  ]
}

function olderThan(version: string | undefined, current: string): boolean {
  return (
    version !== undefined &&
    /^[0-9.]+$/u.test(version) &&
    compareVersions(version, current) < NONE
  )
}

function shardOffences(
  file: string,
  text: string,
  rules: Readonly<ShardRules>,
): readonly string[] {
  if (!file.endsWith('/shard.json')) {
    return []
  }
  const json = parse(text)
  const slug = stringField(field(json, 'identity'), 'slug')
  const zone = slug !== undefined && rules.slugs.has(slug)
  const named = zone && !file.startsWith('corpus/exports/')
  // ZS6: a made-up product (no zone slug) under src/test/fixtures/ may sit at an old format: the chain's old original.
  const madeUp = !zone && file.startsWith(MADE_UP)
  return (olderThan(shardVersion(json), rules.current) && !madeUp) || named
    ? [`shard-folder ${file}`]
    : []
}

function readText(input: Readonly<GuardInput>, file: string): string {
  try {
    return input.read(file)
  } catch {
    return ''
  }
}

function pathOffences(
  file: string,
  revision: Readonly<RegExp>,
): readonly string[] {
  return [
    ...(revision.test(file) ? [`revision-path ${file}`] : []),
    ...(file === KNOWN_FAILURES ? [`known-failures ${file}`] : []),
  ]
}

function inScope(file: string): boolean {
  return (
    SCOPE.some((prefix: string): boolean => file.startsWith(prefix)) &&
    !SELF.has(file)
  )
}

/** Every offender in a tree, sorted: `<rule> <path>`. */
function zoneSnapshotOffenders(input: Readonly<GuardInput>): readonly string[] {
  const revision = new RegExp(
    `(?:^|[/_.-])(?:${zoneNames(input.zones).join('|')})-r[0-9]+(?:[/_.-]|$)`,
    'u',
  )
  const rules: ShardRules = {
    current: input.current,
    slugs: new Set([...input.zones, ...RETIRED]),
  }
  const found: string[] = []
  for (const file of input.paths.filter(inScope)) {
    const text = TEXT.test(file) ? readText(input, file) : ''
    found.push(
      ...pathOffences(file, revision),
      ...textOffences(file, text),
      ...shardOffences(file, text, rules),
    )
  }
  return [...new Set(found)].toSorted()
}

/** New offenders and baseline lines that no longer offend. */
function judge(
  offenders: readonly string[],
  baseline: readonly string[],
): Verdict {
  const listed = new Set(baseline)
  const now = new Set(offenders)
  return {
    added: offenders.filter((line: string): boolean => !listed.has(line)),
    gone: baseline.filter((line: string): boolean => !now.has(line)),
  }
}

export { compareVersions, judge, zoneNames, zoneSnapshotOffenders }
export type { GuardInput, Verdict }
