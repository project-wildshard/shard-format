/**
 * J411 / J412 (Jake, 2026-11-18): memory gates are ratchets. "With these new gates we should definitely be landing
 * improvements even if they don't meet the new high standards." The J408 phone line (1.5 GB playing and loading), the
 * OF10c1a runtime tier and the MG5 stale-reading check refuse a zone only when it is worse than its baseline here;
 * at or under the baseline they report. A zone with no row keeps every refusing gate.
 *
 * Each baseline is the zone's reading on 2026-11-18 under memory epoch 8 (MEMORY-GATES MG10, mini-pinemem5; epoch 7
 * mini-mg8): the largest of the engine-pinned product's estimates (admission and performance report) and the current
 * source's, in decimal bytes. Pine's playing and loading rows are its pinned product's declared admission (the epoch-8
 * estimate reads 1,261 / 1,697 MB). A cut ratchets the row down; a zone
 * that passes a line loses that field, and the line refuses again. `staleRevision` is the pinned product's
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
    loading: 1_666_992_954,
    runtime: 547_365_098,
    staleRevision: 1,
  },
  'pine-hollow': {
    playing: 1_627_187_329,
    loading: 1_707_187_329,
    runtime: 550_909_717,
    staleRevision: 1,
  },
})

/** The estimate's run-to-run noise is zero (it is computed, not sampled); the allowance covers byte drift from a
 * rebuild of the same source (compression, packing order). */
const RATCHET_ALLOWANCE = 0.005

type RatchetMetric = 'playing' | 'loading' | 'runtime'

/** The bytes over which `slug` refuses on `metric`: the line, or its baseline plus the allowance when that is higher. */
function ratchetLimit(
  slug: string | undefined,
  metric: RatchetMetric,
  line: number,
): number {
  const baseline =
    slug === undefined ? undefined : MEMORY_RATCHET[slug]?.[metric]
  if (baseline === undefined) {
    return line
  }
  return Math.max(line, baseline + Math.floor(baseline * RATCHET_ALLOWANCE))
}

/** 'refusal' over the ratchet, 'warning' over the line but within the zone's baseline. */
function ratchetSeverity(
  slug: string | undefined,
  metric: RatchetMetric,
  reading: Readonly<{ line: number; actual: number }>,
): 'refusal' | 'warning' {
  return reading.actual > ratchetLimit(slug, metric, reading.line)
    ? 'refusal'
    : 'warning'
}

/** The words a reported (not refused) issue carries. */
function ratchetNote(slug: string | undefined, metric: RatchetMetric): string {
  const baseline =
    slug === undefined ? undefined : MEMORY_RATCHET[slug]?.[metric]
  return baseline === undefined
    ? ''
    : ` (report-only, J412 ratchet: ${slug ?? ''} baseline ${String(baseline)})`
}

/** True when `revision` of `slug` is the pinned product whose stale reading the ratchet admits. */
function staleReadingAdmitted(
  slug: string | undefined,
  revision: number | undefined,
): boolean {
  return (
    slug !== undefined &&
    revision !== undefined &&
    MEMORY_RATCHET[slug]?.staleRevision === revision
  )
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
