import { execFile } from 'node:child_process'
import { access, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { argv, stderr, stdout } from 'node:process'
import { promisify } from 'node:util'

import { SHARDFILE_VERSION } from '../format/version.ts'
import { judge, zoneSnapshotOffenders } from './zone-snapshot-core.ts'

// ZONE-SNAPSHOTS ZS1 (J507, J505's permanent half): `pnpm check:zone-snapshots`, in `pnpm check`. Today's
// offenders sit in zone-snapshot-baseline.json, which may only shrink: a new offender fails, and so does a listed
// one that no longer offends (`--prune` drops those). ZS3 to ZS6 take it to zero.

// eslint-disable-next-line typescript/strict-void-return -- Node execFile returns a child while its callback supplies the result.
const run = promisify(execFile)
const FAILED = 1
const NONE = 0
const INDENT = 1
const LIST_BYTES = 67_108_864
const ROOT = path.resolve(import.meta.dirname, '../..')
const BASELINE = path.join(ROOT, 'src/tools/zone-snapshot-baseline.json')
const ABOUT =
  "ZONE-SNAPSHOTS ZS1: today's zone snapshots; shrink only (node src/tools/zone-snapshot-guard.ts --prune)"

async function exists(file: string): Promise<boolean> {
  try {
    await access(file)
    return true
  } catch {
    return false
  }
}

async function liveZones(): Promise<readonly string[]> {
  const repos: unknown = JSON.parse(
    await readFile(path.join(ROOT, 'corpus/shard-repos.json'), 'utf8'),
  )
  return typeof repos === 'object' && repos !== null ? Object.keys(repos) : []
}

async function baseline(): Promise<readonly string[]> {
  if (!(await exists(BASELINE))) {
    return []
  }
  const json: unknown = JSON.parse(await readFile(BASELINE, 'utf8'))
  const list =
    typeof json === 'object' && json !== null && 'offenders' in json
      ? json.offenders
      : []
  return Array.isArray(list)
    ? list.filter((line: unknown): line is string => typeof line === 'string')
    : []
}

async function save(offenders: readonly string[]): Promise<void> {
  await writeFile(
    BASELINE,
    `${JSON.stringify({ about: ABOUT, offenders }, undefined, INDENT)}\n`,
  )
}

function lines(list: readonly string[]): string {
  return list.map((line: string): string => `  ${line}`).join('\n')
}

const { stdout: listing } = await run('git', ['ls-files', '-z'], {
  cwd: ROOT,
  encoding: 'utf8',
  maxBuffer: LIST_BYTES,
})
const paths = listing.split('\0').filter(Boolean)
const texts = new Map<string, string>(
  await Promise.all(
    paths
      .filter((file: string): boolean =>
        /\.(?:json|ts|mts|mjs|js|cjs)$/u.test(file),
      )
      .map(async (file: string): Promise<readonly [string, string]> => [
        file,
        await readFile(path.join(ROOT, file), 'utf8').catch((): string => ''),
      ]),
  ),
)
const offenders = zoneSnapshotOffenders({
  paths,
  read: (file: string): string => texts.get(file) ?? '',
  current: SHARDFILE_VERSION,
  zones: await liveZones(),
})
const listed = await baseline()
const { added, gone } = judge(offenders, listed)
let failed = false
if (argv.includes('--seed') && !(await exists(BASELINE))) {
  await save(offenders)
  stdout.write(
    `zone-snapshot-guard: baseline seeded with ${offenders.length}\n`,
  )
} else if (argv.includes('--prune') && gone.length > NONE) {
  await save(listed.filter((line: string): boolean => !gone.includes(line)))
  stdout.write(`zone-snapshot-guard: baseline pruned by ${gone.length}\n`)
} else if (gone.length > NONE) {
  stderr.write(
    `zone-snapshot-guard: ${gone.length} baseline line(s) no longer offend; run node src/tools/zone-snapshot-guard.ts --prune and commit the baseline:\n${lines(gone)}\n`,
  )
  failed = true
}
if (added.length > NONE) {
  stderr.write(
    `zone-snapshot-guard (J507): no checked-in zone snapshots. Read the live pin by slug or write a made-up minimal fixture:\n${lines(added)}\n`,
  )
  failed = true
}
if (failed) {
  process.exitCode = FAILED
} else {
  stdout.write(`zone-snapshot-guard: ${listed.length} baselined, none new\n`)
}
