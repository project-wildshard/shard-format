// oxlint-disable typescript/prefer-readonly-parameter-types -- a step edits the shard it is handed, in place
/** Format 0.1.0.2's chain steps (SHARD-COMPAT CP14, FORMAT-PRUNE FP4 and FP25, J486). The runner writes the copy's
 * version into `formatVersion` from 0.1.0.2 on (`writeShardfileFormat`), replacing the frozen layout marker `2`; these
 * steps drop the fields the new envelope no longer carries. Every dropped field held nothing: `version` repeats the
 * format version, and the other four are always empty with no reader. */
import { LEGACY_PREPARATION_SPEC, PREPARED_SDK } from './preparation-spec.ts'
import { LEGACY_LAYOUT, writesIndexFormatVersion } from './version.ts'

import type { FormatMigration, MigratingShard } from './format-migrations.ts'

type JsonRecord = Record<string, unknown>

const ENVELOPE = '0.1.0.2'
const PREPARATION_MARKER = '0.1.0.3'
const SAVE_REVISION = '0.1.0.4'

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

/** FORMAT-PRUNE FP4: `schemas`, `runtime.files` and `runtime.lines`, always empty, never read. `requires.capabilities` stays:
 * it is part of the assembled source the build's source hash covers, so it goes only with the writers that stop sourcing it. */
const dropEmptyIndexFields: FormatMigration = {
  id: 'fp4-drop-empty-index-fields',
  to: ENVELOPE,
  touches: 'data',
  affects: [],
  apply: (shard: MigratingShard): void => {
    const { index } = shard
    Reflect.deleteProperty(index, 'schemas')
    const { runtime } = index
    if (isRecord(runtime)) {
      Reflect.deleteProperty(runtime, 'files')
      Reflect.deleteProperty(runtime, 'lines')
    }
  },
}

/** SHARD-COMPAT PR4 (J487, FORMAT-PRUNE FP5 folded in): the `sdk` marker becomes `preparation`, the spec version the
 * file was prepared to. `'0.3'` (prepared) is spec 3, the only spec that marker ever meant; `'0.2'` (built, not
 * prepared) leaves no field. Data only: the copy's `cook.json` stays spec 3 and its input hash is re-sealed over the
 * new index. */
const preparationMarker: FormatMigration = {
  id: 'pr4-preparation-marker',
  to: PREPARATION_MARKER,
  touches: 'data',
  affects: [],
  apply: (shard: MigratingShard): void => {
    const { index } = shard
    if (index['sdk'] === PREPARED_SDK) {
      index['preparation'] = LEGACY_PREPARATION_SPEC
    }
    Reflect.deleteProperty(index, 'sdk')
  },
}

/** FORMAT-PRUNE FP26 (J493): the save lineage `identity.revision` is spelled `identity.saveRevision`. Data only: the
 * number is kept, so every save keyed by it still matches. */
const saveRevisionName: FormatMigration = {
  id: 'fp26-save-revision',
  to: SAVE_REVISION,
  touches: 'data',
  affects: [],
  apply: (shard: MigratingShard): void => {
    const { identity } = shard.index
    if (!isRecord(identity) || !Object.hasOwn(identity, 'revision')) {
      return
    }
    identity['saveRevision'] = identity['revision']
    Reflect.deleteProperty(identity, 'revision')
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
  preparationMarker,
  saveRevisionName,
  writeShardfileFormat,
}
