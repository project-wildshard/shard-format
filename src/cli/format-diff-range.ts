import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

import { readLock } from './format-diff-lock.ts'
import { formatDiffReport } from './format-diff-report.ts'
import { formatDiff } from './format-diff.ts'

import type { LockData } from './format-diff-lock.ts'
import type { Report } from './format-diff.ts'

// SHARD-COMPAT FE6: range mode. `shard-format format-diff <a>..<b>` diffs
// each commit in the range that touched the format lock against the one
// before it, then the range's two ends: the net delta. A part added and
// removed inside the range shows in its steps and not in the net.

interface Locked {
  readonly ref: string
  readonly lock: LockData
}

interface RangeStep {
  readonly from: string
  readonly to: string
  readonly report: Report
}

interface RangeReport {
  readonly steps: readonly RangeStep[]
  readonly net: Report
}

// eslint-disable-next-line typescript/strict-void-return -- Node execFile returns a child while its callback supplies the result.
const run = promisify(execFile)
const RANGE = '..'
const LOCK_PATH = 'src/format/lock'
const SHORT = 9
const FIRST = 0
const NEXT = 1

/** Each consecutive pair's diff, and the ends' diff. */
function rangeDiff(locks: readonly Readonly<Locked>[]): RangeReport {
  const first = locks.at(FIRST)
  const last = locks.at(-NEXT)
  if (first === undefined || last === undefined) {
    throw new Error('a range needs at least one lock')
  }
  const steps = locks
    .slice(NEXT)
    .map((to: Readonly<Locked>, at: number): RangeStep => ({
      from: locks[at]?.ref ?? first.ref,
      to: to.ref,
      report: formatDiff(locks[at]?.lock ?? first.lock, to.lock),
    }))
  return { steps, net: formatDiff(first.lock, last.lock) }
}

/** `<a>..<b>`'s ends and every commit between that touched the lock, oldest first. */
async function rangeRefs(
  range: string,
  cwd: string,
): Promise<readonly string[]> {
  const [from = '', to = ''] = range.split(RANGE)
  const { stdout } = await run(
    'git',
    ['rev-list', '--reverse', `${from}..${to}`, '--', LOCK_PATH],
    { cwd, encoding: 'utf8' },
  )
  const inside = stdout
    .split('\n')
    .filter((line: string): boolean => line !== '')
  const parsed = await run('git', ['rev-parse', to], { cwd, encoding: 'utf8' })
  const tip = parsed.stdout.trim()
  return [from, ...inside.filter((sha: string): boolean => sha !== tip), to]
}

/** Lock every ref of a range and diff it. */
async function readRange(range: string, cwd: string): Promise<RangeReport> {
  const refs = await rangeRefs(range, cwd)
  const locks: Locked[] = []
  for (const ref of refs) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- each ref unpacks into the same scratch folder
    locks.push({ ref, lock: await readLock(ref, cwd) })
  }
  return rangeDiff(locks)
}

function isRange(operand: string): boolean {
  return operand.includes(RANGE)
}

const short = (ref: string): string =>
  /^[\da-f]{40}$/u.test(ref) ? ref.slice(FIRST, SHORT) : ref

/** Each step's report under its commit pair, then the net delta. */
function rangeReport(report: Readonly<RangeReport>): string {
  return [
    ...report.steps.map(
      (step: Readonly<RangeStep>): string =>
        `${short(step.from)}..${short(step.to)}\n${formatDiffReport(step.report)}`,
    ),
    `net\n${formatDiffReport(report.net)}`,
  ].join('\n\n')
}

/** `format-diff <a>..<b>`: the range's report, as text or JSON. */
async function rangeOutput(range: string, json: boolean): Promise<string> {
  const report = await readRange(range, process.cwd())
  return json ? JSON.stringify(report, undefined, NEXT) : rangeReport(report)
}

export { isRange, rangeDiff, rangeOutput, rangeReport, readRange }
export type { Locked, RangeReport, RangeStep }
