// SHARD-COMPAT FE11b: migrated-old against rebuilt-new parity. An older shard file runs the chain up to the format a
// rebuild of the same source writes; every member of the two is then compared: JSON by its canonical text (keys
// sorted), anything else by its SHA-256; the build's validation receipt is left out (the copy drops it by design). A Kitchen Sink slice's migration passes when the migrated copy of a stored
// upload matches the source rebuilt at the new format, member for member.
// `node src/tools/format-parity.ts <old.shardfile> <new.shardfile>` prints one line per differing member and exits 1 on
// any difference.
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

import { RECEIPT } from '../format/format-migrate-inventory.ts'
import { migrateShardfile } from '../format/format-migrate.ts'
import { declaredShardfileFormat } from '../format/format-migration-envelope.ts'
import { prepareAssetDecoders } from '../format/shardfile-assets.ts'
import { readTar } from '../format/tar.ts'

import type { FormatMigration } from '../format/format-migrations.ts'

type Files = ReadonlyMap<string, Uint8Array>
type Verdict = 'differs' | 'only-new' | 'only-old'

interface MemberDifference {
  readonly path: string
  readonly verdict: Verdict
  /** The first differing JSON path (`a.b[2]`), for a JSON member that differs. */
  readonly at?: string
}

interface Parity {
  readonly from: string
  readonly to: string
  readonly applied: readonly string[]
  readonly same: number
  readonly differences: readonly MemberDifference[]
}

interface ParityOptions {
  /** The steps to run; the registry by default (tests inject their own). */
  readonly migrations?: readonly FormatMigration[]
}

const JSON_SUFFIX = '.json'
const SCRIPT_ARG = 1
const NONE = 0
const ARGS = 2
const EXIT_DIFFERS = 1
const EXIT_USAGE = 2

function sha256(bytes: Readonly<Uint8Array>): string {
  return createHash('sha256').update(bytes).digest('hex')
}

/** A value with every object's keys sorted, so key order never reads as a difference. */
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry: unknown): unknown => sorted(entry))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value)
        .toSorted(
          (
            [one]: readonly [string, unknown],
            [two]: readonly [string, unknown],
          ): number => one.localeCompare(two),
        )
        .map(([key, entry]: readonly [string, unknown]): [string, unknown] => [
          key,
          sorted(entry),
        ]),
    )
  }
  return value
}

function parsed(bytes: Readonly<Uint8Array>): unknown {
  return JSON.parse(new TextDecoder().decode(bytes))
}

function childPath(at: string, key: string): string {
  return /^\d+$/u.test(key)
    ? `${at}[${key}]`
    : `${at}${at === '' ? '' : '.'}${key}`
}

function sameJson(one: unknown, two: unknown): boolean {
  return JSON.stringify(sorted(one)) === JSON.stringify(sorted(two))
}

/** The first JSON path where two values part, depth first. */
function firstDifference(one: unknown, two: unknown, at = ''): string {
  if (
    typeof one !== 'object' ||
    typeof two !== 'object' ||
    one === null ||
    two === null ||
    Array.isArray(one) !== Array.isArray(two)
  ) {
    return at === '' ? '(root)' : at
  }
  const keys = [
    ...new Set([...Object.keys(one), ...Object.keys(two)]),
  ].toSorted()
  const parted = keys.find(
    (key: string): boolean =>
      !sameJson(Reflect.get(one, key), Reflect.get(two, key)),
  )
  return parted === undefined
    ? at
    : firstDifference(
        Reflect.get(one, parted),
        Reflect.get(two, parted),
        childPath(at, parted),
      )
}

/** How one member of the two files compares, or undefined when it is the same. */
function memberDifference(
  path: string,
  old: Readonly<Uint8Array> | undefined,
  rebuilt: Readonly<Uint8Array> | undefined,
): MemberDifference | undefined {
  if (old === undefined || rebuilt === undefined) {
    return { path, verdict: old === undefined ? 'only-new' : 'only-old' }
  }
  if (!path.endsWith(JSON_SUFFIX)) {
    return sha256(old) === sha256(rebuilt)
      ? undefined
      : { path, verdict: 'differs' }
  }
  const one = parsed(old)
  const two = parsed(rebuilt)
  return sameJson(one, two)
    ? undefined
    : { path, verdict: 'differs', at: firstDifference(one, two) }
}

/** The format a file's `shard.json` declares. */
function formatOf(files: Files): string {
  const index = files.get('shard.json')
  const value = index === undefined ? undefined : parsed(index)
  const declared =
    typeof value === 'object' && value !== null
      ? declaredShardfileFormat(Object.fromEntries(Object.entries(value)))
      : undefined
  if (typeof declared !== 'string') {
    throw new TypeError('The rebuilt shard file declares no format version')
  }
  return declared
}

/** Migrate `old` to the format `rebuilt` declares and compare the two, member by member. */
function parity(
  old: Files,
  rebuilt: Files,
  options: Readonly<ParityOptions> = {},
): Parity {
  const migrated = migrateShardfile(old, {
    hash: sha256,
    to: formatOf(rebuilt),
    ...(options.migrations === undefined
      ? {}
      : { migrations: options.migrations }),
  })
  // The copy drops the build's validation receipt by design (admission validates it), so only the rebuild has one.
  const paths = [...new Set([...migrated.files.keys(), ...rebuilt.keys()])]
    .filter((path: string): boolean => path !== RECEIPT)
    .toSorted()
  const differences = paths
    .map((path: string): MemberDifference | undefined =>
      memberDifference(path, migrated.files.get(path), rebuilt.get(path)),
    )
    .filter(
      (row: MemberDifference | undefined): row is MemberDifference =>
        row !== undefined,
    )
  return {
    from: migrated.from,
    to: migrated.to,
    applied: migrated.applied,
    same: paths.length - differences.length,
    differences,
  }
}

/** The report's lines. */
function parityLines(result: Readonly<Parity>): string[] {
  const applied =
    result.applied.length === NONE ? 'none' : result.applied.join(', ')
  return [
    `migrated ${result.from} to ${result.to} (${applied})`,
    ...result.differences.map(
      (row: Readonly<MemberDifference>): string =>
        `${row.verdict} ${row.path}${row.at === undefined ? '' : ` at ${row.at}`}`,
    ),
    `parity: ${String(result.same)} same, ${String(result.differences.length)} differ`,
  ]
}

async function main(args: readonly string[]): Promise<void> {
  const [oldPath, newPath] = args
  if (oldPath === undefined || newPath === undefined) {
    process.stderr.write(
      'usage: format-parity.ts <old.shardfile> <new.shardfile>\n',
    )
    process.exitCode = EXIT_USAGE
    return
  }
  await prepareAssetDecoders()
  const result = parity(
    readTar(await readFile(oldPath)),
    readTar(await readFile(newPath)),
  )
  process.stdout.write(`${parityLines(result).join('\n')}\n`)
  process.exitCode = result.differences.length === NONE ? NONE : EXIT_DIFFERS
}

if (import.meta.filename === process.argv[SCRIPT_ARG]) {
  await main(process.argv.slice(ARGS))
}

export {
  type MemberDifference,
  type Parity,
  firstDifference,
  parity,
  parityLines,
}
