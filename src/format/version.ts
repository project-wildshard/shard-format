/** Canonical format revision, separate from the npm package and script ABI (J319).
 * The fourth component adds fields; the third changes their meaning. */
const ZERO = 0
const ONE = 1

const SHARDFILE_VERSION = '0.1.0.2'
/** Formats whose `shard.json` names its version in `version`, beside the frozen layout marker `formatVersion: 2`.
 * Legacy 0.1 is the byte-preserving spelling of 0.1.0.0. */
const LEGACY_INDEX_VERSIONS: readonly ['0.1', '0.1.0.0', '0.1.0.1'] = [
  '0.1',
  '0.1.0.0',
  '0.1.0.1',
] as const
/** Formats whose `shard.json` names its version in `formatVersion` (SHARD-COMPAT CP14, FORMAT-PRUNE FP25): the
 * layout marker and `version` are gone, so a reader tells the two envelopes apart by the field's type. */
const INDEX_FORMAT_VERSIONS: readonly [typeof SHARDFILE_VERSION] = [
  SHARDFILE_VERSION,
] as const
const SHARDFILE_VERSIONS: readonly [
  ...typeof LEGACY_INDEX_VERSIONS,
  ...typeof INDEX_FORMAT_VERSIONS,
] = [...LEGACY_INDEX_VERSIONS, ...INDEX_FORMAT_VERSIONS] as const
type ShardfileVersion = (typeof SHARDFILE_VERSIONS)[number]
type LegacyIndexVersion = (typeof LEGACY_INDEX_VERSIONS)[number]
type IndexFormatVersion = (typeof INDEX_FORMAT_VERSIONS)[number]
/** The frozen layout marker the legacy envelope carries in `formatVersion`. */
const LEGACY_LAYOUT = 2
/** The first format that writes its version in `formatVersion`. */
const SHARDFILE_VERSION_INDEX_RENAME = '0.1.0.2'
type ShardfileVersionParts = readonly [number, number, number, number]

/** Read canonical bounded decimal components; the legacy two-part spelling has zero counters. */
function parseShardfileVersion(input: unknown): ShardfileVersionParts {
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

/** The oldest format a reader admits (J486). Below it a shard file needs the migration chain or a re-upload. */
const SHARDFILE_FLOOR = '0.1.0.0'

/** A reader admits every format at or below its own in the same breaking format, down to the floor (J486,
 * replacing WR11's N and N-1 window). Additive counters only add optional fields, so an older file is still a
 * valid file; a newer one can carry declarations the reader does not know, so it waits for a newer reader. */
function compatibleShardfileVersion(
  input: unknown,
  reader: unknown = SHARDFILE_VERSION,
): boolean {
  try {
    const [major, minor, breaking] = parseShardfileVersion(input)
    const [readMajor, readMinor, readBreaking] = parseShardfileVersion(reader)
    return (
      major === readMajor &&
      minor === readMinor &&
      breaking === readBreaking &&
      compareShardfileVersions(input, reader) <= ZERO &&
      compareShardfileVersions(input, SHARDFILE_FLOOR) >= ZERO
    )
  } catch {
    return false
  }
}

/** The format version a `shard.json` declares: `formatVersion` when it is a version string (0.1.0.2 on), else the
 * legacy `version` beside the layout marker `formatVersion: 2`. Throws when neither names a format. */
function shardfileFormatOf(index: unknown): ShardfileVersion {
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

/** SHARD-COMPAT CP14: writers build the legacy `shard.json` rows (`formatVersion: 2`, `version`, the always-empty lists)
 * and pass them here. At a `version` of 0.1.0.2 or later this returns the envelope that version writes: `formatVersion`
 * is the version, and `version`, `schemas`, `runtime.files`, `runtime.lines`, `runtime.trust` and
 * `requires.capabilities` go. An older `version` comes back unchanged. */
function outputIndexEnvelope(
  rows: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const { version } = rows
  if (typeof version !== 'string' || !writesIndexFormatVersion(version)) {
    return { ...rows }
  }
  const { version: _version, schemas: _schemas, ...rest } = rows
  return {
    ...rest,
    formatVersion: version,
    requires: withoutKeys(rest['requires'], ['capabilities']),
    runtime: withoutKeys(rest['runtime'], ['files', 'lines', 'trust']),
  }
}

export {
  outputIndexEnvelope,
  SHARDFILE_VERSION,
  SHARDFILE_VERSIONS,
  LEGACY_INDEX_VERSIONS,
  INDEX_FORMAT_VERSIONS,
  LEGACY_LAYOUT,
  type LegacyIndexVersion,
  type IndexFormatVersion,
  shardfileFormatOf,
  writesIndexFormatVersion,
  SHARDFILE_FLOOR,
  type ShardfileVersion,
  type ShardfileVersionParts,
  parseShardfileVersion,
  compareShardfileVersions,
  compatibleShardfileVersion,
}
