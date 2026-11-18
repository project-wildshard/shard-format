import { budgetTierLimits } from './budget-tiers.ts'
import { runtimeAccountedBytes } from './runtimeCost.ts'

import type { BudgetTier } from './budget-tiers.ts'

/** The tier an unnamed runtime is held to until OF10c1b names every runtime shard's tier. */
const UNNAMED_TIER: BudgetTier = 'large'

/** What the check reads of a shard: its runtime's reviewed cost and its budgets. */
type RuntimeTierSource = Readonly<{
  runtime: Readonly<{ cost?: unknown }> | null
  budgets: Readonly<{ client?: unknown; tier?: BudgetTier }>
}>

interface RuntimeTierIssue {
  readonly code: 'runtime-tier-memory'
  readonly metric: string
  readonly actual: number
  readonly limit: number
  readonly severity: 'refusal'
}

/**
 * ONE-FORMAT OF10c1a: a runtime fits its tier. A shard with a runtime and a reviewed cost (`runtime.cost`, else
 * `budgets.client`) refuses at build and at upload when the runtime's accounted bytes (`runtimeAccountedBytes`: what
 * it holds above the engine's resident base) exceed its tier's `memoryBytes`. A shard naming no tier is held to `large`
 * until OF10c1b names a tier in each of our runtime shards' sources; then a runtime must name one.
 */
function runtimeTierIssues(source: RuntimeTierSource): RuntimeTierIssue[] {
  const cost = source.runtime?.cost ?? source.budgets.client
  if (source.runtime === null || cost === undefined) {
    return []
  }
  const tier = source.budgets.tier ?? UNNAMED_TIER
  const limit = budgetTierLimits({ tier }).memoryBytes
  const actual = runtimeAccountedBytes(cost)
  if (actual <= limit) {
    return []
  }
  return [
    {
      code: 'runtime-tier-memory',
      metric: `runtime accounted bytes over the ${tier} tier's memory (OF10c1a: name a larger tier or shrink the runtime)`,
      actual,
      limit,
      severity: 'refusal',
    },
  ]
}

export {
  UNNAMED_TIER,
  type RuntimeTierIssue,
  type RuntimeTierSource,
  runtimeTierIssues,
}
