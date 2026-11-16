import type { SourceFile } from './one-way-source.ts'

interface SourceInventory {
  readonly engine: readonly SourceFile[]
  readonly format: readonly SourceFile[]
  readonly sdk: readonly SourceFile[]
  readonly kinds: readonly string[]
}
const NONE = 0
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
function named(
  files: readonly SourceFile[],
  suffix: string,
): readonly SourceFile[] {
  return files.filter((file: Readonly<SourceFile>): boolean =>
    file.path.endsWith(suffix),
  )
}
function words(files: readonly SourceFile[]): number {
  return occurrences(
    files.map((file: Readonly<SourceFile>): SourceFile => ({
      ...file,
      text: file.text.replaceAll(
        /(?<lower>[a-z])(?<upper>[A-Z])/gu,
        '$<lower> $<upper>',
      ),
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
      runtime(input.format),
      /\bgridShardfile\b/gu,
    ),
    'engine.access-gate-references': occurrences(engine, /\bfirstParty\b/gu),
    'sdk.engine-kit-imports': occurrences(
      sdk,
      /@wildshard\/engine\/game\/systems\/species\//gu,
    ),
    'sdk.old-kind-source-labels': occurrences(
      sdk,
      /["'`](?:bear|boar|deer|greyBlob)["'`]/gu,
    ),
    'engine.kind-keyed-tables':
      occurrences(named(engine, '/harvest.ts'), /\bconst\s+HARVEST\b/gu) +
      occurrences(named(engine, '/Inventory.ts'), /\btype\s+ItemId\b/gu),
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
