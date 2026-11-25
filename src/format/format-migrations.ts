import { DELETED_FIELD_IDS } from './format-migration-deleted.ts'
// oxlint-disable typescript/prefer-readonly-parameter-types -- a step edits the shard it is handed, in place
/** The migration chain's registry (SHARD-COMPAT CP1, J486). A migration is one pure, data-only step that rewrites an
 * older shard file's JSON to a newer format version. It is not a save migration (`migrations.ts`) and not a catalogue
 * schema change (api-server). The change's author adds its migration here in the same release (J486, Q49). */
import {
  dropEmptyIndexFields,
  dropRequiresCapabilities,
  dropRequiresSdk,
  formatVersionField,
  preparationMarker,
  saveRevisionName,
} from './format-migration-envelope.ts'
import { homesToMembers } from './format-migration-homes.ts'
import { journalGlyphImages } from './format-migration-journal.ts'
import {
  discoveryMovedWords,
  levelLook,
  manifestMovedWords,
} from './format-migration-manifest.ts'
import {
  dropRuntimeTrust,
  schemaSource,
  shardfilePointer,
} from './format-migration-prune.ts'
import { validationSourceBytes } from './validationReceipt.ts'
import {
  SHARDFILE_FLOOR,
  SHARDFILE_VERSIONS,
  compareShardfileVersions,
  parseShardfileVersion,
} from './version.ts'

/** What a migration may read and rewrite: the parsed `shard.json`, each section by name and each JSON cook mount under
 * `mounts/` by path. */
interface MigratingShard {
  readonly index: Record<string, unknown>
  readonly sections: Map<string, unknown>
  readonly mounts: Map<string, unknown>
}

/** One step of the chain. `to` is the format version the step writes; it runs on every file below it. A repair step
 * (`repairs`) also runs on a file already at `to` when `repairs` finds the old shape there: a break that shipped
 * inside `to`, or a second way `to` still admits. */
interface FormatMigration {
  readonly id: string
  readonly to: string
  /** `data` edits JSON the preparation does not fence; `files` reaches what it does (named JSON blobs, programs), so
   * like `affects: render` the copy's author preparation is stale and the box's cook prepares again (SP1b). */
  readonly touches: 'data' | 'files'
  /** `render` leaves the author preparation stale for the box's cook (SP1b); `save` needs a save migration (J197). */
  readonly affects: readonly ('render' | 'save')[]
  /** The save migration a step that `affects: save` ships with (J197): what players' saved state does across it. */
  readonly saveMigration?: string
  readonly apply: (shard: MigratingShard) => void
  readonly repairs?: (shard: Readonly<MigratingShard>) => boolean
}

const ZERO = 0
const ONE = 1

/** Every migration, oldest first. FORMAT-PRUNE FP24 deleted FP6's `fp6-four-part-version` (`0.1` to `0.1.0.0`) with
 * the two-part spelling: the chain starts at the floor. */
const FORMAT_MIGRATIONS: readonly FormatMigration[] = [
  journalGlyphImages,
  shardfilePointer,
  dropRuntimeTrust,
  formatVersionField,
  dropEmptyIndexFields,
  preparationMarker,
  saveRevisionName,
  schemaSource,
  dropRequiresCapabilities,
  dropRequiresSdk,
  homesToMembers,
  manifestMovedWords,
  discoveryMovedWords,
  levelLook,
]

/** Whether a file at `version` still needs a step that writes `to`. */
function versionBelow(version: string, to: string): boolean {
  const left = parseShardfileVersion(version)
  const right = parseShardfileVersion(to)
  for (let index = ZERO; index < left.length; index += ONE) {
    const difference = (left[index] ?? ZERO) - (right[index] ?? ZERO)
    if (difference !== ZERO) {
      return difference < ZERO
    }
  }
  return false
}

/** Refuse one step: a `to` that is no format version, out of version order after `last`, or a save-affecting step with
 * no save migration. */
function checkStep(step: Readonly<FormatMigration>, last: string): void {
  if (
    !SHARDFILE_VERSIONS.some((version: string): boolean => version === step.to)
  ) {
    throw new Error(`Migration ${step.id} writes ${step.to}, no format version`)
  }
  if (compareShardfileVersions(step.to, last) < ZERO) {
    throw new Error(`Migration ${step.id} is out of version order`)
  }
  if (step.affects.includes('save') && step.saveMigration === undefined) {
    throw new Error(
      `Migration ${step.id} affects saves without a save migration`,
    )
  }
}

/** Refuse a registry the chain cannot run as written (FE8): a repeated id, or a step `checkStep` refuses. */
function checkMigrations(migrations: readonly FormatMigration[]): void {
  const ids = new Set<string>()
  let last: string = SHARDFILE_FLOOR
  for (const step of migrations) {
    if (ids.has(step.id)) {
      throw new Error(`Migration ${step.id} is registered twice`)
    }
    ids.add(step.id)
    checkStep(step, last)
    last = step.to
  }
}

/** The runner's own version: a change in how it runs the steps changes every chain id. */
const RUNNER = 1

/** Hash over every registered step, the deleted fields the runner mends and the runner (`migrated_shardfiles.chain_id`). */
function chainIdOf(
  migrations: readonly FormatMigration[],
  hash: (bytes: Uint8Array) => string,
): string {
  const steps = migrations.map(
    (step: Readonly<FormatMigration>): Record<string, unknown> => ({
      id: step.id,
      to: step.to,
      touches: step.touches,
      affects: [...step.affects],
    }),
  )
  return hash(
    validationSourceBytes({
      runner: RUNNER,
      migrations: steps,
      deleted: DELETED_FIELD_IDS,
    }),
  )
}

export {
  FORMAT_MIGRATIONS,
  chainIdOf,
  checkMigrations,
  type FormatMigration,
  type MigratingShard,
  versionBelow,
}
export {
  deletedFieldsIn,
  mendDeletedFields,
} from './format-migration-deleted.ts'
