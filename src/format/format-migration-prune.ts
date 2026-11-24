// oxlint-disable typescript/prefer-readonly-parameter-types -- a step edits the shard it is handed, in place
/** FORMAT-PRUNE's same-version chain steps (J486): each writes the one way a 0.1.0.1 reader already admits, so writers
 * can stop writing the other way with no format bump. Both are repairs: they also run on 0.1.0.1 files that still carry
 * the old shape. Refusing the old shape in new uploads waits until the API and engine read migrated copies (CP2, FE9). */
import { RETIRED_SCHEMA_SOURCES, retiredSchemaSource } from './schema-source.ts'

import type { FormatMigration, MigratingShard } from './format-migrations.ts'

type JsonRecord = Record<string, unknown>

const OLD_POINTER = 'gridShardfile'
const POINTER = 'shardfile'
const CURRENT = '0.1.0.1'
const NONE = 0
/** FP10 runs at format 0.1.0.4, the format that first reads the current id. */
const SCHEMA_SOURCE_VERSION = '0.1.0.4'

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Each object under `value`, depth first. */
function objects(value: unknown, found: JsonRecord[]): JsonRecord[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      objects(item, found)
    }
  } else if (isRecord(value)) {
    found.push(value)
    for (const item of Object.values(value)) {
      objects(item, found)
    }
  }
  return found
}

/** Every object holding the old pointer, in each section and each JSON cook mount. */
function pointerObjects(
  shard: Readonly<MigratingShard>,
): readonly JsonRecord[] {
  const found: JsonRecord[] = []
  for (const value of [...shard.sections.values(), ...shard.mounts.values()]) {
    objects(value, found)
  }
  return found.filter((row: Readonly<JsonRecord>): boolean =>
    Object.hasOwn(row, OLD_POINTER),
  )
}

/** Rename the old pointer key in place, keeping its position; naming two different files is refused, as the engine's
 * lift refuses it (`legacyPointer.ts`). */
function renamePointer(row: JsonRecord): void {
  const { [OLD_POINTER]: old, [POINTER]: now } = row
  if (now !== undefined && old !== undefined && now !== old) {
    throw new Error('A manifest names its shardfile once')
  }
  const entries = Object.entries(row)
  for (const [key] of entries) {
    Reflect.deleteProperty(row, key)
  }
  for (const [key, value] of entries) {
    if (key !== OLD_POINTER) {
      row[key] = value
    } else if (now === undefined && old !== undefined) {
      row[POINTER] = value
    }
  }
}

/** FORMAT-PRUNE FP8: `gridShardfile` becomes `shardfile`, in the level manifest and the discovery mount alike. */
const shardfilePointer: FormatMigration = {
  id: 'fp8-shardfile-pointer',
  to: CURRENT,
  touches: 'data',
  affects: [],
  apply: (shard: MigratingShard): void => {
    for (const row of pointerObjects(shard)) {
      renamePointer(row)
    }
  },
  repairs: (shard: Readonly<MigratingShard>): boolean =>
    pointerObjects(shard).length > NONE,
}

function runtimeOf(shard: Readonly<MigratingShard>): JsonRecord | undefined {
  const { runtime } = shard.index
  return isRecord(runtime) ? runtime : undefined
}

function carriesTrust(shard: Readonly<MigratingShard>): boolean {
  const runtime = runtimeOf(shard)
  return runtime !== undefined && Object.hasOwn(runtime, 'trust')
}

/** FORMAT-PRUNE FP3: `runtime.trust` has no reader in any repo; the copy drops it. */
const dropRuntimeTrust: FormatMigration = {
  id: 'fp3-drop-runtime-trust',
  to: CURRENT,
  touches: 'data',
  affects: [],
  apply: (shard: MigratingShard): void => {
    const runtime = runtimeOf(shard)
    if (runtime !== undefined) {
      Reflect.deleteProperty(runtime, 'trust')
    }
  },
  repairs: carriesTrust,
}

/** Each named JSON file's schema block in the index that names a retired id. */
function staleSchemaBlocks(
  shard: Readonly<MigratingShard>,
): readonly JsonRecord[] {
  const { files } = shard.index
  if (!Array.isArray(files)) {
    return []
  }
  return files
    .map((file: unknown): unknown =>
      isRecord(file) ? file['jsonSchema'] : undefined,
    )
    .filter(
      (block: unknown): block is JsonRecord =>
        isRecord(block) && retiredSchemaSource(block['$comment']),
    )
}

/** FORMAT-PRUNE FP10: a named JSON file's `jsonSchema.$comment` names the current defining module, not a retired
 * one (`directorProduct` became `directorDocument`). Only the index changes; the file's bytes and hash stay. */
const schemaSource: FormatMigration = {
  id: 'fp10-schema-source',
  to: SCHEMA_SOURCE_VERSION,
  touches: 'data',
  affects: [],
  apply: (shard: MigratingShard): void => {
    for (const block of staleSchemaBlocks(shard)) {
      const { $comment: old } = block
      if (typeof old === 'string') {
        block['$comment'] = RETIRED_SCHEMA_SOURCES[old]
      }
    }
  },
  repairs: (shard: Readonly<MigratingShard>): boolean =>
    staleSchemaBlocks(shard).length > NONE,
}

export { OLD_POINTER, dropRuntimeTrust, schemaSource, shardfilePointer }
