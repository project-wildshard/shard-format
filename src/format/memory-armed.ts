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

/** FORMAT-PRUNE FP27b: the zone a memory gate judges. Admission passes the API catalogue's `armed` beside the slug
 *  (`{ slug, armed }`); a bare slug still reads the format's own `zones` list until FP27c removes it. */
type ZoneRef =
  | string
  | undefined
  | Readonly<{ slug?: string | undefined; armed: boolean }>

/** The zone as a gate takes it: the catalogue's word when admission gave one, else the bare slug. */
function armedZone(slug: string | undefined, catalogue?: boolean): ZoneRef {
  return catalogue === undefined ? slug : { slug, armed: catalogue }
}

function slugOf(zone: ZoneRef): string | undefined {
  return typeof zone === 'object' ? zone.slug : zone
}

const ARMED_LINES: Readonly<Record<ArmedKind, number>> = Object.freeze({
  playing: armed.lines.playingBytes,
  loading: armed.lines.loadingBytes,
})

const ARMED_ZONES: Readonly<Record<string, ArmedZone>> = Object.freeze(
  armed.zones,
)

/** J424 (QA 11-18 row 29): a zone armed once but held out of `ARMED_ZONES` while engine pins an older product of it
 *  that reads over its line. It reports only; it moves back to `zones` (re-armed) when its engine re-pin lands. */
/** True when the zone is armed (J426): the catalogue's word when admission passed it, else the format's list. */
function zoneArmed(zone?: ZoneRef): boolean {
  if (typeof zone === 'object') {
    return zone.armed
  }
  return zone !== undefined && Object.hasOwn(ARMED_ZONES, zone)
}

/** The common lines for an armed zone. A revision's own reading is evidence,
 * while the offline decision uses the shared target or ceiling (J445). */
function armedLine(zone: ZoneRef, kind: ArmedKind): number | undefined {
  return zoneArmed(zone) ? ARMED_LINES[kind] : undefined
}

type RatchetMetric = 'playing' | 'loading' | 'runtime'

/** J445: only the common loading ceiling can refuse an armed shard. Playing and runtime tier overages are reported. */
function ratchetLimit(
  zone: ZoneRef,
  metric: RatchetMetric,
  line: number,
): number {
  return metric === 'loading' && zoneArmed(zone)
    ? line
    : Number.POSITIVE_INFINITY
}

/** Describe the offline decision for a measured overage. */
function ratchetSeverity(
  zone: ZoneRef,
  metric: RatchetMetric,
  reading: Readonly<{ line: number; actual: number }>,
): 'refusal' | 'warning' {
  return reading.actual > ratchetLimit(zone, metric, reading.line)
    ? 'refusal'
    : 'warning'
}

/** The words a reported (not refused) issue carries: why it only reports (J424). */
function ratchetNote(zone: ZoneRef): string {
  return zoneArmed(zone)
    ? ''
    : ` (report-only, J424: ${slugOf(zone) ?? 'this shard'} is not armed)`
}

/** True when a stale runtime reading only reports: J424, every zone not armed (J426). */
function staleReadingAdmitted(zone: ZoneRef): boolean {
  return !zoneArmed(zone)
}

export {
  ARMED_LINES,
  ARMED_ZONES,
  type ArmedKind,
  type ArmedZone,
  type ZoneRef,
  armedLine,
  armedZone,
  type RatchetMetric,
  ratchetLimit,
  ratchetNote,
  ratchetSeverity,
  staleReadingAdmitted,
  zoneArmed,
}
