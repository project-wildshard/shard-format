import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { argv, stderr, stdout } from 'node:process'
import { pathToFileURL } from 'node:url'

import { DEPRECATIONS } from '../format/deprecations.ts'
import { FORMAT_MIGRATIONS } from '../format/format-migrations.ts'
import { chainIdOf, LockWalk } from './format-lock-core.ts'
import { byKey, isRecord } from './format-lock-data.ts'

import type { Deprecation } from '../format/deprecations.ts'
import type { FormatMigration } from '../format/format-migrations.ts'
import type { Excluded, Loaded } from './format-lock-core.ts'
import type { Json, Rows } from './format-lock-data.ts'

// SHARD-COMPAT FE1: `pnpm lock:write` writes the format lock from every
// package export; `pnpm check:lock` refuses a lock that no longer matches the
// code. Rules: format-lock-core.ts. The lock is a folder, src/format/lock/:
// `index.json` holds the chain id and the exclusions, and each subpath's rows
// are `<subpath>.json`, so no file nears the 1 MB blob cap (the whole is
// about 3 MB) and a change reads as the files and lines it moves.

const ROOT = path.resolve(import.meta.dirname, '../..')
const LOCK = path.join(ROOT, 'src/format/lock')
const INDEX = 'index.json'
// Not a package export: the lock adds FE7's table under this name.
const DEPRECATIONS_SUBPATH = './deprecations'
const CHAIN_SUBPATH = './format-chain'
const CHAIN =
  /^(?:format-migrat|format-migrations|migrations|validationReceipt|canonical)/u
const EXIT_OK = 0
const EXIT_FAIL = 1
const TYPES_ONLY =
  'types only: nothing at run time to lock (its schemas are locked where they are built)'

interface Lock {
  readonly chainId: string
  readonly rows: Readonly<Rows>
  readonly excluded: Readonly<Excluded>
}

/** Where one package subpath points. */
function targetOf(target: unknown): string {
  if (typeof target === 'string') {
    return target
  }
  const pick: unknown = isRecord(target)
    ? (target['import'] ?? target['default'])
    : undefined
  return typeof pick === 'string' ? pick : ''
}

/** The package's subpaths and the source each names. */
async function exportsOf(): Promise<readonly (readonly [string, string])[]> {
  const pkg: unknown = JSON.parse(
    await readFile(path.join(ROOT, 'package.json'), 'utf8'),
  )
  const field: unknown = isRecord(pkg) ? pkg['exports'] : undefined
  if (!isRecord(field)) {
    return []
  }
  return Object.entries(field)
    .toSorted(byKey)
    .map(
      ([subpath, target]: readonly [string, unknown]): readonly [
        string,
        string,
      ] => [subpath, targetOf(target)],
    )
    .filter(([, target]: readonly [string, string]): boolean =>
      target.startsWith('./src/'),
    )
}

/** The migration chain's runner, steps, helpers and canonicaliser, by file. */
async function chainSources(): Promise<Readonly<Record<string, string>>> {
  const folder = path.join(ROOT, 'src/format')
  const listed = await readdir(folder)
  const files = listed.filter(
    (file: string): boolean =>
      CHAIN.test(file) && file.endsWith('.ts') && !file.endsWith('.test.ts'),
  )
  const texts = await Promise.all(
    files.map(
      async (file: string): Promise<string> =>
        await readFile(path.join(folder, file), 'utf8'),
    ),
  )
  return Object.fromEntries(
    files.map((file: string, index: number): readonly [string, string] => [
      file,
      texts[index] ?? '',
    ]),
  )
}

function firstLine(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  return message.split('\n').at(EXIT_OK) ?? ''
}

/** One subpath's module, its JSON, or why it holds nothing to lock. */
async function load(target: string): Promise<Loaded> {
  const file = path.join(ROOT, target)
  if (target.endsWith('.json')) {
    const json: unknown = JSON.parse(await readFile(file, 'utf8'))
    return { json }
  }
  try {
    const module: unknown = await import(pathToFileURL(file).href)
    if (!isRecord(module) || Object.keys(module).length === EXIT_OK) {
      return { why: TYPES_ONLY }
    }
    return { module }
  } catch (error: unknown) {
    // A module Node can't load bare (a wasm or asset import a bundler resolves) holds no format shape here.
    return { why: `not loadable in Node: ${firstLine(error)}` }
  }
}

/** FE7's deprecation table, one row per id, so FE2 sees a new deprecation as its own change. */
function deprecationRows(): Loaded {
  const rows = DEPRECATIONS.map(
    (row: Readonly<Deprecation>): readonly [string, unknown] => [
      row.id,
      Object.fromEntries(
        Object.entries(row).map(
          ([key, value]: readonly [string, unknown]): readonly [
            string,
            unknown,
          ] => [key, value ?? 'none'],
        ),
      ),
    ],
  )
  return { module: Object.fromEntries(rows) }
}

/** FE8's chain steps, one row per id (what each writes), so FE13 sees a deleted step. */
function chainRows(): Loaded {
  const rows = FORMAT_MIGRATIONS.map(
    (step: Readonly<FormatMigration>): readonly [string, unknown] => [
      step.id,
      { to: step.to, touches: step.touches, affects: [...step.affects] },
    ],
  )
  return { module: Object.fromEntries(rows) }
}

/** The lock as the code stands. */
async function lockNow(): Promise<Lock> {
  const walk = new LockWalk()
  for (const [subpath, target] of await exportsOf()) {
    // oxlint-disable-next-line no-await-in-loop -- modules load in a fixed order, so `ref` paths are stable
    walk.add(subpath, await load(target))
  }
  walk.add(DEPRECATIONS_SUBPATH, deprecationRows())
  walk.add(CHAIN_SUBPATH, chainRows())
  return {
    chainId: chainIdOf(await chainSources()),
    rows: walk.rows,
    excluded: walk.excluded,
  }
}

/** One row per line, keys sorted: a change reads as the lines it moves. */
function block(rows: Readonly<Record<string, Json>>): string {
  const lines = Object.entries(rows)
    .toSorted(byKey)
    .map(
      ([key, value]: readonly [string, Json]): string =>
        `  ${JSON.stringify(key)}: ${JSON.stringify(value)}`,
    )
  return `{\n${lines.join(',\n')}\n}`
}

/** The subpath a row or exclusion key belongs to: `./audio#Name.path` is `./audio`. */
function subpathOf(key: string): string {
  return key.split('#').at(EXIT_OK) ?? key
}

/** The lock's files, by name in src/format/lock/. */
function lockFiles(lock: Lock): Readonly<Record<string, string>> {
  const bySubpath = new Map<string, Rows>()
  for (const [key, value] of Object.entries(lock.rows)) {
    const subpath = subpathOf(key)
    const rows = bySubpath.get(subpath) ?? {}
    rows[key] = value
    bySubpath.set(subpath, rows)
  }
  const out: Record<string, string> = {
    [INDEX]: `{\n "chainId": ${JSON.stringify(lock.chainId)},\n "excluded": ${block(lock.excluded)}\n}\n`,
  }
  for (const [subpath, rows] of bySubpath) {
    out[`${subpath.slice('./'.length)}.json`] = `${block(rows)}\n`
  }
  return out
}

/** The lock folder as it is on disk. */
async function keptFiles(): Promise<Readonly<Record<string, string>>> {
  const names = await readdir(LOCK).catch((): readonly string[] => [])
  const json = names.filter((name: string): boolean => name.endsWith('.json'))
  const texts = await Promise.all(
    json.map(
      async (name: string): Promise<string> =>
        await readFile(path.join(LOCK, name), 'utf8'),
    ),
  )
  return Object.fromEntries(
    json.map((name: string, index: number): readonly [string, string] => [
      name,
      texts[index] ?? '',
    ]),
  )
}

/** The files that differ between two lock folders, by name. */
function moved(
  before: Readonly<Record<string, string>>,
  after: Readonly<Record<string, string>>,
): readonly string[] {
  const names = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...names]
    .filter((name: string): boolean => before[name] !== after[name])
    .toSorted()
}

async function write(now: Readonly<Record<string, string>>): Promise<number> {
  await rm(LOCK, { recursive: true, force: true })
  await mkdir(LOCK, { recursive: true })
  await Promise.all(
    Object.entries(now).map(
      async ([name, body]: readonly [string, string]): Promise<void> => {
        await writeFile(path.join(LOCK, name), body)
      },
    ),
  )
  const bytes = Object.values(now).reduce(
    (sum: number, body: string): number => sum + body.length,
    EXIT_OK,
  )
  stdout.write(
    `format lock written: ${String(Object.keys(now).length)} files, ${String(bytes)} bytes\n`,
  )
  return EXIT_OK
}

async function main(): Promise<number> {
  const now = lockFiles(await lockNow())
  if (argv.includes('--write')) {
    return await write(now)
  }
  const stale = moved(await keptFiles(), now)
  if (stale.length === EXIT_OK) {
    stdout.write('format lock matches the code\n')
    return EXIT_OK
  }
  stderr.write(
    `format lock is stale in ${stale.join(', ')}: run \`pnpm lock:write\`, review the diff, and commit it (FE1)\n`,
  )
  return EXIT_FAIL
}

if (import.meta.main) {
  process.exitCode = await main()
}

export { keptFiles, lockFiles, lockNow, moved }
