/** Canonical format revision, separate from the npm package and script ABI (J319).
 * The fourth component adds fields; the third changes their meaning. */
const ZERO = 0
const ONE = 1

const SHARDFILE_VERSION = '0.1.0.1'
/** Legacy 0.1 is the byte-preserving spelling of 0.1.0.0. */
const SHARDFILE_VERSIONS: readonly [
  '0.1',
  '0.1.0.0',
  typeof SHARDFILE_VERSION,
] = ['0.1', '0.1.0.0', SHARDFILE_VERSION] as const
type ShardfileVersion = (typeof SHARDFILE_VERSIONS)[number]
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

/** Legacy callers use this only to validate the era's decimal minor; new code compares all four components. */
function shardfileRevision(input: unknown): number {
  return parseShardfileVersion(input)[ONE]
}

export {
  SHARDFILE_VERSION,
  SHARDFILE_VERSIONS,
  SHARDFILE_FLOOR,
  type ShardfileVersion,
  type ShardfileVersionParts,
  parseShardfileVersion,
  compareShardfileVersions,
  compatibleShardfileVersion,
  shardfileRevision,
}
