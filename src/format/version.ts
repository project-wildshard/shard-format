import { LEGACY_PREPARATION_SPEC, PREPARED_SDK } from './preparation-spec.ts'

/** Canonical format version, separate from the npm package and script ABI (J319).
 * The fourth component adds fields; the third changes their meaning. */
const ZERO = 0
const ONE = 1

const SHARDFILE_VERSION = '0.1.0.6'
/** Formats whose `shard.json` names its version in `version`, beside the frozen layout marker `formatVersion: 2`.
 * FORMAT-PRUNE FP24 (J508) deleted the two-part `0.1` and `0.1.0.0`: no kept original declares either. */
const LEGACY_INDEX_VERSIONS: readonly ['0.1.0.1'] = ['0.1.0.1'] as const
/** Formats whose `shard.json` names its version in `formatVersion` (SHARD-COMPAT CP14, FORMAT-PRUNE FP25): the
 * layout marker and `version` are gone, so a reader tells the two envelopes apart by the field's type. */
const INDEX_FORMAT_VERSIONS: readonly [
  '0.1.0.2',
  '0.1.0.3',
  '0.1.0.4',
  '0.1.0.5',
  typeof SHARDFILE_VERSION,
] = ['0.1.0.2', '0.1.0.3', '0.1.0.4', '0.1.0.5', SHARDFILE_VERSION] as const
const SHARDFILE_VERSIONS: readonly [
  ...typeof LEGACY_INDEX_VERSIONS,
  ...typeof INDEX_FORMAT_VERSIONS,
] = [...LEGACY_INDEX_VERSIONS, ...INDEX_FORMAT_VERSIONS] as const
/** A format version (J319): the four-part number naming a shard file's shape (SHARD-COMPAT §2's word). */
type FormatVersion = (typeof SHARDFILE_VERSIONS)[number]
/** @deprecated SHARD-COMPAT SP10: the retired word; use `FormatVersion`. Kept until no consumer imports it (ST19). */
type ShardfileVersion = FormatVersion
type LegacyIndexVersion = (typeof LEGACY_INDEX_VERSIONS)[number]
type IndexFormatVersion = (typeof INDEX_FORMAT_VERSIONS)[number]
/** The frozen layout marker the legacy envelope carries in `formatVersion`. */
const LEGACY_LAYOUT = 2
/** The first format that writes its version in `formatVersion`. */
const SHARDFILE_VERSION_INDEX_RENAME = '0.1.0.2'
/** The first format whose `shard.json` records the preparation spec version in `preparation` instead of the `sdk`
 * marker (SHARD-COMPAT PR4, J487; FORMAT-PRUNE FP5 folded in). */
const SHARDFILE_VERSION_PREPARATION = '0.1.0.3'
/** The first format whose `shard.json` names the save lineage `identity.saveRevision` instead of `identity.revision`
 * (FORMAT-PRUNE FP26, J493): the number keys saves and only ever rises; it is not the API's shard revision. */
const SHARDFILE_VERSION_SAVE_REVISION = '0.1.0.4'
/** The first format whose `shard.json` may name the lowest engine release that draws it, `requires.engine` (FORMAT-PRUNE
 * FP47b, J505): an engine on an older format refuses the word, so the floor holds there too. */
const SHARDFILE_VERSION_ENGINE_FLOOR = '0.1.0.6'
/** A format version's four parts. */
type FormatVersionParts = readonly [number, number, number, number]
/** @deprecated SHARD-COMPAT SP10: use `FormatVersionParts`. */
type ShardfileVersionParts = FormatVersionParts

/** Read canonical bounded decimal components. No shard file declares the two-part spelling any more (FORMAT-PRUNE
 * FP24); it parses with zero counters only because the API's ledger keys a zero-counter format that way
 * (`originalFormat`), until its stored rows move (SHARD-COMPAT CP16). */
function parseShardfileVersion(input: unknown): FormatVersionParts {
  if (
    typeof input !== 'string' ||
    !/^(?:0|[1-9][0-9]{0,3})(?:\.(?:0|[1-9][0-9]{0,3}))(?:\.(?:0|[1-9][0-9]{0,3})\.(?:0|[1-9][0-9]{0,3}))?$/u.test(
      input,
    )
  ) {
    throw new Error('Shardfile needs a canonical format version X.Y or X.Y.B.A')
  }
  const [major = ZERO, minor = ZERO, breaking = ZERO, additive = ZERO] = input
    .split('.')
    .map(Number)
  return [major, minor, breaking, additive]
}

/** Compare every format component numerically, including the additive counter. */
function compareShardfileVersions(left: unknown, right: unknown): number {
  const leftParts = parseShardfileVersion(left),
    rightParts = parseShardfileVersion(right)
  for (let index = 0; index < leftParts.length; index += ONE) {
    const difference = (leftParts[index] ?? ZERO) - (rightParts[index] ?? ZERO)
    if (difference !== ZERO) {
      return Math.sign(difference)
    }
  }
  return ZERO
}

/** The oldest format a reader admits (J486). Below it a shard file needs a re-upload. */
const SHARDFILE_FLOOR = '0.1.0.1'

/** Whether a reader at `reader` reads `input`: a known format from the floor up to the reader's own (J486). FORMAT-PRUNE
 * FP24 deleted WR11's N-1 test (`compatibleShardfileVersion`): every known format shares one breaking format, so the
 * window is the known list cut at the reader. */
function readsFormat(input: unknown, reader: string = SHARDFILE_VERSION): boolean {
  return (
    SHARDFILE_VERSIONS.some((version: string): boolean => version === input) &&
    compareShardfileVersions(input, reader) <= ZERO
  )
}

/** The format version a `shard.json` declares: `formatVersion` when it is a version string (0.1.0.2 on), else the
 * legacy `version` beside the layout marker `formatVersion: 2`. Throws when neither names a format. */
function shardfileFormatOf(index: unknown): FormatVersion {
  const declared: unknown =
    typeof index === 'object' && index !== null
      ? Reflect.get(index, 'formatVersion')
      : undefined
  const legacy: unknown =
    typeof index === 'object' && index !== null
      ? Reflect.get(index, 'version')
      : undefined
  const found: unknown = declared === LEGACY_LAYOUT ? legacy : declared
  const known = SHARDFILE_VERSIONS.find(
    (version: string): boolean => version === found,
  )
  if (known === undefined) {
    throw new Error('Shardfile index names no known format version')
  }
  return known
}

/** Whether a format version writes the 0.1.0.2 envelope (`formatVersion` as the version, no `version`). */
function writesIndexFormatVersion(version: string): boolean {
  return (
    compareShardfileVersions(version, SHARDFILE_VERSION_INDEX_RENAME) >= ZERO
  )
}

/** Whether a format version records `preparation` in place of the `sdk` marker (0.1.0.3 on, PR4). */
function writesPreparationMarker(version: string): boolean {
  return (
    compareShardfileVersions(version, SHARDFILE_VERSION_PREPARATION) >= ZERO
  )
}

/** Whether a format version names the save lineage `identity.saveRevision` (0.1.0.4 on, FP26). */
function writesSaveRevision(version: string): boolean {
  return (
    compareShardfileVersions(version, SHARDFILE_VERSION_SAVE_REVISION) >= ZERO
  )
}

/** Whether a format version may carry `requires.engine` (0.1.0.6 on, FP47b). */
function carriesEngineFloor(version: string): boolean {
  return (
    compareShardfileVersions(version, SHARDFILE_VERSION_ENGINE_FLOOR) >= ZERO
  )
}

/** FP26: a copy of an identity row with `revision` spelled `saveRevision`; anything else as it is. */
function withSaveRevision(identity: unknown): unknown {
  if (
    typeof identity !== 'object' ||
    identity === null ||
    Array.isArray(identity) ||
    !Object.hasOwn(identity, 'revision')
  ) {
    return identity
  }
  const renamed = Object.entries(identity).map(
    ([key, item]: readonly [string, unknown]): readonly [string, unknown] => [
      key === 'revision' ? 'saveRevision' : key,
      item,
    ],
  )
  return Object.fromEntries(renamed)
}

/** A copy of a JSON object without `keys`; anything else as it is. */
function withoutKeys(value: unknown, keys: readonly string[]): unknown {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return value
  }
  return Object.fromEntries(
    Object.entries(value).filter(
      ([key]: readonly [string, unknown]): boolean => !keys.includes(key),
    ),
  )
}

/** `requires` as `version` writes it: never an `sdk` (FORMAT-PRUNE FP33 deleted it), no `engine` floor below 0.1.0.6
 * (FP47b). */
function requiresAt(requires: unknown, version: string): unknown {
  return withoutKeys(requires, [
    'sdk',
    ...(carriesEngineFloor(version) ? [] : ['engine']),
  ])
}

/** The rows a version from 0.1.0.3 on changes in place: PR4's preparation marker, FP26's save lineage, then `requires`
 * (FP33's deleted `sdk`, FP47b's engine floor). */
function laterEnvelopeRows(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- it changes the writer's envelope in place
  envelope: Record<string, unknown>,
  version: string,
): void {
  // SHARD-COMPAT PR4: from 0.1.0.3 the `sdk` marker goes; a prepared writer's `'0.3'` becomes the spec version it
  // meant, unless the writer already names one in `preparation`.
  if (writesPreparationMarker(version)) {
    const { sdk } = envelope
    Reflect.deleteProperty(envelope, 'sdk')
    if (sdk === PREPARED_SDK && envelope['preparation'] === undefined) {
      envelope['preparation'] = LEGACY_PREPARATION_SPEC
    }
  }
  // FORMAT-PRUNE FP26: from 0.1.0.4 the save lineage is `identity.saveRevision`.
  if (writesSaveRevision(version)) {
    envelope['identity'] = withSaveRevision(envelope['identity'])
  }
  envelope['requires'] = requiresAt(envelope['requires'], version)
}

/** The rows `outputIndexEnvelope` returns: the writer's own rows, typed so it keeps reading them, with `version` and
 * `schemas` possibly gone and `formatVersion` possibly the version string. */
type IndexEnvelope<Rows> = Omit<
  Rows,
  'formatVersion' | 'schemas' | 'version' | 'sdk'
> &
  Readonly<{
    formatVersion: unknown
    version?: unknown
    schemas?: unknown
    sdk?: unknown
    preparation?: unknown
  }>

/** SHARD-COMPAT CP14: writers build the legacy `shard.json` rows (`formatVersion: 2`, `version`, the always-empty lists)
 * and pass them here. At a `version` of 0.1.0.2 or later this returns the envelope that version writes: `formatVersion`
 * is the version, and `version`, `schemas`, `runtime.files`, `runtime.lines` and `runtime.trust` go. An older
 * `version` comes back unchanged. */
function outputIndexEnvelope<Rows extends Readonly<Record<string, unknown>>>(
  rows: Rows,
): IndexEnvelope<Rows> {
  const { version } = rows
  const { version: _version, schemas: _schemas, ...rest } = rows
  const envelope: Record<string, unknown> =
    typeof version !== 'string' || !writesIndexFormatVersion(version)
      ? { ...rows }
      : {
          ...rest,
          formatVersion: version,
          runtime: withoutKeys(rest['runtime'], ['files', 'lines', 'trust']),
        }
  if (typeof version === 'string') {
    laterEnvelopeRows(envelope, version)
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- the writer's own rows; only envelope fields change
  return envelope as IndexEnvelope<Rows>
}

export {
  outputIndexEnvelope,
  type IndexEnvelope,
  SHARDFILE_VERSION,
  SHARDFILE_VERSIONS,
  LEGACY_INDEX_VERSIONS,
  INDEX_FORMAT_VERSIONS,
  LEGACY_LAYOUT,
  type LegacyIndexVersion,
  type IndexFormatVersion,
  shardfileFormatOf,
  writesIndexFormatVersion,
  writesPreparationMarker,
  writesSaveRevision,
  carriesEngineFloor,
  SHARDFILE_VERSION_ENGINE_FLOOR,
  SHARDFILE_VERSION_PREPARATION,
  SHARDFILE_VERSION_SAVE_REVISION,
  SHARDFILE_FLOOR,
  type FormatVersion,
  type FormatVersionParts,
  // oxlint-disable-next-line typescript/no-deprecated -- SP10: the old name stays exported as an alias until no consumer imports it (ST19).
  type ShardfileVersion,
  // oxlint-disable-next-line typescript/no-deprecated -- SP10: as above.
  type ShardfileVersionParts,
  parseShardfileVersion,
  compareShardfileVersions,
  readsFormat,
}
