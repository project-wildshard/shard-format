import assert from 'node:assert/strict'
import { test } from 'node:test'

import { number, optional, strictObject, string } from 'valibot'

import { lockOf } from '../tools/format-diff-fixture.ts'
import { rangeDiff, rangeReport } from './format-diff-range.ts'
import { formatDiff } from './format-diff.ts'

import type { Module } from '../tools/format-diff-fixture.ts'
import type { Change } from './format-diff-data.ts'
import type { Locked } from './format-diff-range.ts'

// SHARD-COMPAT FE6: a synthetic 5-commit range gives the exact net delta.

const shard = (fields: Module): Module => ({
  Shard: strictObject({ name: string(), ...fields }),
})
const COMMITS: readonly Module[] = [
  shard({}),
  shard({ xx: optional(number()) }),
  shard({ xx: optional(number()), yy: optional(string()) }),
  shard({ yy: optional(string()) }),
  shard({ yy: optional(string()), zz: optional(number()) }),
]

const pathsOf = (changes: readonly Readonly<Change>[]): readonly string[] =>
  changes
    .map((found: Readonly<Change>): string => `${found.path} ${found.kind}`)
    .toSorted()

function locksOf(): readonly Readonly<Locked>[] {
  return COMMITS.map((module: Module, at: number): Locked => ({
    ref: `c${String(at)}`,
    lock: lockOf(module),
  }))
}

const has = (lines: readonly string[], part: string): boolean =>
  lines.some((line: string): boolean => line.includes(part))

test('a 5-commit range: four steps, each from the commit before (FE6)', (): void => {
  const report = rangeDiff(locksOf())

  assert.deepEqual(
    report.steps.map(
      (step: Readonly<{ from: string; to: string }>): string =>
        `${step.from}..${step.to}`,
    ),
    ['c0..c1', 'c1..c2', 'c2..c3', 'c3..c4'],
  )
  assert.ok(
    has(pathsOf(report.steps[2]?.report.changes ?? []), '.xx'),
    'step c2..c3 removes xx',
  )
  assert.match(rangeReport(report), /^c0\.\.c1\n[\s\S]*\n\nnet\n/u)
})

test("the net delta is exactly the ends' diff, without the part added and removed inside (FE6)", (): void => {
  const locks = locksOf()
  const [first] = locks
  const last = locks.at(-1)
  assert.ok(first !== undefined && last !== undefined)

  const { net } = rangeDiff(locks)

  assert.deepEqual(net, formatDiff(first.lock, last.lock))
  const lines = pathsOf(net.changes)
  assert.ok(
    !has(lines, '.xx'),
    `xx was added and removed inside the range: ${lines.join(', ')}`,
  )
  assert.ok(has(lines, '.yy') && has(lines, '.zz'), lines.join(', '))
})
