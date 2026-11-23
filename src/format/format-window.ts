/** SHARD-COMPAT CP2 (J486): a shard file outside the reader's window is refused with a typed error, before the
 * index schema runs, so a reader (the API's admission) can answer "above: retry once I update" apart from "below the
 * floor: migrate or re-upload" instead of an opaque schema error. */
import {
  SHARDFILE_FLOOR,
  SHARDFILE_VERSION,
  compareShardfileVersions,
  LEGACY_LAYOUT,
  parseShardfileVersion,
} from './version.ts'

const NONE = 0

/** The declared format sits above the reader (a newer file) or below its floor. */
class ShardfileFormatWindowError extends Error {
  public readonly declared: string
  public readonly reader: string
  public readonly floor: string
  public readonly above: boolean

  public constructor(declared: string, reader: string, above: boolean) {
    super(
      above
        ? `shard.json is format ${declared}, above this reader's ${reader}: it is read once the reader updates`
        : `shard.json is format ${declared}, below the floor ${SHARDFILE_FLOOR}: migrate it or upload it again`,
    )
    this.name = 'ShardfileFormatWindowError'
    this.declared = declared
    this.reader = reader
    this.floor = SHARDFILE_FLOOR
    this.above = above
  }
}

function field(index: unknown, name: string): unknown {
  return typeof index === 'object' && index !== null
    ? Reflect.get(index, name)
    : undefined
}

/** The declared format as written (`formatVersion`, or the legacy `version` beside the layout marker), or
 * `undefined` when it is no canonical version: the schema then says why. */
function declaredOf(index: unknown): string | undefined {
  const declared = field(index, 'formatVersion')
  const found = declared === LEGACY_LAYOUT ? field(index, 'version') : declared
  try {
    parseShardfileVersion(found)
  } catch {
    return undefined
  }
  return typeof found === 'string' ? found : undefined
}

/** Throw `ShardfileFormatWindowError` for an index whose declared format this reader cannot read. */
function assertFormatWindow(
  index: unknown,
  reader: string = SHARDFILE_VERSION,
): void {
  const declared = declaredOf(index)
  if (declared === undefined) {
    return
  }
  if (compareShardfileVersions(declared, reader) > NONE) {
    throw new ShardfileFormatWindowError(declared, reader, true)
  }
  if (compareShardfileVersions(declared, SHARDFILE_FLOOR) < NONE) {
    throw new ShardfileFormatWindowError(declared, reader, false)
  }
}

export { ShardfileFormatWindowError, assertFormatWindow }
