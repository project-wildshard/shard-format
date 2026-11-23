import { validationSourceBytes } from './validationReceipt.ts'
import { writesSaveRevision } from './version.ts'

/** FORMAT-PRUNE FP26 (J493): from format 0.1.0.4 the save lineage `identity.revision` is spelled `identity.saveRevision`. */
const SAVE_REVISION = '0.1.0.4'

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A copy of `row` with its key `from` named `to`, every other key as it is. */
function renamedKey(
  row: Readonly<Record<string, unknown>>,
  from: string,
  to: string,
): Record<string, unknown> {
  const entries = Object.entries(row)
  const renamed = entries.map(
    ([key, item]: readonly [string, unknown]): readonly [string, unknown] => [
      key === from ? to : key,
      item,
    ],
  )
  return Object.fromEntries(renamed)
}

/** FP26: what a file's hashes cover keeps the identity as its format wrote it. Below 0.1.0.4 that is `revision`: the
 * source hash and the cook preparation's inputs were taken over those bytes, so an older file still matches its own.
 * `formatVersion` is the index's (`2` for the legacy envelope). */
function asWrittenIdentity(value: object, formatVersion: unknown): unknown {
  if (typeof formatVersion === 'string' && writesSaveRevision(formatVersion)) {
    return value
  }
  const identity: unknown = Reflect.get(value, 'identity')
  if (!isRecord(identity) || !Object.hasOwn(identity, 'saveRevision')) {
    return value
  }
  return {
    ...value,
    identity: renamedKey(identity, 'saveRevision', 'revision'),
  }
}

interface SaveRevisionSpellings<Revision> {
  readonly saveRevision?: Revision
  readonly revision?: Revision
}

/** FP26: a row gives exactly one spelling of the save lineage. */
function oneSaveRevisionSpelling<Revision>(
  row: Readonly<SaveRevisionSpellings<Revision>>,
): boolean {
  return (row.saveRevision === undefined) !== (row.revision === undefined)
}

/** FP26: the save lineage, under whichever spelling the row gave it. */
function saveRevisionOf<Revision>(
  row: Readonly<SaveRevisionSpellings<Revision>>,
): Revision {
  const value = row.saveRevision ?? row.revision
  if (value === undefined) {
    throw new Error(
      'The identity needs exactly one of saveRevision or revision',
    )
  }
  return value
}

/** The deprecation row for the old spelling (`deprecations.ts` lists it). */
interface SaveRevisionDeprecation {
  readonly id: string
  readonly path: string
  readonly since: string
  readonly replacement: string
  readonly migration: string
  readonly uses: (shard: Readonly<{ index: unknown }>) => boolean
}

/** FP26: the canonical bytes a source hash covers, the identity spelled as `formatVersion` wrote it. */
function writtenSourceBytes(value: object, formatVersion: unknown): Uint8Array {
  return validationSourceBytes(asWrittenIdentity(value, formatVersion))
}

const SAVE_REVISION_DEPRECATION: SaveRevisionDeprecation = {
  id: 'identity.revision',
  path: 'shard.json identity.revision, the save lineage (FORMAT-PRUNE FP26, J493)',
  since: SAVE_REVISION,
  replacement:
    'identity.saveRevision: the same number under its own name, so it is never read as the API shard revision',
  migration: 'fp26-save-revision',
  uses: (shard: Readonly<{ index: unknown }>): boolean => {
    const identity: unknown = isRecord(shard.index)
      ? shard.index['identity']
      : undefined
    return isRecord(identity) && identity['revision'] !== undefined
  },
}

export {
  SAVE_REVISION_DEPRECATION,
  asWrittenIdentity,
  oneSaveRevisionSpelling,
  saveRevisionOf,
  writtenSourceBytes,
}
