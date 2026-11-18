import { UNNAMED_TIER, budgetTierLimits } from './budget-tiers.ts'
import { ratchetNote, ratchetSeverity } from './memory-ratchet.ts'
import { runtimeAccountedBytes } from './runtimeCost.ts'

import type { BudgetTier } from './budget-tiers.ts'

/** What the check reads of a shard: its runtime's reviewed cost and its budgets. */
type RuntimeTierSource = Readonly<{
  runtime: Readonly<{ cost?: unknown }> | null
  budgets: Readonly<{ client?: unknown; tier?: BudgetTier }>
  /** J412: the zone whose ratchet baseline applies (`memory-ratchet.ts`). */
  identity?: Readonly<{ slug: string }>
}>

interface RuntimeTierIssue {
  readonly code: 'runtime-tier-memory'
  readonly metric: string
  readonly actual: number
  readonly limit: number
  readonly severity: 'refusal' | 'warning'
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
  const severity = ratchetSeverity(source.identity?.slug, 'runtime', {
    line: limit,
    actual,
  })
  return [
    {
      code: 'runtime-tier-memory',
      metric: `runtime accounted bytes over the ${tier} tier's memory (OF10c1a: name a larger tier or shrink the runtime)${severity === 'warning' ? ratchetNote(source.identity?.slug, 'runtime') : ''}`,
      actual,
      limit,
      severity,
    },
  ]
}

export { UNNAMED_TIER } from './budget-tiers.ts'

export { type RuntimeTierIssue, type RuntimeTierSource, runtimeTierIssues }
