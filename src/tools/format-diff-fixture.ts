import assert from 'node:assert/strict'

import { formatDiff } from '../cli/format-diff.ts'
import { LockWalk } from './format-lock-core.ts'

import type { LockData } from '../cli/format-diff-lock.ts'
import type { Report } from '../cli/format-diff.ts'

// SHARD-COMPAT FE2's test fixture: two real valibot modules, locked by FE1's
// walk, then classified. Test-only: src/tools is not in the npm files.

type Module = Readonly<Record<string, unknown>>
type Expected = readonly [path: string, kind: string, op?: string]

const SAMPLE = './sample'
const ONE = 1
const INDENT = 1

function lockOf(module: Module, deprecations: Module = {}): LockData {
  const walk = new LockWalk()
  walk.module(SAMPLE, module)
  walk.add('./deprecations', { module: deprecations })
  return { chainId: 'chain', rows: walk.rows, excluded: walk.excluded }
}

function diffOf(before: Module, after: Module): Report {
  return formatDiff(lockOf(before), lockOf(after))
}

/** The report's one change as [path, kind, op?]; fails on none or several. */
function only(report: Readonly<Report>): Expected {
  assert.equal(
    report.changes.length,
    ONE,
    JSON.stringify(report.changes, undefined, INDENT),
  )
  const [found] = report.changes
  assert.ok(found !== undefined)
  return found.op === undefined
    ? [found.path, found.kind]
    : [found.path, found.kind, found.op]
}

export { diffOf, lockOf, only }
export type { Expected, Module }
