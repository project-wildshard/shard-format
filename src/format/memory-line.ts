import { worstContentCost } from './budget.ts'
import { runtimeAccountedBytes } from './runtimeCost.ts'

import type { Shardfile } from './shardSchema.ts'

/** J408 (Jake, 2026-11-17, after Nine crashed his iPhone 17 Pro at boot): the hard line. An estimate over it
 * refuses in every offline gate (check, shard CI, api-server, the cook) whatever the policy or the report-only switch.
 * Engine's MEMORY_AMBER (src/client/game/grid/budgetOverlay.ts). Decimal bytes. MEMORY-GATES MG4. */
const MEMORY_HARD_BYTES = 1.5e9
const GB = 1e9
const DIGITS = 1
const EMPTY_BYTES = 0

/** The refusal's words for an estimate over the hard line; empty under it. */
function overHardLine(bytes: number): string {
  if (bytes <= MEMORY_HARD_BYTES) {
    return ''
  }
  return ` (over the ${(MEMORY_HARD_BYTES / GB).toFixed(DIGITS)} GB phone line, J408: a phone would close the page)`
}

/** J408 (MG4): the refusal for a worst-playing or loading estimate over the hard line. */
function hardLineIssue(
  kind: 'playing' | 'loading',
  bytes: number,
): {
  readonly code: 'perf-playing-memory' | 'perf-loading-memory'
  readonly metric: string
  readonly actual: number
  readonly limit: number
  readonly severity: 'refusal'
} {
  return {
    code: `perf-${kind}-memory`,
    metric: `worst ${kind} total bytes${overHardLine(bytes)}`,
    actual: bytes,
    limit: MEMORY_HARD_BYTES,
    severity: 'refusal',
  }
}

/** File admission cannot infer the opaque runtime's resident bytes. */
function offlineRuntimeMemoryIssues(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard type, read only
  source: Shardfile,
): ReturnType<typeof hardLineIssue>[] {
  if (source.runtime?.cost === undefined) {
    return []
  }
  const runtime = runtimeAccountedBytes(source.runtime.cost)
  const commons = Object.values(source.requires.commonsCosts).reduce(
    (sum, row): number => sum + row.decoded + row.gpu,
    EMPTY_BYTES,
  )
  const cost = worstContentCost(source, runtime + commons)
  return (['playing', 'loading'] as const)
    .filter((kind): boolean => cost[kind] > MEMORY_HARD_BYTES)
    .map((kind): ReturnType<typeof hardLineIssue> =>
      hardLineIssue(kind, cost[kind]),
    )
}

export {
  MEMORY_HARD_BYTES,
  hardLineIssue,
  offlineRuntimeMemoryIssues,
  overHardLine,
}
