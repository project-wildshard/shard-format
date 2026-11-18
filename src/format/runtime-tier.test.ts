// ONE-FORMAT OF10c1a: a runtime fits its tier's memory, refused at build and at upload.
import { expect, test } from 'vitest'

import { BUDGET_TIERS } from './budget-tiers.ts'
import { runtimeTierIssues } from './runtime-tier.ts'
import { runtimeAccountedBytes } from './runtimeCost.ts'

const nine = {
  webContentMB: 399.21624,
  glMB: 278.256291,
  engineBaseMB: 299,
  rev: '5357804745121cdda8f9492b62d3266244f4ac1b',
  device: 'iOS Simulator iPhone 17 Pro Safari + desktop labelled GL census',
  evidence: 'progress/memory/sf22a-runtime-homes-535780474/summary.json',
  epoch: 3,
}

test('OF10c1a: a runtime over its named tier refuses with a named error', (): void => {
  const issues = runtimeTierIssues({
    runtime: { cost: nine },
    budgets: { tier: 'small' },
  })
  expect(issues).toEqual([
    expect.objectContaining({
      code: 'runtime-tier-memory',
      actual: runtimeAccountedBytes(nine),
      limit: BUDGET_TIERS.small.memoryBytes,
      severity: 'refusal',
    }),
  ])
  expect(issues[0]?.metric).toContain('small tier')
})

test('OF10c1a: a runtime inside its tier passes; no runtime or no cost has nothing to check', (): void => {
  expect(
    runtimeTierIssues({ runtime: { cost: nine }, budgets: { tier: 'large' } }),
  ).toEqual([])
  expect(runtimeTierIssues({ runtime: { cost: nine }, budgets: {} })).toEqual(
    [],
  )
  expect(
    // oxlint-disable-next-line unicorn/no-null -- the shard schema's runtime is nullable
    runtimeTierIssues({ runtime: null, budgets: { tier: 'small' } }),
  ).toEqual([])
  expect(
    runtimeTierIssues({ runtime: {}, budgets: { tier: 'small' } }),
  ).toEqual([])
})

test('OF10c1a: the reviewed budgets.client stands in for a runtime with no cost', (): void => {
  expect(
    runtimeTierIssues({
      runtime: {},
      budgets: { client: nine, tier: 'small' },
    }),
  ).toHaveLength(1)
})
