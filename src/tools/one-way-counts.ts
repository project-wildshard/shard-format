import type { SourceFile } from './one-way-source.ts'

interface SourceInventory {
  readonly engine: readonly SourceFile[]
  readonly format: readonly SourceFile[]
  readonly sdk: readonly SourceFile[]
  readonly kinds: readonly string[]
}
const NONE = 0
/** ONE-FORMAT OF10b: each dangerous gate is one deprecated engine function; OF10c1 to OF10c4 take it to 0. */
const DANGEROUS_GATE = /\bexport function dangerous[A-Z]\w*/gu
const OLD_KINDS = new Set(['bear', 'boar', 'deer', 'greyBlob'])
const vocabulary = new RegExp(
  `\\b(?:${[
    ['code', 'shard'],
    ['data', 'shard'],
    ['first', 'party'],
    ['third', 'party'],
    ['trus', 'ted'],
    ['hy', 'brid'],
  ]
    .map((parts: readonly string[]): string => parts.join('[-_ ]?'))
    .join('|')})\\b`,
  'giu',
)

function occurrences(
  files: readonly SourceFile[],
  pattern: Readonly<RegExp>,
): number {
  return files.reduce(
    (total: number, file: Readonly<SourceFile>): number =>
      total +
      [...file.text.matchAll(new RegExp(pattern.source, pattern.flags))].length,
    NONE,
  )
}
function runtime(files: readonly SourceFile[]): readonly SourceFile[] {
  return files.filter(
    (file: Readonly<SourceFile>): boolean =>
      /^(?:src\/|packages\/[^/]+\/src\/)/u.test(file.path) &&
      !/(?:^|\/)(?:test|__tests__|e2e)\//u.test(file.path) &&
      !/\.(?:test|spec)\./u.test(file.path),
  )
}
/** A migration chain step names the old shape it rewrites (J486); it moves the count toward zero, so it is not counted. */
function withoutChainSteps(
  files: readonly SourceFile[],
): readonly SourceFile[] {
  return files.filter(
    (file: Readonly<SourceFile>): boolean =>
      !/^src\/format\/format-migration-[^/]+\.ts$/u.test(file.path),
  )
}
function named(
  files: readonly SourceFile[],
  suffix: string,
): readonly SourceFile[] {
  return files.filter((file: Readonly<SourceFile>): boolean =>
    file.path.endsWith(suffix),
  )
}
/** OF15: names the words do not mean a kind of shard: the DOM event's own flag and the licence notices file. */
const NOT_SHARD_WORDS = new RegExp(
  `\\b${['is', 'Trus', 'ted'].join('')}\\b`,
  'gu',
)
const NOT_SHARD_FILES = new RegExp(
  `(?:^|/)${['THIRD', 'PARTY', 'NOTICES'].join('-')}\\.md$`,
  'u',
)
function words(files: readonly SourceFile[]): number {
  return occurrences(
    files
      .filter(
        (file: Readonly<SourceFile>): boolean =>
          !NOT_SHARD_FILES.test(file.path),
      )
      .map((file: Readonly<SourceFile>): SourceFile => ({
        path: file.path,
        text: file.text
          .replaceAll(NOT_SHARD_WORDS, '')
          .replaceAll(/(?<lower>[a-z])(?<upper>[A-Z])/gu, '$<lower> $<upper>'),
      })),
    vocabulary,
  )
}

function kindLabels(
  files: readonly SourceFile[],
  kinds: readonly string[],
): number {
  const known = new Set(kinds)
  return files.reduce(
    (total: number, file: Readonly<SourceFile>): number =>
      total +
      [...file.text.matchAll(/["'`](?<label>[^"'`\r\n]+)["'`]/gu)].filter(
        (
          match: Readonly<{
            groups?: Readonly<Record<string, string>> | undefined
          }>,
        ): boolean => known.has(match.groups?.['label'] ?? ''),
      ).length,
    NONE,
  )
}

function languageCounts(
  input: Readonly<SourceInventory>,
): Readonly<Record<string, number>> {
  return {
    'engine.retired-vocabulary': words(input.engine),
    'format.retired-vocabulary': words(
      input.format.filter(
        (file: Readonly<SourceFile>): boolean =>
          !file.path.startsWith('corpus/'),
      ),
    ),
    'sdk.retired-vocabulary': words(input.sdk),
  }
}

function isObject(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function oldRows(value: unknown): number {
  if (Array.isArray(value)) {
    return value.reduce(
      (total: number, row: unknown): number => total + oldRows(row),
      NONE,
    )
  }
  if (!isObject(value)) {
    return NONE
  }
  const row = value
  const old =
    typeof row['kind'] === 'string' &&
    OLD_KINDS.has(row['kind']) &&
    typeof row['id'] === 'string' &&
    Array.isArray(row['variants']) &&
    (row['body'] === undefined || row['temperament'] === undefined)
  return (
    Number(old) +
    Object.values(row).reduce(
      (total: number, child: unknown): number => total + oldRows(child),
      NONE,
    )
  )
}
function oldSourceRows(files: readonly SourceFile[]): number {
  let total = NONE
  for (const file of files) {
    if (/(?:^|\/)(?:rows|species)\.json$/u.test(file.path)) {
      const data: unknown = JSON.parse(file.text)
      total += oldRows(data)
    }
  }
  return total
}

/** Source metrics cover the audit's registry, pointer, gate and vocabulary seams. */
function sourceCounts(
  input: Readonly<SourceInventory>,
): Readonly<Record<string, number>> {
  const engine = runtime(input.engine)
  const sdk = runtime(input.sdk)
  return {
    'engine.kind-literals': kindLabels(engine, input.kinds),
    'engine.kit-registrations': occurrences(
      named(engine, '/systems/species/install.ts'),
      /\bregister(?:Species)?\s*\(/gu,
    ),
    'engine.look-fallbacks': occurrences(
      named(engine, '/entities/species/look.ts'),
      /\bregisteredSpecies\s*\(/gu,
    ),
    'engine.temperament-guesses': occurrences(
      named(engine, '/huntPattern.ts'),
      /aggressive\s*\?\s*BOAR_TUNING\s*:\s*DEER_TUNING/gu,
    ),
    'engine.grid-pointer-references': occurrences(
      engine,
      /\bgridShardfile\b/gu,
    ),
    'sdk.grid-pointer-references': occurrences(sdk, /\bgridShardfile\b/gu),
    'format.grid-pointer-references': occurrences(
      withoutChainSteps(runtime(input.format)),
      /\bgridShardfile\b/gu,
    ),
    'engine.access-gate-references': occurrences(engine, /\bfirstParty\b/gu),
    'engine.dangerous-gates': occurrences(engine, DANGEROUS_GATE),
    'sdk.engine-kit-imports': occurrences(
      sdk,
      /@wildshard\/engine\/game\/systems\/species\//gu,
    ),
    'sdk.old-kind-source-rows': oldSourceRows(sdk),
    'engine.kind-keyed-tables':
      occurrences(named(engine, '/harvest.ts'), /\bconst\s+HARVEST\b/gu) +
      occurrences(
        named(engine, '/Inventory.ts'),
        /\btype\s+ItemId\s*=(?!\s*string\b)/gu,
      ),
    'format.kind-keyed-tables': occurrences(
      named(input.format, '/compendiumRows.ts'),
      /\bicon:\s*v\.picklist\(\[[^\]]*["'](?:boar|bear|deer|elk)["'][^\]]*\]\)/gu,
    ),
    ...languageCounts(input),
  }
}

/** A ceiling can fall; neither a new counter nor a higher count is accepted. */
function countRises(
  baseline: Readonly<Record<string, number>>,
  current: Readonly<Record<string, number>>,
): readonly string[] {
  return Object.entries(current)
    .filter(
      ([name, count]: readonly [string, number]): boolean =>
        baseline[name] === undefined || count > (baseline[name] ?? NONE),
    )
    .map(
      ([name, count]: readonly [string, number]): string =>
        `${name}: ${String(baseline[name] ?? NONE)} -> ${String(count)}`,
    )
}

export { countRises, sourceCounts }
export type { SourceInventory }
