import armed from './memory-armed.json' with { type: 'json' }

/** The armed-zone readings are shared with the engine. J445 uses the common
 * loading ceiling for offline refusal and the playing line for reporting. */
interface ArmedZone {
  readonly armed: string
  readonly by: string
  readonly epoch: number
  readonly playingBytes: number
  readonly loadingBytes: number
  readonly evidence: string
}

type ArmedKind = 'playing' | 'loading'

const ARMED_LINES: Readonly<Record<ArmedKind, number>> = Object.freeze({
  playing: armed.lines.playingBytes,
  loading: armed.lines.loadingBytes,
})

const ARMED_ZONES: Readonly<Record<string, ArmedZone>> = Object.freeze(
  armed.zones,
)

/** J424 (QA 11-18 row 29): a zone armed once but held out of `ARMED_ZONES` while engine pins an older product of it
 *  that reads over its line. It reports only; it moves back to `zones` (re-armed) when its engine re-pin lands. */
/** True when `slug` is in the armed list (J426). */
function zoneArmed(slug?: string): boolean {
  return slug !== undefined && Object.hasOwn(ARMED_ZONES, slug)
}

/** The common lines for an armed zone. A revision's own reading is evidence,
 * while the offline decision uses the shared target or ceiling (J445). */
function armedLine(
  slug: string | undefined,
  kind: ArmedKind,
): number | undefined {
  return zoneArmed(slug) ? ARMED_LINES[kind] : undefined
}

type RatchetMetric = 'playing' | 'loading' | 'runtime'

/** J445: only the common loading ceiling can refuse an armed shard. Playing and runtime tier overages are reported. */
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

/** The words a reported (not refused) issue carries: why it only reports (J424). */
function ratchetNote(slug: string | undefined): string {
  return zoneArmed(slug)
    ? ''
    : ` (report-only, J424: ${slug ?? 'this shard'} is not armed)`
}

/** True when a stale runtime reading only reports: J424, every zone not armed (J426). */
function staleReadingAdmitted(slug: string | undefined): boolean {
  return !zoneArmed(slug)
}

export {
  ARMED_LINES,
  ARMED_ZONES,
  type ArmedKind,
  type ArmedZone,
  armedLine,
  type RatchetMetric,
  ratchetLimit,
  ratchetNote,
  ratchetSeverity,
  staleReadingAdmitted,
  zoneArmed,
}
