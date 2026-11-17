import { parse, safeParse } from 'valibot'
import { expect, test } from 'vitest'

import { BUDGET_TIERS, budgetTierLimits } from './budget-tiers.ts'
import { BudgetsSchema } from './shardSections.ts'

const budgets = {
  library: { resident: 1, compressed: 1 },
  sim: { resident: 1, compressed: 1 },
  overlap: 0,
}
const TIERS = ['small', 'medium', 'large'] as const

test('OF10c0: each budget tier parses with its CPU, memory and bandwidth limits; none is small', (): void => {
  for (const tier of TIERS) {
    const parsed = parse(BudgetsSchema, { ...budgets, tier })
    expect(parsed.tier).toBe(tier)
    expect(budgetTierLimits(parsed)).toBe(BUDGET_TIERS[tier])
  }
  expect(budgetTierLimits(parse(BudgetsSchema, budgets))).toBe(
    BUDGET_TIERS.small,
  )
  expect(BUDGET_TIERS.large.bandwidthBytes).toBe(100_000_000)
  for (const limit of [
    'cpuMicrosPerFrame',
    'memoryBytes',
    'bandwidthBytes',
  ] as const) {
    const values = TIERS.map((tier): number => BUDGET_TIERS[tier][limit])
    expect(values).toEqual(values.toSorted((low, high): number => low - high))
  }
})

test('OF10c0: an unknown budget tier refuses', (): void => {
  expect(safeParse(BudgetsSchema, { ...budgets, tier: 'huge' }).success).toBe(
    false,
  )
  expect(safeParse(BudgetsSchema, { ...budgets, tier: '' }).success).toBe(false)
})
