import assert from 'node:assert/strict'
import { test } from 'node:test'

import { reuploadPlan } from './reupload-plan.ts'
import { reupload, reuploadReport } from './reupload-run.ts'

import type { CorpusRow } from '../cli/corpus.ts'
import type { Deprecation } from '../format/deprecations.ts'
import type { ReuploadIo } from './reupload-run.ts'

// SHARD-COMPAT CP17 (J486, Q31): the re-upload tool, on a seeded
// deprecation and a corpus double whose re-publishes land new revisions.

const SEEDED: Deprecation = {
  id: 'seeded.part',
  path: 'shard.json seeded (CP17 test)',
  since: '0.1.0.2',
  replacement: 'leave it out',
  migration: undefined,
}
const REPOS = { alpha: 'shard-alpha', beta: 'shard-beta' }

function row(slug: string, revision: number, uses: boolean): CorpusRow {
  return {
    slug,
    revision,
    hash: `${slug}${String(revision)}`.padEnd(64, '0'),
    storedBytes: 1,
    verdict: 'valid',
    reason: undefined,
    cached: true,
    deprecations: uses ? [SEEDED.id] : [],
  }
}

/** A corpus double: a dispatch publishes the slug's next revision, without the part. */
function world(
  seed: readonly CorpusRow[],
): ReuploadIo & { readonly dispatched: readonly string[] } {
  const rows = [...seed]
  const dispatched: string[] = []
  const top = (slug: string): number =>
    Math.max(
      ...rows
        .filter((found: Readonly<CorpusRow>): boolean => found.slug === slug)
        .map((found: Readonly<CorpusRow>): number => found.revision),
    )
  return {
    dispatched,
    corpus: async (): Promise<readonly CorpusRow[]> =>
      await Promise.resolve([...rows]),
    dispatch: async (repo: string, slug: string): Promise<void> => {
      dispatched.push(`${repo}:${slug}`)
      rows.push(row(slug, top(slug) + 1, false))
      await Promise.resolve()
    },
    settle: async (slug: string, after: number): Promise<number | undefined> =>
      await Promise.resolve(top(slug) > after ? top(slug) : undefined),
  }
}

test('a seeded deprecation with two first-party users ends with zero users and two new revisions, no hand step', async (): Promise<void> => {
  const io = world([
    row('alpha', 1, true),
    row('beta', 2, true),
    row('gamma', 1, false),
  ])

  const result = await reupload({
    deprecation: SEEDED,
    repos: REPOS,
    io,
    apply: true,
  })

  assert.deepEqual(result.before.heads, ['alpha r1', 'beta r2'])
  assert.deepEqual(io.dispatched, ['shard-alpha:alpha', 'shard-beta:beta'])
  assert.deepEqual(result.republished, [
    { slug: 'alpha', from: 1, to: 2 },
    { slug: 'beta', from: 2, to: 3 },
  ])
  assert.deepEqual(result.after.heads, [], "no shard's newest revision uses it")
  assert.deepEqual(
    result.after.kept,
    ['alpha r1', 'beta r2'],
    'the superseded originals wait on the prune',
  )
  assert.match(
    reuploadReport(result),
    /after, 0 shards' newest revisions \(none\)/u,
  )
})

test('without --apply it only plans', async (): Promise<void> => {
  const io = world([row('alpha', 1, true)])

  const result = await reupload({
    deprecation: SEEDED,
    repos: REPOS,
    io,
    apply: false,
  })

  assert.deepEqual(io.dispatched, [])
  assert.deepEqual(result.after.heads, ['alpha r1'])
})

test('a mended part is the API migration; an outside shard gets a needs-author note', (): void => {
  const rows = [row('alpha', 1, true), row('outsider', 1, true)]

  const mended = reuploadPlan(
    rows,
    { ...SEEDED, migration: 'fp99-step' },
    REPOS,
  )
  const unmended = reuploadPlan(rows, SEEDED, REPOS)

  assert.deepEqual(
    mended.map((step: Readonly<{ action: string }>): string => step.action),
    ['migrate', 'migrate'],
  )
  assert.deepEqual(
    unmended.map(
      (step: Readonly<{ slug: string; action: string }>): readonly string[] => [
        step.slug,
        step.action,
      ],
    ),
    [
      ['alpha', 'republish'],
      ['outsider', 'needs-author'],
    ],
  )
  assert.match(unmended[1]?.detail ?? '', /needs its author: leave it out/u)
})

test('only a newest revision counts: an older revision alone is left to the prune', (): void => {
  const rows = [row('alpha', 1, true), row('alpha', 2, false)]

  assert.deepEqual(reuploadPlan(rows, SEEDED, REPOS), [])
})
