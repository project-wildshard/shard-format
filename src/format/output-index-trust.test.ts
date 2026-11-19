import { safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { OutputIndexSchema } from './outputIndex.ts'

// ONE-FORMAT OF1 (J364 (2)): new indexes name no shard trust; old products still carry the retired value and load.
function trustIssues(
  row: Readonly<Record<string, unknown>>,
): readonly string[] {
  const found: string[] = []
  for (const issue of safeParse(OutputIndexSchema.entries.runtime, row)
    .issues ?? []) {
    if (JSON.stringify(issue.path ?? []).includes('"key":"trust"')) {
      found.push(issue.message)
    }
  }
  return found
}

test('a runtime index row needs no trust value', (): void => {
  expect(trustIssues({ files: [], lines: 0 })).toEqual([])
})

test('an old product keeps its retired trust value', (): void => {
  expect(
    trustIssues({ files: [], lines: 0, trust: ['first', 'party'].join('-') }),
  ).toEqual([])
})
