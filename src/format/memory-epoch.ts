/** MEMORY-GATES MG5 (J408, Jake 2026-11-17: "a stale runtimeCost is refused"): the memory model a runtime home's
 * `runtimeCost` reading must have been taken against. It rises when the model changes what it charges (MG6 adds shader
 * compile, load transients, far slabs and paint arrays); from then a reading from an older epoch is refused until the
 * shard re-measures. A reading with no `epoch` is epoch 1, the model before MG6. */
const MEMORY_EPOCH = 1
const LEGACY_EPOCH = 1

interface EpochRow {
  readonly epoch?: number | undefined
  readonly imagesFirst?: EpochRow | undefined
}
interface StaleRuntimeIssue {
  readonly code: 'perf-native-resident-unmeasured'
  readonly metric: string
  readonly actual: number
  readonly limit: number
  readonly severity: 'refusal'
}

/** Why a runtime reading is stale against `current`, or empty when it is current. */
function staleRuntimeCost(
  row: EpochRow,
  current: number = MEMORY_EPOCH,
): string {
  const epoch = row.epoch ?? LEGACY_EPOCH
  if (epoch >= current) {
    return ''
  }
  return `native resident measurement is stale: memory epoch ${String(epoch)}, current ${String(current)} (J408): re-measure the runtime home`
}

/** A refusal, whatever the policy, for a runtime home's reading and for its images-first reading, each stale against
 * `current`. Takes the shard's `runtime` (null for a data-only shard). */
function staleRuntimeIssues(
  runtime: Readonly<{ cost?: EpochRow | undefined }> | null,
  current: number = MEMORY_EPOCH,
): StaleRuntimeIssue[] {
  const rows: EpochRow[] = []
  const cost = runtime === null ? undefined : runtime.cost
  if (cost !== undefined) {
    rows.push(cost)
    if (cost.imagesFirst !== undefined) {
      rows.push(cost.imagesFirst)
    }
  }
  return rows
    .filter((row: EpochRow): boolean => staleRuntimeCost(row, current) !== '')
    .map((row: EpochRow): StaleRuntimeIssue => ({
      code: 'perf-native-resident-unmeasured',
      metric: staleRuntimeCost(row, current),
      actual: row.epoch ?? LEGACY_EPOCH,
      limit: current,
      severity: 'refusal',
    }))
}

export { MEMORY_EPOCH, staleRuntimeCost, staleRuntimeIssues }
