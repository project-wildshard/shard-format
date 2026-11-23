import { zoneArmed } from './memory-armed.ts'
import { MEMORY_EPOCH } from './memory-epoch.ts'

import type { ZoneRef } from './memory-armed.ts'

/**
 * SHARD-COMPAT CP10 (J486 D1.1, Jake 2026-11-21): memory lines, budgets and runtime targets judge a shard file once,
 * at upload. The API stores this verdict and its rule version (the memory epoch) beside the original; a stored
 * original, an engine shard pin and a cook validate with `judged: 'stored'`, so a newer policy reaches new uploads only
 * and never re-judges what was already admitted. Readability (schemas, inventory, hashes, preparation) is judged every
 * time either way.
 */
type Judged = 'upload' | 'stored'

/** How admission judges a shard: CP10's `judged`, and FP27b's `armed`, the API catalogue's armed state for it (absent,
 *  the format's own list decides until FP27c removes it). */
interface JudgedPorts {
  readonly judged?: Judged | undefined
  readonly armed?: boolean | ReadonlySet<string> | undefined
}

interface PolicyIssue {
  readonly code: string
  readonly metric: string
  readonly actual: number
  readonly limit: number
  readonly severity: 'refusal' | 'warning'
}

interface PolicyVerdict {
  readonly judged: Judged
  /** The rule version the verdict was reached under. */
  readonly epoch: number
  /** Whether the zone was on the armed list (J426) when judged. */
  readonly armed: boolean
  /** Every policy issue found: warnings on an upload (a refusal throws); warnings and would-be refusals when stored. */
  readonly issues: readonly PolicyIssue[]
}

function policyVerdict(
  zone: ZoneRef,
  judged: Judged,
  issues: readonly PolicyIssue[],
): PolicyVerdict {
  return {
    judged,
    epoch: MEMORY_EPOCH,
    armed: zoneArmed(zone),
    issues: issues.map(
      ({ code, metric, actual, limit, severity }): PolicyIssue => ({
        code,
        metric,
        actual,
        limit,
        severity,
      }),
    ),
  }
}

/** What the host measures on its own engine build (script CPU and fuel) still refuses; the file's own facts do not. */
const MEASURED = 'perf-script-'

/** A performance report's issues for a stored original (engine `checkShardfile` in the cook): a fact of the file judged
 * at upload only warns; an upload keeps every severity. */
function asJudged<
  Issue extends Readonly<{ code: string; severity: 'refusal' | 'warning' }>,
>(issues: readonly Issue[], judged: Judged | undefined): Issue[] {
  if (judged !== 'stored') {
    return [...issues]
  }
  return issues.map((issue: Issue): Issue =>
    issue.code.startsWith(MEASURED) ? issue : { ...issue, severity: 'warning' },
  )
}

/** The verdict each admitted shard object was judged with: read back by the validators, so no signature grows. */
const VERDICTS = new WeakMap<object, PolicyVerdict>()

function recordVerdict<Admitted extends object>(
  shard: Admitted,
  verdict: PolicyVerdict,
): Admitted {
  VERDICTS.set(shard, verdict)
  return shard
}

function admittedVerdict(shard: Readonly<object>): PolicyVerdict {
  const verdict = VERDICTS.get(shard)
  if (verdict === undefined) {
    throw new Error('admitted with no policy verdict')
  }
  return verdict
}

export {
  type JudgedPorts,
  type Judged,
  type PolicyIssue,
  type PolicyVerdict,
  admittedVerdict,
  asJudged,
  policyVerdict,
  recordVerdict,
}
