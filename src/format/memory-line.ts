import { bootMemoryCosts } from './boot-memory-cost.ts'
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

/** Count cold-boot costs and any opaque runtime residency in offline admission. */
function offlineMemoryIssues(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- format's shard type, read only
  source: Shardfile,
  sections: ReadonlyMap<string, unknown>,
): ReturnType<typeof hardLineIssue>[] {
  const native = source.runtime?.cost
  const runtime =
    native === undefined ? EMPTY_BYTES : runtimeAccountedBytes(native)
  const commons = Object.values(source.requires.commonsCosts).reduce(
    (sum, row): number => sum + row.decoded + row.gpu,
    EMPTY_BYTES,
  )
  const cost = worstContentCost(source, {
    commons: runtime + commons,
    boot: bootMemoryCosts(source, sections),
  })
  return (['playing', 'loading'] as const)
    .filter((kind): boolean => cost[kind] > MEMORY_HARD_BYTES)
    .map((kind): ReturnType<typeof hardLineIssue> =>
      hardLineIssue(kind, cost[kind]),
    )
}

export { MEMORY_HARD_BYTES, hardLineIssue, offlineMemoryIssues, overHardLine }
