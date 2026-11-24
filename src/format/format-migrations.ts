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
  dropRuntimeTrust,
  schemaSource,
  shardfilePointer,
} from './format-migration-prune.ts'
import {
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

const TWO_PART = 2
const ZERO = 0
const ONE = 1
const LEGACY_SPELLING = '0.1'
const FOUR_PART_ZERO = '0.1.0.0'

/** FORMAT-PRUNE FP6: the two-part spelling `0.1` becomes `0.1.0.0`, the same format written the one way. */
const fourPartVersion: FormatMigration = {
  id: 'fp6-four-part-version',
  to: FOUR_PART_ZERO,
  touches: 'data',
  affects: [],
  apply: (shard: Readonly<MigratingShard>): void => {
    const { requires } = shard.index
    if (
      typeof requires === 'object' &&
      requires !== null &&
      Reflect.get(requires, 'sdk') === LEGACY_SPELLING
    ) {
      Reflect.set(requires, 'sdk', FOUR_PART_ZERO)
    }
  },
}

/** Every migration, oldest first. */
const FORMAT_MIGRATIONS: readonly FormatMigration[] = [
  fourPartVersion,
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
]

/** Whether a file at `version` still needs a step that writes `to`. The legacy two-part spelling sits just below its
 * four-part twin, so the spelling step runs once and never again. */
function versionBelow(version: string, to: string): boolean {
  const left = parseShardfileVersion(version)
  const right = parseShardfileVersion(to)
  for (let index = ZERO; index < left.length; index += ONE) {
    const difference = (left[index] ?? ZERO) - (right[index] ?? ZERO)
    if (difference !== ZERO) {
      return difference < ZERO
    }
  }
  return (
    version.split('.').length === TWO_PART && to.split('.').length > TWO_PART
  )
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
  let last: string = LEGACY_SPELLING
  for (const step of migrations) {
    if (ids.has(step.id)) {
      throw new Error(`Migration ${step.id} is registered twice`)
    }
    ids.add(step.id)
    checkStep(step, last)
    last = step.to
  }
}

export {
  FORMAT_MIGRATIONS,
  checkMigrations,
  type FormatMigration,
  type MigratingShard,
  versionBelow,
}
