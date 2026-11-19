import { zoneArmed } from './memory-armed.ts'

/**
 * J411 / J412 (Jake, 2026-11-18): memory gates are ratchets. "With these new gates we should definitely be landing
 * improvements even if they don't meet the new high standards." The J408 phone line (1.5 GB playing and loading), the
 * OF10c1a runtime tier and the MG5 stale-reading check refuse a zone only when it is worse than its baseline here;
 * at or under the baseline they report. A zone with no row keeps every refusing gate.
 *
 * Each baseline is the zone's reading on 2026-11-18 under memory epoch 8 (MEMORY-GATES MG10, mini-pinemem5; epoch 7
 * mini-mg8): the largest of the engine-pinned product's estimates (admission and performance report) and the current
 * source's, in decimal bytes. Nine's and Pine's loading rows are engine's full-check performance report of the pinned
 * product (the offline estimate reads 1,667 and 1,697 MB); Pine's playing row is its declared admission. A cut ratchets
 * the row down; a zone
 * that passes a line loses that field. J424 / J426 (2026-11-18): the baselines only report now; a zone refuses only once
 * it is armed (`memory-armed.ts`), and then over the line itself. `staleRevision` is the pinned product's
 * `identity.revision`: it admits that revision's pre-epoch-3 runtime reading; any later revision must carry a current one.
 */
interface MemoryBaseline {
  readonly playing?: number
  readonly loading?: number
  readonly runtime?: number
  readonly staleRevision?: number
}

const MEMORY_RATCHET: Readonly<Record<string, MemoryBaseline>> = Object.freeze({
  'driftwood-isle': {
    runtime: 538_863_164,
    staleRevision: 2,
  },
  'nalati-grasslands': {
    loading: 1_582_259_503,
    runtime: 700_846_587,
    staleRevision: 1,
  },
  'nine-dragon-stack': {
    loading: 1_687_945_650,
    runtime: 547_365_098,
    staleRevision: 1,
  },
  'pine-hollow': {
    playing: 1_627_187_329,
    loading: 1_806_997_225,
    runtime: 550_909_717,
    staleRevision: 1,
  },
})

/** The estimate's run-to-run noise is zero (it is computed, not sampled); the allowance covers byte drift from a
 * rebuild of the same source (compression, packing order). */
const RATCHET_ALLOWANCE = 0.005

type RatchetMetric = 'playing' | 'loading' | 'runtime'

/** J445: only the common loading ceiling can refuse an armed shard.
 * Playing and runtime tier overages are reported. */
function ratchetLimit(
  slug: string | undefined,
  metric: RatchetMetric,
  line: number,
): number {
  return metric === 'loading' && zoneArmed(slug)
    ? line
    : Number.POSITIVE_INFINITY
}

/** Describe the offline decision for a measured overage. */
function ratchetSeverity(
  slug: string | undefined,
  metric: RatchetMetric,
  reading: Readonly<{ line: number; actual: number }>,
): 'refusal' | 'warning' {
  return reading.actual > ratchetLimit(slug, metric, reading.line)
    ? 'refusal'
    : 'warning'
}

/** The words a reported (not refused) issue carries: why it only reports, and the zone's J412 baseline if it has one. */
function ratchetNote(slug: string | undefined, metric: RatchetMetric): string {
  if (zoneArmed(slug)) {
    return ''
  }
  const baseline =
    slug === undefined ? undefined : MEMORY_RATCHET[slug]?.[metric]
  const zone = slug ?? 'this shard'
  return baseline === undefined
    ? ` (report-only, J424: ${zone} is not armed)`
    : ` (report-only, J424: ${zone} is not armed; J412 baseline ${String(baseline)})`
}

/** True when a stale runtime reading only reports: J424, every zone not armed (J426). */
function staleReadingAdmitted(
  slug: string | undefined,
  _revision: number | undefined,
): boolean {
  return !zoneArmed(slug)
}

export {
  MEMORY_RATCHET,
  RATCHET_ALLOWANCE,
  type MemoryBaseline,
  type RatchetMetric,
  ratchetLimit,
  ratchetNote,
  ratchetSeverity,
  staleReadingAdmitted,
}
