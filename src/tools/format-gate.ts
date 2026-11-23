import { execFile } from 'node:child_process'
import { cp, mkdir, readFile, rm, stat, symlink } from 'node:fs/promises'
import path from 'node:path'
import { stderr, stdout } from 'node:process'
import { promisify } from 'node:util'

import { readLockFolder } from '../cli/format-diff-lock.ts'
import { formatDiff } from '../cli/format-diff.ts'
import { DEPRECATIONS } from '../format/deprecations.ts'
import { FORMAT_MIGRATIONS } from '../format/format-migrations.ts'
import { formatGate, readBreakFile } from './format-gate-core.ts'

import type { LockData } from '../cli/format-diff-lock.ts'
import type { BreakFile } from './format-gate-core.ts'

// SHARD-COMPAT FE4: `pnpm check:format-gate` (in `pnpm check`, so pre-push
// and CI). It builds the lock of the newest release tag this tree contains
// with this tree's lock tool (so both sides are written the same way), diffs
// it against this tree's lock (FE2) and applies the rules in
// format-gate-core.ts. The tag's tree goes to ./tmp/format-gate and is
// removed after.

// eslint-disable-next-line typescript/strict-void-return -- Node execFile returns a child while its callback supplies the result.
const run = promisify(execFile)
const ROOT = path.resolve(import.meta.dirname, '../..')
const SCRATCH = path.join(ROOT, 'tmp/format-gate')
const LOCK_TOOLS = [
  'src/tools/format-lock.ts',
  'src/tools/format-lock-core.ts',
  'src/tools/format-lock-data.ts',
]
const VERSION_ROW = './version#SHARDFILE_VERSION'
const MAX_OUTPUT = 268_435_456
const EXIT_OK = 0
const EXIT_FAIL = 1

async function git(args: readonly string[]): Promise<string> {
  const { stdout: out } = await run('git', [...args], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: MAX_OUTPUT,
  })
  return out.trim()
}

/** The newest `v*` tag this tree contains, if any. */
async function lastTag(): Promise<string | undefined> {
  const tags = await git([
    'tag',
    '--merged',
    'HEAD',
    '--sort=-v:refname',
    '--list',
    'v*',
  ])
  return tags.split('\n').find((tag: string): boolean => tag !== '')
}

/** The tag's tree, locked by this tree's lock tool. */
async function lockAt(tag: string): Promise<LockData> {
  const tree = path.join(SCRATCH, tag)
  await rm(tree, { recursive: true, force: true })
  await mkdir(tree, { recursive: true })
  await run(
    'sh',
    ['-c', 'git archive "$1" | tar -x -C "$2"', 'sh', tag, tree],
    {
      cwd: ROOT,
      maxBuffer: MAX_OUTPUT,
    },
  )
  await symlink(
    path.join(ROOT, 'node_modules'),
    path.join(tree, 'node_modules'),
  )
  await Promise.all(
    LOCK_TOOLS.map(async (file: string): Promise<void> => {
      await cp(path.join(ROOT, file), path.join(tree, file))
    }),
  )
  await run(process.execPath, ['src/tools/format-lock.ts', '--write'], {
    cwd: tree,
    maxBuffer: MAX_OUTPUT,
  })
  return await readLockFolder(tree)
}

function versionOf(lock: Readonly<LockData>): string {
  const version = lock.rows[VERSION_ROW]
  return typeof version === 'string' ? version : '0.1'
}

async function breaksFor(version: string): Promise<BreakFile | undefined> {
  const file = path.join(ROOT, 'src/format/breaks', `${version}.json`)
  const text = await readFile(file, 'utf8').catch((): undefined => undefined)
  return text === undefined ? undefined : readBreakFile(text, version)
}

async function hasFixture(version: string): Promise<boolean> {
  const found = await stat(
    path.join(ROOT, 'corpus/format-versions', version),
  ).catch((): undefined => undefined)
  return found?.isDirectory() === true
}

async function gateAgainst(tag: string): Promise<number> {
  const [before, after] = await Promise.all([lockAt(tag), readLockFolder(ROOT)])
  const version = versionOf(after)
  const result = formatGate({
    base: tag,
    baseVersion: versionOf(before),
    version,
    report: formatDiff(before, after),
    breaks: await breaksFor(version),
    fixture: await hasFixture(version),
    migrations: new Set(
      FORMAT_MIGRATIONS.map(
        (step: Readonly<{ id: string }>): string => step.id,
      ),
    ),
    deprecations: new Set(
      DEPRECATIONS.map((row: Readonly<{ id: string }>): string => row.id),
    ),
  })
  const [head, ...problems] = result.lines
  stdout.write(`${head ?? ''}\n`)
  if (!result.ok) {
    stderr.write(
      `format gate (FE4) refuses:\n${problems.map((line: string): string => `  ${line}`).join('\n')}\n`,
    )
  }
  return result.ok ? EXIT_OK : EXIT_FAIL
}

async function main(): Promise<number> {
  const tag = await lastTag()
  if (tag === undefined) {
    stdout.write('format gate: no release tag in this tree to diff against\n')
    return EXIT_OK
  }
  try {
    return await gateAgainst(tag)
  } finally {
    await rm(SCRATCH, { recursive: true, force: true })
  }
}

process.exitCode = await main()
