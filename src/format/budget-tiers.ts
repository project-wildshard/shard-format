import { picklist } from 'valibot'

import type { PicklistSchema } from 'valibot'

/**
 * ONE-FORMAT OF10c0 (Q-T21: "tiers a shard picks"): a shard names its budget tier in `budgets.tier`, and each tier is a
 * CPU, memory and bandwidth limit. Checked at build and at upload; OF10c1 to OF10c4 meter the engine's four dangerous
 * gates against these limits and then delete the gates. A shard that names no tier is `small`.
 *
 * - `cpuMicrosPerFrame`: the shard's own runtime and page features, per 60 Hz frame on the reference phone.
 * - `memoryBytes`: resident memory its runtime and owned stages may hold beyond the admitted content.
 * - `bandwidthBytes`: compressed bytes a player downloads for the shard (J338: 50 MB is fine, 100 MB is the hard cap).
 */
interface BudgetTierLimits {
  readonly cpuMicrosPerFrame: number
  readonly memoryBytes: number
  readonly bandwidthBytes: number
}
type BudgetTier = 'small' | 'medium' | 'large'

const MEBIBYTE = 1_048_576
const SMALL_CPU = 1000
const MEDIUM_CPU = 2000
const LARGE_CPU = 4000
const SMALL_MEMORY = 64
const MEDIUM_MEMORY = 128
const LARGE_MEMORY = 256
const SMALL_BANDWIDTH = 25_000_000
const MEDIUM_BANDWIDTH = 50_000_000
const LARGE_BANDWIDTH = 100_000_000

const BUDGET_TIERS: Readonly<Record<BudgetTier, BudgetTierLimits>> = {
  small: {
    cpuMicrosPerFrame: SMALL_CPU,
    memoryBytes: SMALL_MEMORY * MEBIBYTE,
    bandwidthBytes: SMALL_BANDWIDTH,
  },
  medium: {
    cpuMicrosPerFrame: MEDIUM_CPU,
    memoryBytes: MEDIUM_MEMORY * MEBIBYTE,
    bandwidthBytes: MEDIUM_BANDWIDTH,
  },
  large: {
    cpuMicrosPerFrame: LARGE_CPU,
    memoryBytes: LARGE_MEMORY * MEBIBYTE,
    bandwidthBytes: LARGE_BANDWIDTH,
  },
}
/** The tier a shard picks; an unknown tier refuses. */
const BudgetTierSchema: PicklistSchema<
  ['small', 'medium', 'large'],
  undefined
> = picklist(['small', 'medium', 'large'])
/** The limits a shard's budgets name (`small` when it names none). */
function budgetTierLimits(budgets: {
  readonly tier?: BudgetTier
}): BudgetTierLimits {
  return BUDGET_TIERS[budgets.tier ?? 'small']
}

export { BUDGET_TIERS, BudgetTierSchema, budgetTierLimits }
export type { BudgetTier, BudgetTierLimits }
