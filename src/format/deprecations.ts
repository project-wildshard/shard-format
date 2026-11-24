// oxlint-disable typescript/prefer-readonly-parameter-types -- the index is valibot output, only read
/** The deprecation counter (SHARD-COMPAT FE7, J486). A deprecated path still validates, with its version and replacement;
 * both validators warn on it and the corpus counts its kept users (`shard-format corpus`). A path with a migration is
 * mended by the chain; one without is deleted once no kept file uses it. */
import { COOK_DEPRECATIONS } from './cook-deprecations.ts'
import {
  LEVEL_DEPRECATIONS,
  MANIFEST_MOVED_DEPRECATIONS,
  MAP_IMAGE_DEPRECATION,
} from './manifest-deprecations.ts'
import { SAVE_REVISION_DEPRECATION } from './save-revision.ts'
import { SCHEMA_SOURCE_DEPRECATION } from './schema-source.ts'
import {
  SPECIES_FEATURE_DEPRECATIONS,
  SPECIES_SECTION_DEPRECATIONS,
} from './species-deprecations.ts'

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

/** What a deprecation test reads: the index, each section by name and, from the folder validator, `cook.json`. */
interface DeprecationInput {
  readonly index: Readonly<OutputIndex> | Readonly<Record<string, unknown>>
  readonly sections: ReadonlyMap<string, unknown>
  readonly cook?: unknown
}

interface DeprecationRule extends Deprecation {
  readonly uses: (shard: Readonly<DeprecationInput>) => boolean
}

const LEGACY_SPELLING = '0.1'
const NONE = 0
/** Deprecated in the current format with no data change: a shard file of any version may still carry it. */
const CURRENT = '0.1.0.1'
/** Format 0.1.0.2's envelope (SHARD-COMPAT CP14, FORMAT-PRUNE FP4 and FP25). */
const ENVELOPE = '0.1.0.2'
const LEGACY_LAYOUT = 2
/** Format 0.1.0.3: `preparation` replaces the `sdk` marker (SHARD-COMPAT PR4). */
const PREPARATION_MARKER = '0.1.0.3'
/** FORMAT-PRUNE FP4: always empty, never read. */
const EMPTY_INDEX_FIELDS: readonly (readonly [string, string | undefined])[] = [
  ['schemas', undefined],
  ['runtime', 'files'],
  ['runtime', 'lines'],
]

function field(value: unknown, key: string): unknown {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? Reflect.get(value, key)
    : undefined
}

/** Whether `key` names a field anywhere inside `value`. */
function hasKey(value: unknown, key: string): boolean {
  const pending: unknown[] = [value]
  while (pending.length > NONE) {
    const next = pending.pop()
    if (typeof next === 'object' && next !== null) {
      if (!Array.isArray(next) && Object.hasOwn(next, key)) {
        return true
      }
      const children: readonly unknown[] = Object.values(next)
      pending.push(...children)
    }
  }
  return false
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
    id: 'shard.version',
    path: 'shard.json version beside the layout marker formatVersion 2 (SHARD-COMPAT CP14)',
    since: ENVELOPE,
    replacement:
      'formatVersion: the four-part format version, with no version field',
    migration: 'cp14-format-version',
    uses: (shard: Readonly<DeprecationInput>): boolean =>
      field(shard.index, 'formatVersion') === LEGACY_LAYOUT,
  },
  {
    id: 'shard.empty-fields',
    path: 'shard.json schemas, runtime.files and runtime.lines (FORMAT-PRUNE FP4)',
    since: ENVELOPE,
    replacement: 'nothing: each is always empty and no reader reads it',
    migration: 'fp4-drop-empty-index-fields',
    uses: (shard: Readonly<DeprecationInput>): boolean =>
      EMPTY_INDEX_FIELDS.some(
        ([outer, inner]: readonly [string, string | undefined]): boolean =>
          inner === undefined
            ? field(shard.index, outer) !== undefined
            : field(field(shard.index, outer), inner) !== undefined,
      ),
  },
  {
    id: 'shard.sdk-marker',
    path: "shard.json sdk ('0.2' built, '0.3' prepared), the preparation marker (SHARD-COMPAT PR4, FORMAT-PRUNE FP5)",
    since: PREPARATION_MARKER,
    replacement:
      'preparation: the preparation spec version (cook.json version), absent on an unprepared file',
    migration: 'pr4-preparation-marker',
    uses: (shard: Readonly<DeprecationInput>): boolean =>
      field(shard.index, 'sdk') !== undefined,
  },
  SAVE_REVISION_DEPRECATION,
  SCHEMA_SOURCE_DEPRECATION,
  ...COOK_DEPRECATIONS,
  ...SPECIES_FEATURE_DEPRECATIONS,
  {
    id: 'requires.sdk',
    path: 'shard.json requires.sdk (SHARD-COMPAT CP8): a copy of the format version',
    since: ENVELOPE,
    replacement:
      'nothing: formatVersion names the format; format 0.1.0.5 refuses it and the chain drops it (FORMAT-PRUNE FP33)',
    migration: 'fp33-drop-requires-sdk',
    uses: (shard: Readonly<DeprecationInput>): boolean =>
      field(field(shard.index, 'requires'), 'sdk') !== undefined,
  },
  {
    id: 'requires.capabilities',
    path: 'shard.json requires.capabilities (FORMAT-PRUNE FP4): always empty, never read',
    since: ENVELOPE,
    replacement:
      'nothing: the chain drops it (optional since 0.1.0.4) and writers stop sourcing it',
    migration: 'fp4-drop-requires-capabilities',
    uses: (shard: Readonly<DeprecationInput>): boolean =>
      field(field(shard.index, 'requires'), 'capabilities') !== undefined,
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
  ...MANIFEST_MOVED_DEPRECATIONS,
  ...LEVEL_DEPRECATIONS,
  MAP_IMAGE_DEPRECATION,
  {
    id: 'runtime.trust',
    path: 'shard.json runtime.trust',
    since: '0.1.0.1',
    replacement: 'nothing: no reader reads it',
    migration: 'fp3-drop-runtime-trust',
    uses: (shard: Readonly<DeprecationInput>): boolean =>
      field(field(shard.index, 'runtime'), 'trust') !== undefined,
  },
  ...SPECIES_SECTION_DEPRECATIONS,
  {
    id: 'items.legacySlot',
    path: 'an item equipment row legacySlot: a closed list of engine-native weapon names (FORMAT-PRUNE FP17)',
    since: CURRENT,
    replacement:
      'none yet: it goes with engine native weapon slots, so a new item names no slot',
    migration: undefined,
    uses: (shard: Readonly<DeprecationInput>): boolean =>
      [...shard.sections.values()].some((section: unknown): boolean =>
        hasKey(section, 'legacySlot'),
      ),
  },
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

/** A `legacy*` field that maps an old save key or saved shape: it stays, undeprecated, until a save wipe (J149), so a
 * shard that keeps old players' saves working is not warned (FORMAT-PRUNE FP17). */
interface SaveBridge {
  readonly path: string
  /** The engine code that reads old saves through it. */
  readonly reader: string
}

/** FP17's sort of the `legacy*` fields. `items.legacySlot` is shard data only, so it is a deprecation above; the
 * species book's `piercing.legacy` goes with the species-program family (FP15); none can be migrated by data alone. */
const SAVE_BRIDGES: readonly SaveBridge[] = [
  {
    path: 'loadout bow.legacyItem',
    reader: 'engine client/game/loadout/held.ts',
  },
  {
    path: 'quest persistence legacyNamespace',
    reader: 'engine shared/game/quest/persistence.ts',
  },
  {
    path: 'quest story repair legacyObservation',
    reader: 'engine client/game/plugin/ui.ts',
  },
  {
    path: 'quest story persistence reward.legacy',
    reader: 'engine shared/game/quest/persistence.ts',
  },
  {
    path: 'elite feature legacy (versions, scripts, stun, upgrades)',
    reader: 'engine server/game/quest/eliteFeature.ts',
  },
  {
    path: 'spawn script legacy (spec, acc, rng, groups)',
    reader: 'engine server/game/population/spawnScript.ts',
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
  SAVE_BRIDGES,
  type SaveBridge,
  type DeprecationReport,
  deprecationReport,
  type Deprecation,
  type DeprecationInput,
  deprecationWarning,
  deprecationsUsed,
}
