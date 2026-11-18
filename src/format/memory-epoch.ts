import { staleReadingAdmitted } from './memory-ratchet.ts'

/** MEMORY-GATES MG5 (J408, Jake 2026-11-17: "a stale runtimeCost is refused"): the memory model a runtime home's
 * `runtimeCost` reading must have been taken against. It rises when the model changes what it charges (MG6 adds shader
 * compile, load transients, far slabs and paint arrays); from then a reading from an older epoch is refused until the
 * shard re-measures. A reading with no `epoch` is epoch 1, the model before MG6. */
const MEMORY_EPOCH = 8
/** MG6 epoch 4 (mini-estcal2) changed how the estimate converts a reading (EM11's chain), not how a reading is taken:
 * epoch 3's paired Simulator WebContent + GL protocol stands, so a reading from epoch 3 on is current. Epoch 5
 * (mini-em11b) refits that conversion to EM11 read without the Web Inspector's Network retention and counts only the
 * files a phone fetches; epoch 6 (mini-sweep) refits it to an every-zone sweep on engine `50092092`; epoch 7 (mini-em11c) refits
 * it to the same sweep read with EM11's 90% prediction bound over runs in place of the highest run; epoch 8 (mini-pinemem5) refits it to an every-zone
 * sweep on engine `0af7ccd8`. Readings are still taken as in epoch 3. */
const OLDEST_CURRENT_EPOCH = 3
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
  readonly severity: 'refusal' | 'warning'
}

/** Why a runtime reading is stale, older than `current` (the oldest current epoch), or empty when it is current. */
function staleRuntimeCost(
  row: EpochRow,
  current: number = OLDEST_CURRENT_EPOCH,
): string {
  const epoch = row.epoch ?? LEGACY_EPOCH
  if (epoch >= current) {
    return ''
  }
  return `native resident measurement is stale: memory epoch ${String(epoch)}, current ${String(current)} (J408): re-measure the runtime home`
}

/** A refusal, whatever the policy, for an armed runtime home's reading and for its images-first reading, each stale against
 * `current`. Takes the shard's `runtime` (null for a data-only shard). J424 / J426: a refusal only for an armed zone
 * (`memory-armed.ts`), given its `identity`; every other shard reports. */
function staleRuntimeIssues(
  runtime: Readonly<{ cost?: EpochRow | undefined }> | null,
  current: number = OLDEST_CURRENT_EPOCH,
  identity?: Readonly<{ slug: string; revision: number }>,
): StaleRuntimeIssue[] {
  const admitted = staleReadingAdmitted(identity?.slug, identity?.revision)
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
      metric: `${staleRuntimeCost(row, current)}${admitted ? ' (report-only, J424: the zone is not armed)' : ''}`,
      actual: row.epoch ?? LEGACY_EPOCH,
      limit: current,
      severity: admitted ? 'warning' : 'refusal',
    }))
}

export {
  MEMORY_EPOCH,
  OLDEST_CURRENT_EPOCH,
  staleRuntimeCost,
  staleRuntimeIssues,
}
