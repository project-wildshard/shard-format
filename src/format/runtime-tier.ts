import { UNNAMED_TIER, budgetTierLimits } from './budget-tiers.ts'
import { armedZone, ratchetNote, ratchetSeverity } from './memory-armed.ts'
import { runtimeAccountedBytes } from './runtimeCost.ts'

import type { BudgetTier } from './budget-tiers.ts'

/** What the check reads of a shard: its runtime's reviewed cost and its budgets. */
type RuntimeTierSource = Readonly<{
  runtime: Readonly<{ cost?: unknown }> | null
  budgets: Readonly<{ client?: unknown; tier?: BudgetTier }>
  /** J412: the zone whose armed state applies (`memory-armed.ts`). */
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
 * ONE-FORMAT OF10c1a and J445: report a runtime's accounted bytes above its
 * named memory tier. A runtime with no named tier uses the large target.
 */
function runtimeTierIssues(
  source: RuntimeTierSource,
  armed?: boolean,
): RuntimeTierIssue[] {
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
  const severity = ratchetSeverity(
    armedZone(source.identity?.slug, armed),
    'runtime',
    {
      line: limit,
      actual,
    },
  )
  return [
    {
      code: 'runtime-tier-memory',
      metric: `runtime accounted bytes over the ${tier} tier's memory (OF10c1a: name a larger tier or shrink the runtime)${severity === 'warning' ? ratchetNote(armedZone(source.identity?.slug, armed)) : ''}`,
      actual,
      limit,
      severity,
    },
  ]
}

export { UNNAMED_TIER } from './budget-tiers.ts'

export { type RuntimeTierIssue, type RuntimeTierSource, runtimeTierIssues }
