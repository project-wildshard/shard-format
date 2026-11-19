import { expect, test } from 'vitest'
import * as v from 'valibot'

import { OutputIndexSchema } from './outputIndex.ts'

// ONE-FORMAT OF1 (J364 (2)): new indexes name no shard trust; old products still carry the retired value and load.
const trustIssues = (row: Readonly<Record<string, unknown>>): readonly string[] =>
  (v.safeParse(OutputIndexSchema.entries.runtime, row).issues ?? [])
    .filter((issue): boolean => issue.path?.some((step): boolean => step.key === 'trust') === true)
    .map((issue): string => issue.message)

test('a runtime index row needs no trust value', (): void => {
  expect(trustIssues({ files: [], lines: 0 })).toEqual([])
})

test('an old product keeps its retired trust value', (): void => {
  expect(trustIssues({ files: [], lines: 0, trust: ['first', 'party'].join('-') })).toEqual([])
})
