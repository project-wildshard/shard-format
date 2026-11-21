// oxlint-disable typescript/prefer-readonly-parameter-types -- the index is valibot output, only read
/** The deprecation counter (SHARD-COMPAT FE7, J486). A deprecated path still validates; it carries the version that
 * deprecated it and its replacement, both validators warn when a shard file uses it, and the corpus counts the kept
 * files using each (`shard-format corpus`). A path with a migration is mended by the chain; one without waits for its
 * users to reach zero before it is deleted. */
import type { OutputIndex } from './outputIndex.ts'

/** One deprecated path. */
interface Deprecation {
  /** Stable id the warnings and the corpus count use. */
  readonly id: string
  /** Where it sits in a shard file, in words. */
  readonly path: string
  /** The format version that deprecated it. */
  readonly since: string
  /** What to write instead. */
  readonly replacement: string
  /** The chain step that mends it, or `undefined` when nothing can (`format-migrations.ts`). */
  readonly migration: string | undefined
}

/** What a deprecation test reads: the index and each section by name. */
interface DeprecationInput {
  readonly index: Readonly<OutputIndex> | Readonly<Record<string, unknown>>
  readonly sections: ReadonlyMap<string, unknown>
}

interface DeprecationRule extends Deprecation {
  readonly uses: (shard: Readonly<DeprecationInput>) => boolean
}

const LEGACY_SPELLING = '0.1'
/** Deprecated in the current format with no data change: a shard file of any version may still carry it. */
const CURRENT = '0.1.0.1'
/** FORMAT-PRUNE FP15: OF30 cut B leaves these as plain JSON nothing reads. */
const SPECIES_PROGRAM_FAMILY: readonly string[] = [
  'actors/species-programs',
  'look/hull-book',
  'look/rigged-hulls',
]

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Reflect.get(value, key)
    : undefined
}

const RULES: readonly DeprecationRule[] = [
  {
    id: 'version.two-part',
    path: 'shard.json version and requires.sdk spelled "0.1"',
    since: '0.1.0.0',
    replacement: 'the four-part "0.1.0.0"',
    migration: 'fp6-four-part-version',
    uses: (shard: Readonly<DeprecationInput>): boolean =>
      field(shard.index, 'version') === LEGACY_SPELLING,
  },
  {
    id: 'manifest.gridShardfile',
    path: 'sections/ui/level manifest.gridShardfile (and the discovery mount)',
    since: '0.1.0.1',
    replacement: 'manifest.shardfile',
    migration: 'fp8-shardfile-pointer',
    uses: (shard: Readonly<DeprecationInput>): boolean =>
      field(
        field(shard.sections.get('ui/level'), 'manifest'),
        'gridShardfile',
      ) !== undefined,
  },
  {
    id: 'runtime.trust',
    path: 'shard.json runtime.trust',
    since: '0.1.0.1',
    replacement: 'nothing: no reader reads it',
    migration: 'fp3-drop-runtime-trust',
    uses: (shard: Readonly<DeprecationInput>): boolean =>
      field(field(shard.index, 'runtime'), 'trust') !== undefined,
  },
  ...SPECIES_PROGRAM_FAMILY.map((name: string): DeprecationRule => ({
    id: `section.${name}`,
    path: `sections/${name} (the species-program family, FORMAT-PRUNE FP15)`,
    since: CURRENT,
    replacement:
      'species rows and authored looks (actors/species); nothing reads it once OF30 lands',
    migration: undefined,
    uses: (shard: Readonly<DeprecationInput>): boolean =>
      shard.sections.has(name),
  })),
  {
    id: 'admission.server',
    path: 'shard.json admission.server (native assembly, FORMAT-PRUNE FP16)',
    since: CURRENT,
    replacement:
      'the server primitives: the server derives every host (OF17b3)',
    migration: undefined,
    uses: (shard: Readonly<DeprecationInput>): boolean =>
      field(field(shard.index, 'admission'), 'server') !== undefined,
  },
]

/** Every deprecated path, without its test. */
const DEPRECATIONS: readonly Deprecation[] = RULES.map(
  ({ uses: _uses, ...row }: Readonly<DeprecationRule>): Deprecation => row,
)

/** The deprecations a shard file uses, in registry order. */
function deprecationsUsed(
  shard: Readonly<DeprecationInput>,
): readonly Deprecation[] {
  return RULES.filter((rule: Readonly<DeprecationRule>): boolean =>
    rule.uses(shard),
  ).map(
    ({ uses: _uses, ...row }: Readonly<DeprecationRule>): Deprecation => row,
  )
}

/** What a validator returns about warnings: its own, then one per deprecated path the file uses, and their ids. */
interface DeprecationReport {
  /** Admitted with a warning: grandfathered script side lines (`SCRIPT_SIDE_GRANDFATHER`, SERVER-PARITY SS11) and each
   * deprecated path the file uses (FE7). */
  readonly warnings: readonly string[]
  /** FE7: the ids of the deprecated paths the file uses. */
  readonly deprecations: readonly string[]
}

/** The warning a validator gives for one used deprecation. */
function deprecationWarning(row: Readonly<Deprecation>): string {
  const mend =
    row.migration === undefined
      ? 'no migration: it is deleted once no kept file uses it'
      : `the chain mends it (${row.migration})`
  return `deprecated since ${row.since} (${row.id}): ${row.path}; use ${row.replacement}; ${mend}`
}

/** A validator's warnings with the file's deprecations added (FE7). */
function deprecationReport(
  shard: Readonly<DeprecationInput>,
  warnings: readonly string[],
): DeprecationReport {
  const used = deprecationsUsed(shard)
  return {
    warnings: [
      ...warnings,
      ...used.map((row: Readonly<Deprecation>): string =>
        deprecationWarning(row),
      ),
    ],
    deprecations: used.map((row: Readonly<Deprecation>): string => row.id),
  }
}

export {
  DEPRECATIONS,
  type DeprecationReport,
  deprecationReport,
  type Deprecation,
  type DeprecationInput,
  deprecationWarning,
  deprecationsUsed,
}
