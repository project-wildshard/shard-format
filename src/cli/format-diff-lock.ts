import { execFile } from 'node:child_process'
import { mkdir, readdir, readFile, rm, stat } from 'node:fs/promises'
import path from 'node:path'
import { promisify } from 'node:util'

// SHARD-COMPAT FE2: read a format lock (FE1) from a folder or a git ref.
// A lock is `src/format/lock/`: `index.json` (chain id, exclusions) and one
// `<subpath>.json` of rows per package subpath.

type Json =
  | boolean
  | number
  | string
  | null
  | readonly Json[]
  | { readonly [key: string]: Json }

interface LockData {
  readonly chainId: string
  readonly rows: Readonly<Record<string, Json>>
  readonly excluded: Readonly<Record<string, string>>
}

// eslint-disable-next-line typescript/strict-void-return -- Node execFile returns a child while its callback supplies the result.
const run = promisify(execFile)
const LOCK_FOLDER = 'src/format/lock'
const INDEX = 'index.json'
const MAX_OUTPUT = 268_435_456
const SAFE_REF = /[^A-Za-z0-9._-]/gu

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function assemble(
  names: readonly string[],
  parsed: readonly unknown[],
  root: string,
): LockData {
  const index = parsed[names.indexOf(INDEX)]
  if (!isRecord(index) || typeof index['chainId'] !== 'string') {
    throw new Error(`${root}: no format lock (no ${INDEX} with a chainId)`)
  }
  const rows: Record<string, Json> = {}
  for (const [at, body] of parsed.entries()) {
    if (names[at] !== INDEX && isRecord(body)) {
      Object.assign(rows, body)
    }
  }
  const excluded = isRecord(index['excluded']) ? index['excluded'] : {}
  return {
    chainId: index['chainId'],
    rows,
    excluded: Object.fromEntries(
      Object.entries(excluded).map(
        ([key, why]: readonly [string, unknown]): readonly [string, string] => [
          key,
          String(why),
        ],
      ),
    ),
  }
}

/** The lock in one folder (the lock folder itself, or a checkout holding src/format/lock). */
async function readLockFolder(folder: string): Promise<LockData> {
  const inner = path.join(folder, LOCK_FOLDER)
  const found = await stat(inner).catch((): undefined => undefined)
  const root = found?.isDirectory() === true ? inner : folder
  const listed = await readdir(root)
  const names = listed.filter((name: string): boolean => name.endsWith('.json'))
  const parsed = await Promise.all(
    names.map(async (name: string): Promise<unknown> => {
      const body = await readFile(path.join(root, name), 'utf8')
      return JSON.parse(body)
    }),
  )
  return assemble(names, parsed, root)
}

/** The lock at a git ref, extracted under ./tmp/format-diff/<ref>. */
async function readLockRef(ref: string, cwd: string): Promise<LockData> {
  const out = path.join(cwd, 'tmp/format-diff', ref.replaceAll(SAFE_REF, '_'))
  await rm(out, { recursive: true, force: true })
  await mkdir(out, { recursive: true })
  const { stdout } = await run(
    'git',
    ['ls-tree', '-r', '--name-only', ref, '--', `${LOCK_FOLDER}/`],
    { cwd, encoding: 'utf8', maxBuffer: MAX_OUTPUT },
  )
  if (stdout.trim() === '') {
    throw new Error(
      `${ref} has no format lock (FE1 landed after 0.69.2): build one with \`pnpm lock:write\` in a checkout of it and pass that folder`,
    )
  }
  await run(
    'sh',
    [
      '-c',
      'git archive "$1" "$2" | tar -x -C "$3"',
      'sh',
      ref,
      LOCK_FOLDER,
      out,
    ],
    { cwd, maxBuffer: MAX_OUTPUT },
  )
  return await readLockFolder(out)
}

/** A lock from a folder when one exists at that path, else from a git ref in cwd. */
async function readLock(where: string, cwd: string): Promise<LockData> {
  const found = await stat(path.resolve(cwd, where)).catch(
    (): undefined => undefined,
  )
  return found?.isDirectory() === true
    ? await readLockFolder(path.resolve(cwd, where))
    : await readLockRef(where, cwd)
}

export { isRecord, readLock, readLockFolder }
export type { Json, LockData }
