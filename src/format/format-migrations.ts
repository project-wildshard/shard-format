// oxlint-disable typescript/prefer-readonly-parameter-types -- a step edits the shard it is handed, in place
/** The migration chain's registry (SHARD-COMPAT CP1, J486). A migration is one pure, data-only step that rewrites an
 * older shard file's JSON to a newer format version. It is not a save migration (`migrations.ts`) and not a catalogue
 * schema change (api-server). The change's author adds its migration here in the same release (J486, Q49). */
import { journalGlyphImages } from './format-migration-journal.ts'
import { parseShardfileVersion } from './version.ts'

/** What a migration may read and rewrite: the parsed `shard.json` and each section by name. */
interface MigratingShard {
  readonly index: Record<string, unknown>
  readonly sections: Map<string, unknown>
}

/** One step of the chain. `to` is the format version the step writes; it runs on every file below it. A repair step
 * (`repairs`) mends a break that shipped inside its `to` version without a bump: it also runs on a file already at `to`
 * when `repairs` finds the old shape there. */
interface FormatMigration {
  readonly id: string
  readonly to: string
  /** CP1 runs data-only steps; one that touches files waits for FE8's cook routing. */
  readonly touches: 'data'
  /** `render` leaves the author preparation stale for the box's cook (SP1b); `save` needs a save migration (J197). */
  readonly affects: readonly ('render' | 'save')[]
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

export {
  FORMAT_MIGRATIONS,
  type FormatMigration,
  type MigratingShard,
  versionBelow,
}
