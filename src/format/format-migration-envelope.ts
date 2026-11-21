// oxlint-disable typescript/prefer-readonly-parameter-types -- a step edits the shard it is handed, in place
/** Format 0.1.0.2's chain steps (SHARD-COMPAT CP14, FORMAT-PRUNE FP4 and FP25, J486). The runner writes the copy's
 * version into `formatVersion` from 0.1.0.2 on (`writeShardfileFormat`), replacing the frozen layout marker `2`; these
 * steps drop the fields the new envelope no longer carries. Every dropped field held nothing: `version` repeats the
 * format version, and the other four are always empty with no reader. */
import { LEGACY_LAYOUT, writesIndexFormatVersion } from './version.ts'

import type { FormatMigration, MigratingShard } from './format-migrations.ts'

type JsonRecord = Record<string, unknown>

const ENVELOPE = '0.1.0.2'

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** SHARD-COMPAT CP14 (FP25): `version` becomes `formatVersion`; the layout marker goes in the same step. */
const formatVersionField: FormatMigration = {
  id: 'cp14-format-version',
  to: ENVELOPE,
  touches: 'data',
  affects: [],
  apply: (shard: MigratingShard): void => {
    Reflect.deleteProperty(shard.index, 'version')
  },
}

/** FORMAT-PRUNE FP4: `schemas`, `runtime.files`, `runtime.lines` and `requires.capabilities`, always empty, never read. */
const dropEmptyIndexFields: FormatMigration = {
  id: 'fp4-drop-empty-index-fields',
  to: ENVELOPE,
  touches: 'data',
  affects: [],
  apply: (shard: MigratingShard): void => {
    const { index } = shard
    Reflect.deleteProperty(index, 'schemas')
    const { runtime, requires } = index
    if (isRecord(runtime)) {
      Reflect.deleteProperty(runtime, 'files')
      Reflect.deleteProperty(runtime, 'lines')
    }
    if (isRecord(requires)) {
      Reflect.deleteProperty(requires, 'capabilities')
    }
  },
}

/** The format version a `shard.json` declares, as written, or `undefined`: `formatVersion` from 0.1.0.2, else the
 * legacy `version` beside the layout marker. */
function declaredShardfileFormat(index: Readonly<JsonRecord>): unknown {
  const declared: unknown = index['formatVersion']
  return declared === LEGACY_LAYOUT || declared === undefined
    ? index['version']
    : declared
}

/** Write a copy's format version the way that version spells it: `formatVersion` from 0.1.0.2 (with no `version`),
 * else `version` beside the layout marker. */
function writeShardfileFormat(index: JsonRecord, version: string): void {
  if (writesIndexFormatVersion(version)) {
    Reflect.deleteProperty(index, 'version')
    index['formatVersion'] = version
  } else {
    index['version'] = version
  }
}

export {
  declaredShardfileFormat,
  dropEmptyIndexFields,
  formatVersionField,
  writeShardfileFormat,
}
