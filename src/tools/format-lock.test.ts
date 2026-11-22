import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'

import {
  array,
  check,
  maxLength,
  number,
  object,
  optional,
  picklist,
  pipe,
  string,
} from 'valibot'

import { chainIdOf, LockWalk } from './format-lock-core.ts'
import { isRecord } from './format-lock-data.ts'
import {
  keptFiles,
  lockFiles,
  lockNow,
  moved as movedFiles,
} from './format-lock.ts'

// SHARD-COMPAT FE1's done-when, on synthetic modules and on the real package.

const SLOW = 120_000
const LIMIT = 64
const ROWS = 1000
// Half the pre-commit's 1 MB per-blob cap, so a growing subpath warns early.
const BLOB_CAP = 512 * 1024

function rowsOf(
  module: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const walk = new LockWalk()
  walk.module('./sample', module)
  const excluded = Object.entries(walk.excluded).map(
    ([key, why]: readonly [string, string]): readonly [string, string] => [
      key,
      `excluded: ${why}`,
    ],
  )
  return { ...walk.rows, ...Object.fromEntries(excluded) }
}

function moved(
  before: Readonly<Record<string, unknown>>,
  after: Readonly<Record<string, unknown>>,
): readonly string[] {
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  return [...keys]
    .filter(
      (key: string): boolean =>
        JSON.stringify(before[key]) !== JSON.stringify(after[key]),
    )
    .toSorted()
}

function sample(max: number): Readonly<Record<string, unknown>> {
  const Name = pipe(string(), maxLength(max))
  return {
    ShardSchema: object({
      name: Name,
      tags: array(picklist(['a', 'b'])),
      size: optional(number(), 1),
    }),
    LIMIT,
    parse: (value: unknown): unknown => value,
  }
}

test('one maxLength change moves one row', (): void => {
  const before = rowsOf(sample(LIMIT))
  const after = rowsOf(sample(LIMIT + 1))
  assert.deepEqual(moved(before, after), ['./sample#ShardSchema.name'])
})

test('a constant is a row, a function is excluded with its reason', (): void => {
  const rows = rowsOf(sample(LIMIT))
  assert.equal(rows['./sample#LIMIT'], LIMIT)
  assert.match(String(rows['./sample#parse']), /^excluded: function/u)
})

test('a predicate is held by its code: a comment edit keeps it, a code edit moves it', (): void => {
  const one = rowsOf({
    Size: pipe(
      number(),
      check((size: number): boolean => size > 1),
    ),
  })
  const two = rowsOf({
    Size: pipe(
      number(),
      check(
        (size: number): boolean =>
          // Why: a docs-only edit
          size > 1,
      ),
    ),
  })
  const three = rowsOf({
    Size: pipe(
      number(),
      check((size: number): boolean => size > 2),
    ),
  })
  assert.deepEqual(moved(one, two), [])
  assert.deepEqual(moved(one, three), ['./sample#Size'])
})

test('the chain id moves with a migration edit, not with a comment', (): void => {
  const base = chainIdOf({
    'format-migrations.ts': 'const STEPS = [renameField]\n',
  })
  assert.equal(
    chainIdOf({
      'format-migrations.ts': '// the steps\nconst STEPS = [renameField]\n',
    }),
    base,
  )
  assert.notEqual(
    chainIdOf({
      'format-migrations.ts': 'const STEPS = [renameField, dropField]\n',
    }),
    base,
  )
  assert.notEqual(
    chainIdOf({
      'format-migrations.ts': 'const STEPS = [renameField]\n',
      'format-migration-ops.ts': 'x',
    }),
    base,
  )
})

test(
  'the lock in the tree matches the code (pnpm check:lock)',
  { timeout: SLOW },
  async (): Promise<void> => {
    const now = lockFiles(await lockNow())
    assert.deepEqual(movedFiles(await keptFiles(), now), [])
    const big = Object.keys(now).filter(
      (name: string): boolean => (now[name] ?? '').length > BLOB_CAP,
    )
    assert.deepEqual(big, [], 'no lock file nears the 1 MB blob cap')
  },
)

async function packageField(name: string): Promise<unknown> {
  const pkg: unknown = JSON.parse(
    await readFile(new URL('../../package.json', import.meta.url), 'utf8'),
  )
  return isRecord(pkg) ? pkg[name] : undefined
}

test('the lock stays out of the npm package', async (): Promise<void> => {
  const listed = await packageField('files')
  assert.ok(Array.isArray(listed))
  assert.ok(listed.includes('!src/format/lock/**'))
  assert.ok(
    !listed.includes('src/format/*.json') && !listed.includes('src/format/**'),
  )
})

test(
  'every package export is locked or excluded with a reason',
  { timeout: SLOW },
  async (): Promise<void> => {
    const lock = await lockNow()
    const field = await packageField('exports')
    assert.ok(isRecord(field))
    const named = new Set(
      [...Object.keys(lock.rows), ...Object.keys(lock.excluded)].map(
        (key: string): string => key.split('#').at(0) ?? '',
      ),
    )
    const bare = Object.entries(field)
      .filter(
        ([subpath, target]: readonly [string, unknown]): boolean =>
          typeof target === 'string' &&
          target.startsWith('./src/') &&
          !named.has(subpath),
      )
      .map(([subpath]: readonly [string, unknown]): string => subpath)
    assert.deepEqual(bare, [])
    assert.ok(
      Object.values(lock.excluded).every(
        (why: string): boolean => why.length > 0,
      ),
    )
    assert.ok(Object.keys(lock.rows).length > ROWS)
  },
)
