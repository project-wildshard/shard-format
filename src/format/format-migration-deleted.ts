// oxlint-disable typescript/prefer-readonly-parameter-types -- a mend edits the shard it is handed, in place
/** FORMAT-PRUNE FP33 and FP44 (J486's delete at zero users): fields the shard schema no longer knows. Their own steps
 * drop or rename them on the way up, but a copy written below that step (a channel still on an older format, or a
 * made-up fixture carried to one) would keep them, and no reader could read it. So the chain mends every copy it
 * writes, whatever its target, into the one way that target already admits: `requires` with no `sdk` (optional in
 * every format), the old pointer as `shardfile` (FP8's rename, read since 0.1.0.1). A mend never writes the version. */
import { dropRequiresSdk } from './format-migration-envelope.ts'
import { OLD_POINTER, shardfilePointer } from './format-migration-prune.ts'

import type { MigratingShard } from './format-migrations.ts'

/** One deleted field: what finds it in a copy and what mends it. */
interface DeletedField {
  readonly id: string
  readonly carries: (shard: Readonly<MigratingShard>) => boolean
  readonly mend: (shard: MigratingShard) => void
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Whether any object under `value` holds `key`. */
function holds(value: unknown, key: string): boolean {
  if (Array.isArray(value)) {
    return value.some((item: unknown): boolean => holds(item, key))
  }
  return (
    isRecord(value) &&
    (Object.hasOwn(value, key) ||
      Object.values(value).some((item: unknown): boolean => holds(item, key)))
  )
}

const DELETED_FIELDS: readonly DeletedField[] = [
  {
    id: 'fp33-delete-requires-sdk',
    carries: (shard: Readonly<MigratingShard>): boolean => {
      const { requires } = shard.index
      return isRecord(requires) && Object.hasOwn(requires, 'sdk')
    },
    mend: dropRequiresSdk.apply,
  },
  {
    id: 'fp44-delete-grid-pointer',
    carries: (shard: Readonly<MigratingShard>): boolean =>
      [...shard.sections.values(), ...shard.mounts.values()].some(
        (value: unknown): boolean => holds(value, OLD_POINTER),
      ),
    mend: shardfilePointer.apply,
  },
]

/** The deleted fields `shard` still carries. */
function deletedFieldsIn(shard: Readonly<MigratingShard>): readonly string[] {
  return DELETED_FIELDS.filter((field: DeletedField): boolean =>
    field.carries(shard),
  ).map((field: DeletedField): string => field.id)
}

/** Mend each deleted field `shard` still carries; the ids of those it mended. */
function mendDeletedFields(shard: MigratingShard): readonly string[] {
  const mended: string[] = []
  for (const field of DELETED_FIELDS) {
    if (field.carries(shard)) {
      field.mend(shard)
      mended.push(field.id)
    }
  }
  return mended
}

const DELETED_FIELD_IDS: readonly string[] = DELETED_FIELDS.map(
  (field: DeletedField): string => field.id,
)

export { DELETED_FIELD_IDS, deletedFieldsIn, mendDeletedFields }
