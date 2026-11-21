// oxlint-disable typescript/prefer-readonly-parameter-types -- a migrated copy's file map is built in place
/** The migration chain's runner (SHARD-COMPAT CP1, J486): `migrateShardfile` turns an original shard file into its
 * migrated copy at a reader's format version. It verifies the original first (every listed byte and the author
 * preparation), runs each registered step the file is below, then rebuilds the inventory (`format-migrate-rebuild.ts`).
 * It is deterministic (canonical JSON, no clock, network or randomness), always starts from the original, and twice
 * equals once. */
import { readCookData } from './cook-data.ts'
import { requireCookPreparation } from './cook-preparation.ts'
import {
  INDEX,
  RECEIPT,
  listed,
  readJson,
  readSections,
  record,
  verifyInventory,
} from './format-migrate-inventory.ts'
import { rebuildInventory } from './format-migrate-rebuild.ts'
import { FORMAT_MIGRATIONS, versionBelow } from './format-migrations.ts'
import { validateShardfileFolder } from './shardfileValidation.ts'
import { validationSourceBytes } from './validationReceipt.ts'
import {
  SHARDFILE_FLOOR,
  SHARDFILE_VERSION,
  compareShardfileVersions,
} from './version.ts'

import type { CookData } from './cook-data.ts'
import type { Files, Hash, JsonRecord } from './format-migrate-inventory.ts'
import type { FormatMigration, MigratingShard } from './format-migrations.ts'
import type { OutputIndex } from './outputIndex.ts'
import type {
  ShardfileValidationPorts,
  ValidatedShardfile,
} from './shardfileValidation.ts'

interface MigrateOptions {
  /** Lowercase hex SHA-256 of exact bytes. */
  readonly hash: Hash
  /** The reader's format version; the current one by default. */
  readonly to?: string
  /** The steps to run; the registry by default (tests inject their own). */
  readonly migrations?: readonly FormatMigration[]
}

interface MigratedShardfile {
  /** The migrated copy: the original's own map when nothing ran. */
  readonly files: Files
  /** The original's format version, as spelled. */
  readonly from: string
  /** The copy's format version. */
  readonly to: string
  /** Migration ids, in the order they ran. */
  readonly applied: readonly string[]
  /** Hash over every registered step and the runner (`migrated_shardfiles.chain_id`). */
  readonly chainId: string
  /** The copy's `shard.json` hash, which names every byte it inventories. */
  readonly digest: string
  /** `author` re-sealed or untouched, `stale` after a render step (the box's cook re-prepares), `none` unprepared. */
  readonly preparation: 'author' | 'none' | 'stale'
}

/** An original that passed its own inventory and preparation. */
interface Admitted {
  readonly index: JsonRecord
  readonly cook: CookData | undefined
  readonly from: string
}

const RUNNER = 1
const PREPARED = 3
const NONE = 0

function chainId(migrations: readonly FormatMigration[], hash: Hash): string {
  const steps = migrations.map(
    (step: Readonly<FormatMigration>): JsonRecord => ({
      id: step.id,
      to: step.to,
      touches: step.touches,
      affects: [...step.affects],
    }),
  )
  return hash(validationSourceBytes({ runner: RUNNER, migrations: steps }))
}

/** Refuse a format above the reader or below the floor. */
function checkWindow(from: unknown, to: string): string {
  if (typeof from !== 'string') {
    throw new TypeError('Original needs a format version')
  }
  if (compareShardfileVersions(from, to) > NONE) {
    throw new Error(`Format ${from} is newer than the reader's ${to}`)
  }
  if (compareShardfileVersions(from, SHARDFILE_FLOOR) < NONE) {
    throw new Error(`Format ${from} is below the floor ${SHARDFILE_FLOOR}`)
  }
  return from
}

/** Verify the original's bytes, preparation and format window before any step runs. */
function admitOriginal(files: Files, hash: Hash, to: string): Admitted {
  const index = record(readJson(files, INDEX), INDEX)
  const cookPath =
    index['cook'] === undefined
      ? undefined
      : listed(record(index['cook'], 'cook')).path
  const rawCook =
    cookPath === undefined
      ? undefined
      : record(readJson(files, cookPath), 'cook.json')
  verifyInventory(files, { index, cook: rawCook }, hash)
  const cook = rawCook === undefined ? undefined : readCookData(rawCook)
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- read only for its slug, sdk, files and cook row
  requireCookPreparation(index as unknown as OutputIndex, cook, hash)
  return { index, cook, from: checkWindow(index['version'], to) }
}

function rendersAgain(steps: readonly FormatMigration[]): boolean {
  return steps.some((step: Readonly<FormatMigration>): boolean =>
    step.affects.includes('render'),
  )
}

/** Run each step in order; the chain, not a step, writes the format version. */
function runSteps(
  shard: MigratingShard,
  steps: readonly FormatMigration[],
): void {
  for (const step of steps) {
    step.apply(shard)
    shard.index['version'] = step.to
  }
}

/** Whether a step runs: the file is below it, or sits at it with the shape a repair step mends; never above the reader. */
function runs(
  step: Readonly<FormatMigration>,
  shard: Readonly<MigratingShard>,
  window: Readonly<{ from: string; to: string }>,
): boolean {
  if (compareShardfileVersions(step.to, window.to) > NONE) {
    return false
  }
  if (versionBelow(window.from, step.to)) {
    return true
  }
  return (
    compareShardfileVersions(window.from, step.to) === NONE &&
    step.repairs?.(shard) === true
  )
}

/** Run the steps, then rebuild the inventory around what they changed. */
function writeCopy(
  files: Files,
  shard: MigratingShard,
  plan: Readonly<{
    cook: CookData | undefined
    steps: readonly FormatMigration[]
    hash: Hash
  }>,
): Map<string, Uint8Array> {
  const { index } = shard
  const { cook } = plan
  runSteps(shard, plan.steps)
  // The build's validation receipt names the old source hash; a copy drops it.
  const out = new Map(
    [...files].filter(
      ([path]: readonly [string, Uint8Array]): boolean => path !== RECEIPT,
    ),
  )
  const copy = { index, out, hash: plan.hash }
  rebuildInventory(
    copy,
    shard,
    cook?.version === PREPARED && !rendersAgain(plan.steps) ? cook : undefined,
  )
  copy.out.set(INDEX, validationSourceBytes(index))
  return copy.out
}

function preparationOf(
  cook: Readonly<CookData> | undefined,
  steps: readonly FormatMigration[],
): MigratedShardfile['preparation'] {
  if (cook?.version !== PREPARED) {
    return 'none'
  }
  return rendersAgain(steps) ? 'stale' : 'author'
}

/** Run the chain from an original to `to`. Throws, naming the path, when the original fails its own inventory or
 * preparation, sits above the reader or below the floor, or a step leaves a file the reader cannot assemble. */
function migrateShardfile(
  files: Files,
  options: Readonly<MigrateOptions>,
): MigratedShardfile {
  const to = options.to ?? SHARDFILE_VERSION
  const migrations = options.migrations ?? FORMAT_MIGRATIONS
  const admitted = admitOriginal(files, options.hash, to)
  const shard = {
    index: admitted.index,
    sections: readSections(files, admitted.index),
  }
  const window = { from: admitted.from, to }
  const steps = migrations.filter((step: Readonly<FormatMigration>): boolean =>
    runs(step, shard, window),
  )
  const copy =
    steps.length === NONE
      ? files
      : writeCopy(files, shard, {
          cook: admitted.cook,
          steps,
          hash: options.hash,
        })
  return {
    files: copy,
    from: admitted.from,
    to: String(admitted.index['version']),
    applied: steps.map((step: Readonly<FormatMigration>): string => step.id),
    chainId: chainId(migrations, options.hash),
    digest: options.hash(copy.get(INDEX) ?? new Uint8Array()),
    preparation: preparationOf(admitted.cook, steps),
  }
}

/** Validate a migrated copy at the reader's format. A render step leaves the author preparation stale, so by default this
 * skips `requireCookPreparation` (the box's cook re-prepares, SP1b); pass `preparation: 'author'` to hold a data-only
 * copy's re-sealed preparation to the full check. */
function validateMigrated(
  files: Files,
  ports: Readonly<ShardfileValidationPorts>,
): ValidatedShardfile {
  const read = (path: string, maxBytes: number): Uint8Array => {
    const bytes = files.get(path)
    if (bytes === undefined || bytes.length > maxBytes) {
      throw new Error(`Missing or oversized migrated file: ${path}`)
    }
    return bytes
  }
  return validateShardfileFolder(
    { read, paths: (): Iterable<string> => files.keys() },
    { preparation: 'migrated', ...ports },
  )
}

export {
  type MigrateOptions,
  type MigratedShardfile,
  migrateShardfile,
  validateMigrated,
}
